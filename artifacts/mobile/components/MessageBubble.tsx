/**
 * MessageBubble — AkılCEP premium chat bubbles.
 *
 * USER → floating soft-gray glass bubble
 * AI   → bare editorial text on background, NO container/card/box
 *         + minimal action row: copy · like · dislike · read-aloud · share
 */
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import {
  ActionSheetIOS,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ImageViewer   from "@/components/ImageViewer";
import MarkdownText  from "@/components/MarkdownText";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Message } from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  message:       Message;
  isLatest?:     boolean;
  onEditImage?:  (imageData: string, instruction: string) => void;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Generic action button ─────────────────────────────────────────────────────
function ActionBtn({
  icon,
  active,
  onPress,
}: {
  icon:     string;
  active?:  boolean;
  onPress?: () => void;
}) {
  const { theme: T } = useTheme();

  // Idle: clearly visible but not shouting. Press: full opacity snap.
  const idleOp  = active ? 0.92 : 0.72;
  const scale   = useSharedValue(1);
  const op      = useSharedValue(idleOp);

  // sync opacity when active state changes
  useEffect(() => {
    op.value = withTiming(active ? 0.92 : 0.72, { duration: 250 });
  }, [active]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   op.value,
  }));

  const press = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(1.22, { duration: 80 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    });
    op.value = withTiming(1, { duration: 80 }, () => {
      op.value = withTiming(active ? 0.92 : 0.72, { duration: 500 });
    });
    onPress?.();
  };

  // Light: #484848 idle → near-black on press. Dark: #C8C8C8 idle → white on press.
  const clr = T.isDark ? "#C8C8C8" : "#484848";

  return (
    <TouchableOpacity onPress={press} hitSlop={12} activeOpacity={1}>
      <Animated.View style={aStyle}>
        <Feather name={icon as any} size={13} color={clr} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Read-aloud button with pulse while speaking ───────────────────────────────
function SpeakBtn({ text }: { text: string }) {
  const { theme: T } = useTheme();
  const [speaking, setSpeaking] = useState(false);

  const scale = useSharedValue(1);
  const op    = useSharedValue(0.72);

  // Gentle pulse while speaking
  useEffect(() => {
    if (speaking) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.30, { duration: 550, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0,  { duration: 550, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      op.value = withRepeat(
        withSequence(
          withTiming(1.00, { duration: 550 }),
          withTiming(0.65, { duration: 550 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      op.value    = withTiming(0.72, { duration: 300 });
    }
  }, [speaking]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   op.value,
  }));

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      Speech.speak(text, {
        language:   "tr-TR",
        pitch:      1.0,
        rate:       0.92,
        onDone:     () => setSpeaking(false),
        onStopped:  () => setSpeaking(false),
        onError:    () => setSpeaking(false),
      });
    }
  };

  const clr = speaking
    ? T.green
    : T.isDark ? "#C8C8C8" : "#484848";

  return (
    <TouchableOpacity onPress={toggle} hitSlop={12} activeOpacity={1}>
      <Animated.View style={aStyle}>
        <Feather name="volume-2" size={13} color={clr} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Edit instruction hints ─────────────────────────────────────────────────────
const EDIT_HINTS = [
  "Siyah yap",
  "Arka planı beyaz yap",
  "Daha gerçekçi yap",
  "Altın detaylar ekle",
  "Karikatür stiline çevir",
  "Aydınlat",
  "Arka planı kaldır",
];

// ─── Generated image card ──────────────────────────────────────────────────────
// Shown inside AI message bubbles when imageData is present.
function GeneratedImageCard({
  imageData,
  caption,
  onEdit,
  autoOpen,
}: {
  imageData:  string;
  caption:    string;
  onEdit?:    (instruction: string) => void;
  autoOpen?:  boolean;
}) {
  const { theme: T, showToast } = useTheme();
  const [revealed,      setRevealed]      = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  const imgOp    = useSharedValue(0);
  const imgStyle = useAnimatedStyle(() => ({ opacity: imgOp.value }));

  // Auto-open disabled — user opens fullscreen by tapping the image

  // Derived theme colors
  const shimmerBg = T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const actionClr = T.isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.38)";

  // Open full-screen viewer
  const handleImagePress = () => {
    if (!revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerVisible(true);
  };

  // Long-press → viewer (contains all actions)
  const handleLongPress = () => {
    if (!revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setViewerVisible(true);
  };

  // Copy image to clipboard
  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const b64 = imageData.replace(/^data:image\/\w+;base64,/, "");
      await (Clipboard as any).setImageAsync(b64);
      showToast("Görsel kopyalandı");
    } catch {
      await Clipboard.setStringAsync(imageData);
      showToast("Görsel kopyalandı");
    }
  };

  // Share image via native share sheet
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const b64  = imageData.replace(/^data:image\/\w+;base64,/, "");
      const uri  = `${FileSystem.cacheDirectory}akilcep-share-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { message: uri, title: "AkılCEP Görseli" },
      );
      setTimeout(async () => {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }, 8000);
    } catch { /* cancelled or error */ }
  };

  return (
    <View style={ss.imgPortraitWrap}>
      {/* Skeleton shimmer — portrait ratio while image loads */}
      {!revealed && (
        <View style={[ss.imgPortraitSkeleton, { backgroundColor: shimmerBg }]}>
          <ImageShimmer />
        </View>
      )}

      {/* Tappable portrait image */}
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={handleImagePress}
        onLongPress={handleLongPress}
        delayLongPress={380}
        disabled={!revealed}
      >
        <Animated.View style={[ss.imgPortraitReveal, imgStyle]}>
          <Image
            source={{ uri: imageData }}
            style={ss.imgPortrait}
            resizeMode="cover"
            onLoad={() => {
              setRevealed(true);
              imgOp.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) });
            }}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Action row — appears after image loads */}
      {revealed && (
        <View style={ss.imgActionsRow}>
          <TouchableOpacity onPress={handleCopy} hitSlop={8} activeOpacity={0.6}>
            <Text style={[ss.imgActionLabel, { color: actionClr }]}>Kopyala</Text>
          </TouchableOpacity>
          <Text style={[ss.imgActionDot, { color: actionClr }]}>·</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={8} activeOpacity={0.6}>
            <Text style={[ss.imgActionLabel, { color: actionClr }]}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen viewer — inline editing inside viewer */}
      <ImageViewer
        visible={viewerVisible}
        imageData={imageData}
        onClose={() => setViewerVisible(false)}
        onEdit={onEdit}
      />
    </View>
  );
}

// ─── Shimmer skeleton while image is loading ───────────────────────────────────
function ImageShimmer() {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const shimStyle = useAnimatedStyle(() => ({ opacity: 0.28 + shimmer.value * 0.28 }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", borderRadius: 16 }, shimStyle]}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function MessageBubble({ message, isLatest, onEditImage }: Props) {
  const { theme: T } = useTheme();
  const isUser = message.role === "user";

  // For image messages, skip typewriter — show text immediately
  const hasGeneratedImage = !isUser && !!message.imageData;

  // Typewriter for latest AI text-only message
  const [shown, setShown] = useState(
    (isLatest && !isUser && !hasGeneratedImage) ? "" : message.content
  );
  const idxR = useRef(0);
  const tmrR = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLatest || isUser || hasGeneratedImage) { setShown(message.content); return; }
    idxR.current = 0;
    setShown("");
    const tick = () => {
      idxR.current += 2;
      if (idxR.current <= message.content.length) {
        setShown(message.content.slice(0, idxR.current));
        tmrR.current = setTimeout(tick, 11);
      } else {
        setShown(message.content);
      }
    };
    tmrR.current = setTimeout(tick, 60);
    return () => { if (tmrR.current) clearTimeout(tmrR.current); };
  }, [message.content, isLatest, isUser, hasGeneratedImage]);

  // Timestamp fade
  const tsOp   = useSharedValue(0);
  const tsAnim = useAnimatedStyle(() => ({ opacity: tsOp.value }));
  useEffect(() => { tsOp.value = withTiming(1, { duration: 700 }); }, []);

  // ── USER BUBBLE ────────────────────────────────────────────────────────────
  if (isUser) {
    const bg = T.isDark ? "rgba(255,255,255,0.10)" : "rgba(70,70,70,0.10)";

    return (
      <Animated.View
        entering={FadeInDown.duration(280).springify().damping(18)}
        style={ss.userWrap}
      >
        {/* Photo thumbnail — shown when message was sent from camera */}
        {message.imageUri ? (
          <View style={[ss.photoBubble, { backgroundColor: bg }]}>
            <Image
              source={{ uri: message.imageUri }}
              style={ss.photoThumb}
              resizeMode="cover"
            />
            <Text style={[ss.userText, ss.photoCaption, { color: T.fg }]}>
              {message.content}
            </Text>
          </View>
        ) : (
          <View style={[ss.userBubble, { backgroundColor: bg }]}>
            <Text style={[ss.userText, { color: T.fg }]}>{message.content}</Text>
          </View>
        )}
        <Animated.Text style={[ss.ts, { color: T.zinc, marginRight: 4 }, tsAnim]}>
          {fmt(message.timestamp)}
        </Animated.Text>
      </Animated.View>
    );
  }

  // ── AI RESPONSE ─────────────────────────────────────────────────────────────
  const textClr = T.isDark ? "rgba(235,235,235,0.90)" : "#3A3A3C";

  return (
    <Animated.View
      entering={FadeInDown.duration(340).springify().damping(18)}
      style={ss.aiWrap}
    >
      {/* Generated image card — shown instead of/before text */}
      {message.imageData ? (
        <GeneratedImageCard
          imageData={message.imageData}
          caption={message.content}
          onEdit={onEditImage ? (instr) => onEditImage(message.imageData!, instr) : undefined}
        />
      ) : (
        shown === message.content
          ? <MarkdownText text={shown} color={textClr} isDark={T.isDark} />
          : <Text style={[ss.aiText, { color: textClr }]}>{shown}</Text>
      )}

      {/* Action row */}
      <View style={ss.actionRow}>
        <ActionBtn
          icon="copy"
          onPress={() => Clipboard.setStringAsync(message.content)}
        />
        {!message.imageData && <ActionBtn icon="thumbs-up"   />}
        {!message.imageData && <ActionBtn icon="thumbs-down" />}
        {!message.imageData && <SpeakBtn  text={message.content} />}
        <ActionBtn icon="share-2" />

        <Animated.Text style={[ss.aiTs, { color: T.zinc }, tsAnim]}>
          {fmt(message.timestamp)}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  // User
  userWrap: {
    alignItems:        "flex-end",
    marginBottom:      20,
    paddingHorizontal: 20,
  },
  userBubble: {
    maxWidth:                "76%",
    borderRadius:            22,
    borderBottomRightRadius: 6,
    paddingHorizontal:       16,
    paddingVertical:         12,
    shadowColor:             "#000",
    shadowOffset:            { width: 0, height: 2 },
    shadowOpacity:           0.07,
    shadowRadius:            10,
  },
  // Generated image — portrait card (AI message)
  imgPortraitWrap: {
    alignSelf:    "center",
    width:        "88%",
    marginTop:    4,
    marginBottom: 6,
  },
  imgPortraitSkeleton: {
    width:        "100%",
    aspectRatio:  4 / 5,
    maxHeight:    500,
    borderRadius: 20,
    overflow:     "hidden",
  },
  imgPortraitReveal: {
    width:        "100%",
    borderRadius: 20,
    overflow:     "hidden",
    maxHeight:    500,
  },
  imgPortrait: {
    width:       "100%",
    aspectRatio: 4 / 5,
  },
  imgActionsRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    marginTop:      10,
  },
  imgActionLabel: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },
  imgActionDot: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
  },

  // Photo message bubble — image thumbnail above caption
  photoBubble: {
    maxWidth:                "72%",
    borderRadius:            18,
    borderBottomRightRadius: 4,
    overflow:                "hidden",
    shadowColor:             "#000",
    shadowOffset:            { width: 0, height: 2 },
    shadowOpacity:           0.10,
    shadowRadius:            12,
  },
  photoThumb: {
    width:       "100%" as any,
    aspectRatio: 4 / 3,
  },
  photoCaption: {
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:          13,
    opacity:           0.72,
  },
  userText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },

  // AI — bare text
  aiWrap: {
    marginBottom:      26,
    paddingHorizontal: 24,
  },
  aiText: {
    fontSize:      15.5,
    fontFamily:    "Inter_400Regular",
    lineHeight:    26,
    letterSpacing: -0.1,
  },

  // Action icons
  actionRow: {
    flexDirection: "row",
    alignItems:    "center",
    marginTop:     12,
    gap:           20,
  },
  aiTs: {
    marginLeft:    "auto" as any,
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
  },

  // User timestamp
  ts: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    marginTop:     5,
    letterSpacing: 0.1,
  },

  // ── Edit button below image card ──────────────────────────────────────────
  editBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    alignSelf:      "flex-start",
    marginTop:      8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius:   20,
    borderWidth:    1,
    gap:            5,
  },
  editBtnLabel: {
    fontSize:   11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.2,
  },

  // ── Edit modal ─────────────────────────────────────────────────────────────
  editOverlay: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    paddingHorizontal: 20,
  },
  editCard: {
    width:         "100%",
    borderRadius:  24,
    padding:       24,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.30,
    shadowRadius:  32,
    elevation:     20,
  },
  editTitle: {
    fontSize:      18,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.4,
    marginBottom:  4,
  },
  editSub: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    marginBottom:  16,
  },
  editInput: {
    borderRadius:   14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize:       15,
    fontFamily:     "Inter_400Regular",
    lineHeight:     22,
    minHeight:      72,
    textAlignVertical: "top",
  },
  hintsScroll: {
    marginTop: 12,
  },
  hintsContent: {
    gap:              8,
    paddingHorizontal: 0,
  },
  hintPill: {
    borderRadius:      30,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  hintPillText: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.1,
  },
  editActions: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "flex-end",
    marginTop:      20,
    gap:            12,
  },
  editCancelBtn: {
    paddingVertical:   10,
    paddingHorizontal: 16,
  },
  editCancelLabel: {
    fontSize:   14,
    fontFamily: "Inter_500Medium",
  },
  editApplyBtn: {
    borderRadius:      22,
    paddingVertical:   10,
    paddingHorizontal: 22,
  },
  editApplyLabel: {
    fontSize:   14,
    fontFamily: "Inter_600SemiBold",
    color:      "#000",
  },
});
