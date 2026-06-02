/**
 * ThinkingCard — bare inline AI status indicator. No card, no background.
 *
 * Phase 1 (0 → THINK_SWITCH_MS):   "AkılCEP düşünüyor..."
 * Phase 2 (THINK_SWITCH_MS → end): "AkılCEP yazıyor..."
 *
 * Passing a fixed `label` locks the text (e.g. vision mode).
 * Sequential three-dot progress: ●○○ → ●●○ → ●●● → loop.
 */
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const THINK_SWITCH_MS = 2200;  // ms before switching "düşünüyor" → "yazıyor"
const STEP_MS         = 380;   // ms per dot phase step
const FADE_MS         = 180;   // dot opacity transition duration

export default function ThinkingCard({ label }: { label?: string }) {
  const { theme: T } = useTheme();

  // ── Phase auto-advance (skipped when a fixed label is provided) ────────────
  const [isWritingPhase, setIsWritingPhase] = useState(false);

  useEffect(() => {
    if (label) return;
    const id = setTimeout(() => setIsWritingPhase(true), THINK_SWITCH_MS);
    return () => clearTimeout(id);
  }, [label]);

  const displayLabel =
    label            ? label
    : isWritingPhase ? "AkılCEP yazıyor..."
    :                  "AkılCEP düşünüyor...";

  // ── Sequential dot phase: 1=●○○  2=●●○  3=●●● ────────────────────────────
  const [dotPhase, setDotPhase] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setDotPhase(p => (p >= 3 ? 1 : p + 1)), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const op1 = useSharedValue(1.0);
  const op2 = useSharedValue(0.18);
  const op3 = useSharedValue(0.18);

  useEffect(() => {
    op1.value = withTiming(dotPhase >= 1 ? 1.0 : 0.18, { duration: FADE_MS });
    op2.value = withTiming(dotPhase >= 2 ? 1.0 : 0.18, { duration: FADE_MS });
    op3.value = withTiming(dotPhase >= 3 ? 1.0 : 0.18, { duration: FADE_MS });
  }, [dotPhase]);

  const s1 = useAnimatedStyle(() => ({ opacity: op1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: op2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: op3.value }));

  // ── Theme ──────────────────────────────────────────────────────────────────
  const leafTint = T.isDark ? "rgba(237,235,231,0.55)" : "rgba(30,30,30,0.55)";
  const labelClr = T.isDark ? "rgba(237,235,231,0.42)" : "rgba(30,30,30,0.40)";
  const dotClr   = T.isDark ? "rgba(237,235,231,0.55)" : "rgba(30,30,30,0.38)";

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify()}
      style={ss.wrap}
    >
      {/* Label row: leaf icon + phase text */}
      <View style={ss.labelRow}>
        <Image
          source={leafOnly}
          style={ss.leaf}
          tintColor={leafTint}
          resizeMode="contain"
        />
        {/* Key-driven remount triggers FadeIn/FadeOut on phase change */}
        <Animated.Text
          key={displayLabel}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          style={[ss.label, { color: labelClr }]}
        >
          {displayLabel}
        </Animated.Text>
      </View>

      {/* Sequential progress dots */}
      <View style={ss.dotsRow}>
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s1]} />
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s2]} />
        <Animated.View style={[ss.dot, { backgroundColor: dotClr }, s3]} />
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  // Matches assistant message left padding — no card, no background
  wrap: {
    paddingHorizontal: 24,
    marginBottom:      24,
    gap:               10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  leaf: {
    width:  12,
    height: 12,
  },
  label: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           7,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
});
