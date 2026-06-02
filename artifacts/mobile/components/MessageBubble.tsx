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
import {
  ActionSheetIOS,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
  const { theme: T } = useTheme();
  const [revealed,      setRevealed]      = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  const imgOp    = useSharedValue(0);
  const imgStyle = useAnimatedStyle(() => ({ opacity: imgOp.value }));

  // Auto-open viewer for the latest generated image
  useEffect(() => {
    if (autoOpen && revealed) {
      const t = setTimeout(() => setViewerVisible(true), 240);
      return () => clearTimeout(t);
    }
  }, [autoOpen, revealed]);

  // Open full-screen viewer
  const handleImagePress = () => {
    if (!revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerVisible(true);
  };

  // Long-press action sheet
  const handleLongPress = () => {
    if (!revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["İptal", "Görseli Kaydet", "Paylaş", "Düzenle"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) setViewerVisible(true);   // viewer → download
          if (idx === 2) setViewerVisible(true);   // viewer → share
          if (idx === 3) setViewerVisible(true);   // viewer → edit (inline in viewer)
        },
      );
    } else {
      // On Android open the viewer which contains all actions
      setViewerVisible(true);
    }
  };

  // Colors adapted to current theme
  const overlayBg  = "rgba(0,0,0,0.72)";
  const cardBg     = T.isDark ? "#161616" : "#FFFFFF";
  const labelClr   = T.isDark ? "rgba(255,255,255,0.90)" : "rgba(10,10,10,0.90)";
  const subClr     = T.isDark ? "rgba(255,255,255,0.38)" : "rgba(10,10,10,0.38)";
  const inputBg    = T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const inputClr   = T.isDark ? "rgba(255,255,255,0.90)" : "rgba(10,10,10,0.90)";
  const placeholdr = T.isDark ? "rgba(255,255,255,0.28)" : "rgba(10,10,10,0.28)";
  const pillBg     = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const pillClr    = T.isDark ? "rgba(255,255,255,0.68)" : "rgba(10,10,10,0.68)";
  const accentClr  = T.isDark ? T.accent : T.accent;

  return (
    <View style={ss.imgCardWrap}>
      {/* Skeleton shimmer while image loads */}
      {!revealed && (
        <View style={[ss.imgSkeleton, { backgroundColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]}>
          <ImageShimmer />
        </View>
      )}

      {/* Tappable image — opens full-screen viewer */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleImagePress}
        onLongPress={handleLongPress}
        delayLongPress={380}
        disabled={!revealed}
      >
        <Animated.View style={[ss.imgReveal, imgStyle]}>
          <Image
            source={{ uri: imageData }}
            style={ss.imgCard}
            resizeMode="cover"
            onLoad={() => {
              setRevealed(true);
              imgOp.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) });
            }}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Caption — dimmed */}
      {caption ? (
        <Text
          style={[
            ss.imgCaption,
            { color: T.isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" },
          ]}
          numberOfLines={3}
        >
          {caption}
        </Text>
      ) : null}

      {/* Full-screen image viewer — editing is handled inside the viewer */}
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
          autoOpen={isLatest && !isUser}
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
  // Generated image card (AI message)
  imgCardWrap: {
    marginBottom: 10,
    width:        "100%",
  },
  imgSkeleton: {
    width:        "100%",
    aspectRatio:  1,
    borderRadius: 16,
    overflow:     "hidden",
  },
  imgReveal: {
    width:        "100%",
    borderRadius: 16,
    overflow:     "hidden",
  },
  imgCard: {
    width:       "100%",
    aspectRatio: 1,
  },
  imgCaption: {
    marginTop:     8,
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    lineHeight:    18,
    letterSpacing: -0.1,
    fontStyle:     "italic",
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
