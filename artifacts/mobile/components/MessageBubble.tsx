/**
 * MessageBubble — premium AKILCEP chat bubbles.
 *
 * USER  → floating soft-gray glass bubble (slightly darker)
 * AI    → bare editorial text on background, NO container/card/box
 *          + minimal action row beneath (copy · like · dislike · share)
 */
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
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

// ─── Minimal action button ────────────────────────────────────────────────────
function ActionBtn({
  icon,
  onPress,
  tintOnPress,
}: {
  icon:        string;
  onPress?:    () => void;
  tintOnPress?: string;
}) {
  const { theme: T } = useTheme();
  const scale = useSharedValue(1);
  const op    = useSharedValue(0.40);
  const clrOv = useSharedValue(0); // 0 = neutral, 1 = tinted

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
      op.value = withTiming(0.40, { duration: 500 });
    });
    onPress?.();
  };

  const iconClr = T.isDark ? "rgba(255,255,255,0.70)" : "rgba(40,40,40,0.70)";

  return (
    <TouchableOpacity onPress={press} hitSlop={12} activeOpacity={1}>
      <Animated.View style={aStyle}>
        <Feather name={icon as any} size={13} color={iconClr} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MessageBubble({ message, isLatest }: Props) {
  const { theme: T } = useTheme();
  const isUser = message.role === "user";

  // Typewriter for the latest AI message
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

  // ── USER BUBBLE ──────────────────────────────────────────────────────────
  if (isUser) {
    const bubbleBg = T.isDark
      ? "rgba(255,255,255,0.10)"
      : "rgba(70,70,70,0.10)";

    return (
      <Animated.View
        entering={FadeInDown.duration(280).springify().damping(18)}
        style={ss.userWrap}
      >
        <View style={[ss.userBubble, { backgroundColor: bubbleBg }]}>
          <Text style={[ss.userText, { color: T.fg }]}>
            {message.content}
          </Text>
        </View>
        <Animated.Text style={[ss.ts, { color: T.zinc, marginRight: 4 }, tsAnim]}>
          {fmt(message.timestamp)}
        </Animated.Text>
      </Animated.View>
    );
  }

  // ── AI RESPONSE — editorial text, no container ───────────────────────────
  const textClr = T.isDark ? "rgba(235,235,235,0.90)" : "#3A3A3C";

  return (
    <Animated.View
      entering={FadeInDown.duration(340).springify().damping(18)}
      style={ss.aiWrap}
    >
      {/* Raw text — sits directly on the background */}
      <Text style={[ss.aiText, { color: textClr }]}>
        {shown}
      </Text>

      {/* Action row — appears after text */}
      <View style={ss.actionRow}>
        <ActionBtn
          icon="copy"
          onPress={() => Clipboard.setStringAsync(message.content)}
        />
        <ActionBtn icon="thumbs-up"   />
        <ActionBtn icon="thumbs-down" />
        <ActionBtn icon="share-2"     />

        {/* Timestamp — far right */}
        <Animated.Text style={[ss.aiTs, { color: T.zinc }, tsAnim]}>
          {fmt(message.timestamp)}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  // ── User
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
  userText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },

  // ── AI — no bubble
  aiWrap: {
    marginBottom:      24,
    paddingHorizontal: 24,
  },
  aiText: {
    fontSize:   15.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
    letterSpacing: -0.1,
  },

  // Action icons row
  actionRow: {
    flexDirection:  "row",
    alignItems:     "center",
    marginTop:      12,
    gap:            20,
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
