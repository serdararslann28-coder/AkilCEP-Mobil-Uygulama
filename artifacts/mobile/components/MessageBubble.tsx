/**
 * MessageBubble — warm neutral glassmorphic bubbles.
 * User: soft medium gray · AI: warm gray-white · fade-up entrance · typewriter.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Message } from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  message:   Message;
  isLatest?: boolean;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isLatest }: Props) {
  const { theme: T } = useTheme();
  const isUser = message.role === "user";

  // ── Typewriter for latest AI response ─────────────────────────────────
  const [shown, setShown] = useState(isLatest && !isUser ? "" : message.content);
  const idx   = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLatest || isUser) { setShown(message.content); return; }
    idx.current = 0;
    setShown("");
    const tick = () => {
      idx.current += 2;
      if (idx.current <= message.content.length) {
        setShown(message.content.slice(0, idx.current));
        timer.current = setTimeout(tick, 11);
      } else {
        setShown(message.content);
      }
    };
    timer.current = setTimeout(tick, 60);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [message.content, isLatest, isUser]);

  // ── Timestamp fades in softly ──────────────────────────────────────────
  const tsOp  = useSharedValue(0);
  const tsAnim = useAnimatedStyle(() => ({ opacity: tsOp.value }));
  useEffect(() => { tsOp.value = withTiming(1, { duration: 700 }); }, []);

  // ── Bubble palette — warm neutral grays, no green ─────────────────────
  // User: slightly darker medium gray
  const userBg   = T.isDark ? "rgba(255,255,255,0.11)" : "rgba(80,80,80,0.11)";
  // AI: lighter warm gray-white
  const aiBg     = T.isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.78)";
  const aiShadow = T.isDark ? 0.03 : 0.06;

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).springify().damping(18)}
        style={ss.userWrap}
      >
        <Animated.View style={[ss.userBubble, { backgroundColor: userBg }]}>
          <Text style={[ss.userText, { color: T.fg }]}>{message.content}</Text>
        </Animated.View>
        <Animated.Text style={[ss.ts, { color: T.zinc, marginRight: 4 }, tsAnim]}>
          {formatTime(message.timestamp)}
        </Animated.Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(340).springify().damping(18)}
      style={ss.aiWrap}
    >
      <Animated.View
        style={[
          ss.aiBubble,
          {
            backgroundColor: aiBg,
            shadowColor:     "#000",
            shadowOpacity:   aiShadow,
          },
        ]}
      >
        <Text style={[ss.aiText, { color: T.isDark ? T.fg : "#2C2C2E" }]}>
          {shown}
        </Text>
      </Animated.View>
      <Animated.Text style={[ss.ts, { color: T.zinc, marginLeft: 4 }, tsAnim]}>
        AkılCEP · {formatTime(message.timestamp)}
      </Animated.Text>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  // User
  userWrap: {
    alignItems:        "flex-end",
    marginBottom:      14,
    paddingHorizontal: 16,
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

  // AI
  aiWrap: {
    marginBottom:      14,
    paddingHorizontal: 16,
  },
  aiBubble: {
    alignSelf:              "flex-start",
    maxWidth:               "82%",
    borderRadius:           22,
    borderBottomLeftRadius: 6,
    paddingHorizontal:      16,
    paddingVertical:        13,
    shadowOffset:           { width: 0, height: 2 },
    shadowRadius:           14,
  },
  aiText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },

  // Shared timestamp
  ts: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    marginTop:     5,
    letterSpacing: 0.1,
  },
});
