/**
 * ImageGenCard — branded loading card shown while AkılCEP generates an image.
 * Sequential three-dot progress: ●○○ → ●●○ → ●●● → loop.
 * PURE / VOID theme aware. Positioned like an assistant message.
 */
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const STEP_MS = 380;  // ms per phase step
const FADE_MS = 180;  // opacity transition duration

export default function ImageGenCard() {
  const { theme: T } = useTheme();

  // ── Sequential dot phase: 1=●○○  2=●●○  3=●●● ────────────────────────────
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase(p => (p >= 3 ? 1 : p + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  const op1 = useSharedValue(1.0);
  const op2 = useSharedValue(0.18);
  const op3 = useSharedValue(0.18);

  useEffect(() => {
    op1.value = withTiming(phase >= 1 ? 1.0 : 0.18, { duration: FADE_MS });
    op2.value = withTiming(phase >= 2 ? 1.0 : 0.18, { duration: FADE_MS });
    op3.value = withTiming(phase >= 3 ? 1.0 : 0.18, { duration: FADE_MS });
  }, [phase]);

  const s1 = useAnimatedStyle(() => ({ opacity: op1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: op2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: op3.value }));

  // ── Theme ──────────────────────────────────────────────────────────────────
  const cardBg   = T.isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF";
  const cardBdr  = T.isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.07)";
  const leafTint = T.isDark ? "rgba(237,235,231,0.68)"  : "#2A2A2A";
  const dotClr   = T.isDark ? "rgba(237,235,231,0.90)"  : "#1A1A1A";

  return (
    <Animated.View
      entering={FadeInDown.duration(280).springify()}
      style={[ss.card, { backgroundColor: cardBg, borderColor: cardBdr }]}
    >
      {/* Label row: leaf icon + text */}
      <View style={ss.labelRow}>
        <Image
          source={leafOnly}
          style={ss.leaf}
          tintColor={leafTint}
          resizeMode="contain"
        />
        <Text style={[ss.label, { color: T.fg }]}>AkılCEP çiziyor...</Text>
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
  card: {
    alignSelf:         "flex-start",
    marginHorizontal:  16,
    marginBottom:      20,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      18,
    borderWidth:       StyleSheet.hairlineWidth,
    gap:               12,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.07,
    shadowRadius:      14,
    elevation:         2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  leaf: {
    width:  14,
    height: 14,
  },
  label: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
});
