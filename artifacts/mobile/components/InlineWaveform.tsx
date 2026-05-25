/**
 * InlineWaveform — 7 slim animated bars shown above the chat input
 * while AI is speaking. Fades in/out smoothly. Theme-aware colors.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface Props {
  active: boolean;
  color:  string;
}

// Max heights for each bar (px) — asymmetric for organic feel
const MAX_H = [14, 22, 30, 38, 30, 22, 14];
const DELAY = [0, 60, 120, 40, 150, 80, 30];
const DUR   = [340, 280, 360, 300, 320, 260, 380];

const BAR_W = 2.5;
const CONTAINER_H = 42;

export default function InlineWaveform({ active, color }: Props) {
  // 7 bars — each animates independently
  const h0 = useSharedValue(2);
  const h1 = useSharedValue(2);
  const h2 = useSharedValue(2);
  const h3 = useSharedValue(2);
  const h4 = useSharedValue(2);
  const h5 = useSharedValue(2);
  const h6 = useSharedValue(2);
  const vals = [h0, h1, h2, h3, h4, h5, h6] as const;

  const containerOp = useSharedValue(0);

  useEffect(() => {
    containerOp.value = withTiming(active ? 1 : 0, { duration: 380 });

    if (active) {
      vals.forEach((v, i) => {
        v.value = withDelay(
          DELAY[i]!,
          withRepeat(
            withSequence(
              withTiming(MAX_H[i]!, {
                duration: DUR[i]!,
                easing: Easing.inOut(Easing.sin),
              }),
              withTiming(2, {
                duration: DUR[i]!,
                easing: Easing.inOut(Easing.sin),
              })
            ),
            -1,
            true
          )
        );
      });
    } else {
      vals.forEach((v) => {
        v.value = withTiming(2, { duration: 350, easing: Easing.out(Easing.ease) });
      });
    }
  }, [active]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: containerOp.value }));

  const s0 = useAnimatedStyle(() => ({ height: h0.value }));
  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));
  const s4 = useAnimatedStyle(() => ({ height: h4.value }));
  const s5 = useAnimatedStyle(() => ({ height: h5.value }));
  const s6 = useAnimatedStyle(() => ({ height: h6.value }));
  const barStyles = [s0, s1, s2, s3, s4, s5, s6];

  return (
    <Animated.View style={[ss.container, wrapStyle]} pointerEvents="none">
      <View style={ss.row}>
        {barStyles.map((style, i) => (
          <Animated.View
            key={i}
            style={[ss.bar, { backgroundColor: color }, style]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  container: {
    alignItems: "center",
    height:     CONTAINER_H,
    justifyContent: "center",
  },
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            5,
    height:         CONTAINER_H,
  },
  bar: {
    width:        BAR_W,
    borderRadius: BAR_W / 2,
    alignSelf:    "center",
  },
});
