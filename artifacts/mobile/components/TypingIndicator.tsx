/**
 * TypingIndicator — three floating dots, no bubble container.
 * Matches the AI editorial text position (same left padding).
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
  const op = useSharedValue(0.20);
  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 400 }),
          withTiming(0.20, { duration: 400 }),
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
  const d2 = usePulse(150);
  const d3 = usePulse(300);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  const dotClr = T.isDark ? "rgba(255,255,255,0.55)" : "rgba(40,40,40,0.40)";

  return (
    <View style={ss.wrap}>
      <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s1]} />
      <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s2]} />
      <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s3]} />
    </View>
  );
}

const ss = StyleSheet.create({
  wrap: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 24,   // matches aiWrap padding
    marginBottom:      24,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
});
