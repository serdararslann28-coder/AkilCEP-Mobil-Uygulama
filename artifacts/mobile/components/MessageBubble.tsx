/**
 * MessageBubble — floating glassmorphic chat bubbles.
 * User: smoke gray · AI: warm white · fade-up entrance · typewriter for latest AI.
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Message } from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  message:  Message;
  isLatest?: boolean;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isLatest }: Props) {
  const { theme: T } = useTheme();
  const isUser = message.role === "user";

  // ── Typewriter effect for latest AI message ────────────────────────────
  const [displayed, setDisplayed] = useState(
    isLatest && !isUser ? "" : message.content,
  );
  const idxRef   = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLatest || isUser) {
      setDisplayed(message.content);
      return;
    }
    idxRef.current = 0;
    setDisplayed("");
    const tick = () => {
      idxRef.current += 2;
      if (idxRef.current <= message.content.length) {
        setDisplayed(message.content.slice(0, idxRef.current));
        timerRef.current = setTimeout(tick, 11);
      } else {
        setDisplayed(message.content);
      }
    };
    timerRef.current = setTimeout(tick, 60);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [message.content, isLatest, isUser]);

  // ── Bubble colours ─────────────────────────────────────────────────────
  const userBubbleBg   = T.isDark ? "rgba(255,255,255,0.10)" : "rgba(60,60,67,0.09)";
  const userTextClr    = T.fg;
  const aiBubbleBg     = T.isDark ? "rgba(255,255,255,0.058)" : "rgba(255,255,255,0.92)";
  const aiTextClr      = T.isDark ? T.fg : "#1C1C1E";

  // ── Timestamp fade-in ──────────────────────────────────────────────────
  const tsOpacity = useSharedValue(0);
  useEffect(() => {
    tsOpacity.value = withTiming(1, { duration: 600 });
  }, []);
  const tsStyle = useAnimatedStyle(() => ({ opacity: tsOpacity.value }));

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).springify().damping(18)}
        style={ss.userWrapper}
      >
        <View style={[ss.userBubble, { backgroundColor: userBubbleBg }]}>
          <Text style={[ss.userText, { color: userTextClr }]}>
            {message.content}
          </Text>
        </View>
        <Animated.Text style={[ss.timestamp, { color: T.zinc }, tsStyle]}>
          {formatTime(message.timestamp)}
        </Animated.Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(340).springify().damping(18)}
      style={ss.aiWrapper}
    >
      <View style={[ss.aiBubble, { backgroundColor: aiBubbleBg, shadowColor: T.isDark ? "#39FF14" : "#000" }]}>
        <Text style={[ss.aiText, { color: aiTextClr }]}>
          {displayed}
        </Text>
      </View>
      <Animated.Text style={[ss.aiTimestamp, { color: T.zinc }, tsStyle]}>
        AkılCEP · {formatTime(message.timestamp)}
      </Animated.Text>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  // User
  userWrapper: {
    alignItems:       "flex-end",
    marginBottom:     16,
    paddingHorizontal: 16,
  },
  userBubble: {
    maxWidth:              "76%",
    borderRadius:          22,
    borderBottomRightRadius: 6,
    paddingHorizontal:     16,
    paddingVertical:       12,
    shadowColor:           "#000",
    shadowOffset:          { width: 0, height: 2 },
    shadowOpacity:         0.08,
    shadowRadius:          10,
  },
  userText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  timestamp: {
    fontSize:   10,
    fontFamily: "Inter_400Regular",
    marginTop:  5,
    marginRight: 4,
    letterSpacing: 0.1,
  },

  // AI
  aiWrapper: {
    marginBottom:     16,
    paddingHorizontal: 16,
  },
  aiBubble: {
    alignSelf:           "flex-start",
    maxWidth:            "82%",
    borderRadius:        22,
    borderBottomLeftRadius: 6,
    paddingHorizontal:   16,
    paddingVertical:     13,
    shadowOffset:        { width: 0, height: 2 },
    shadowOpacity:       0.06,
    shadowRadius:        14,
  },
  aiText: {
    fontSize:   15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
  aiTimestamp: {
    fontSize:   10,
    fontFamily: "Inter_400Regular",
    marginTop:  6,
    marginLeft: 4,
    letterSpacing: 0.1,
  },
});
