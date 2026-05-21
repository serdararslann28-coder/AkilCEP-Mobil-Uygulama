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

  const dot1 = useSharedValue(0.25);
  const dot2 = useSharedValue(0.25);
  const dot3 = useSharedValue(0.25);

  useEffect(() => {
    const anim = (sv: SharedValue<number>, delayMs: number) => {
      sv.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380 }),
            withTiming(0.25, { duration: 380 })
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
        <View style={[styles.avatar, { backgroundColor: colors.foreground }]}>
          <View style={[styles.avatarDot, { backgroundColor: colors.background }]} />
        </View>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.card,
              shadowColor: "#000",
            },
          ]}
        >
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
