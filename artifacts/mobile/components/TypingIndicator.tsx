/**
 * TypingIndicator — floating glassmorphic AI typing bubble.
 * Three softly pulsing dots, no avatar circle, matches MessageBubble style.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

function usePulse(delay: number): SharedValue<number> {
  const op = useSharedValue(0.22);
  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1,    { duration: 420 }),
          withTiming(0.22, { duration: 420 }),
        ),
        -1,
        false,
      ),
    );
  }, []);
  return op;
}

export default function TypingIndicator() {
  const { theme: T } = useTheme();

  const d1 = usePulse(0);
  const d2 = usePulse(160);
  const d3 = usePulse(320);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  const bubbleBg = T.isDark ? "rgba(255,255,255,0.058)" : "rgba(255,255,255,0.92)";
  const dotClr   = T.isDark ? "rgba(255,255,255,0.55)"  : "rgba(0,0,0,0.35)";

  return (
    <View style={ss.wrapper}>
      <View style={[ss.bubble, { backgroundColor: bubbleBg, shadowColor: T.isDark ? "#39FF14" : "#000" }]}>
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s1]} />
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s2]} />
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s3]} />
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom:      16,
  },
  bubble: {
    alignSelf:           "flex-start",
    flexDirection:       "row",
    alignItems:          "center",
    gap:                 6,
    paddingHorizontal:   18,
    paddingVertical:     16,
    borderRadius:        22,
    borderBottomLeftRadius: 6,
    shadowOffset:        { width: 0, height: 2 },
    shadowOpacity:       0.06,
    shadowRadius:        14,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
});
