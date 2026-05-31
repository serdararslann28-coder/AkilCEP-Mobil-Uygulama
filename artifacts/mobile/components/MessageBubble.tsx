/**
 * MessageBubble — AKILCEP premium chat bubbles.
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
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  message:   Message;
  isLatest?: boolean;
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

  const scale  = useSharedValue(1);
  const op     = useSharedValue(active ? 0.80 : 0.40);

  // sync opacity when active state changes
  useEffect(() => {
    op.value = withTiming(active ? 0.82 : 0.40, { duration: 250 });
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
      op.value = withTiming(active ? 0.82 : 0.40, { duration: 500 });
    });
    onPress?.();
  };

  const clr = T.isDark ? "rgba(255,255,255,0.80)" : "rgba(40,40,40,0.80)";

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
  const op    = useSharedValue(0.40);

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
          withTiming(0.95, { duration: 550 }),
          withTiming(0.60, { duration: 550 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      op.value    = withTiming(0.40, { duration: 300 });
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
    : T.isDark ? "rgba(255,255,255,0.80)" : "rgba(40,40,40,0.80)";

  return (
    <TouchableOpacity onPress={toggle} hitSlop={12} activeOpacity={1}>
      <Animated.View style={aStyle}>
        <Feather name="volume-2" size={13} color={clr} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function MessageBubble({ message, isLatest }: Props) {
  const { theme: T } = useTheme();
  const isUser = message.role === "user";

  // Typewriter for latest AI message
  const [shown, setShown] = useState(isLatest && !isUser ? "" : message.content);
  const idxR  = useRef(0);
  const tmrR  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLatest || isUser) { setShown(message.content); return; }
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
  }, [message.content, isLatest, isUser]);

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

  // ── AI RESPONSE — no container ─────────────────────────────────────────────
  const textClr = T.isDark ? "rgba(235,235,235,0.90)" : "#3A3A3C";

  return (
    <Animated.View
      entering={FadeInDown.duration(340).springify().damping(18)}
      style={ss.aiWrap}
    >
      {/* Editorial text — no wrapping view, no background */}
      <Text style={[ss.aiText, { color: textClr }]}>{shown}</Text>

      {/* Action row */}
      <View style={ss.actionRow}>
        <ActionBtn
          icon="copy"
          onPress={() => Clipboard.setStringAsync(message.content)}
        />
        <ActionBtn icon="thumbs-up"   />
        <ActionBtn icon="thumbs-down" />
        <SpeakBtn  text={message.content} />
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
});
