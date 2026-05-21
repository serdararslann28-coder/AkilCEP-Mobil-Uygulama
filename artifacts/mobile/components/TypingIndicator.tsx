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

import { useColors } from "@/hooks/useColors";

export default function TypingIndicator() {
  const colors = useColors();

  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const anim = (sv: SharedValue<number>, delayMs: number) => {
      sv.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 })
          ),
          -1,
          false
        )
      );
    };
    anim(dot1, 0);
    anim(dot2, 160);
    anim(dot3, 320);
  }, []);

  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.aiRow}>
        <View style={[styles.avatar, { borderColor: colors.border }]}>
          <View style={[styles.avatarDot, { backgroundColor: colors.primary }]} />
        </View>
        <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Animated.View style={[styles.dot, { backgroundColor: colors.zinc400 }, dotStyle1]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.zinc400 }, dotStyle2]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.zinc400 }, dotStyle3]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
