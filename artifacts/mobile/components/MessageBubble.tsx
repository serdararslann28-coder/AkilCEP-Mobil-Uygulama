import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Message } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const colors = useColors();
  const isUser = message.role === "user";

  const [displayedContent, setDisplayedContent] = useState(
    isLatest && !isUser ? "" : message.content
  );
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLatest || isUser) {
      setDisplayedContent(message.content);
      return;
    }
    indexRef.current = 0;
    setDisplayedContent("");

    const tick = () => {
      indexRef.current += 2;
      if (indexRef.current <= message.content.length) {
        setDisplayedContent(message.content.slice(0, indexRef.current));
        timerRef.current = setTimeout(tick, 12);
      } else {
        setDisplayedContent(message.content);
      }
    };
    timerRef.current = setTimeout(tick, 80);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message.content, isLatest, isUser]);

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).springify()}
        style={styles.userWrapper}
      >
        <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
          <Text style={[styles.userText, { color: colors.primaryForeground }]}>
            {message.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          {formatTime(message.timestamp)}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={styles.aiWrapper}
    >
      <View style={styles.aiRow}>
        <View style={[styles.aiAvatar, { borderColor: colors.border }]}>
          <View style={[styles.aiAvatarDot, { backgroundColor: colors.primary }]} />
        </View>
        <View style={[styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aiText, { color: colors.foreground }]}>
            {displayedContent}
          </Text>
        </View>
      </View>
      <Text style={[styles.aiTimestamp, { color: colors.mutedForeground }]}>
        {formatTime(message.timestamp)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  userWrapper: {
    alignItems: "flex-end",
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  userBubble: {
    maxWidth: "78%",
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginRight: 4,
  },
  aiWrapper: {
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  aiAvatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiBubble: {
    flex: 1,
    maxWidth: "80%",
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  aiText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  aiTimestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 38,
  },
});
