/**
 * AkılCEP — Splash Screen
 *
 * The first emotional contact between the brand and the user.
 * Nothing ornamental. Only light, particles, and a name.
 *
 * Timeline (ms):
 *   0      Black screen — absolute silence
 *   400    A single white point materialises in the dark
 *   800    It expands — slow, deliberate, like breath
 *   1200   Particles drift outward, floating without rush
 *   1600   "AkılCEP" and subtitle fade in from below
 *   2500   Screen fades to black (300 ms)
 *   2800   Navigate → /onboarding (new) or /chat (returning)
 *
 * Rules:
 *   No logo · No buttons · No cards · No gradients · No robots
 *   Only white light on pure black
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router }    from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ONBOARDING_KEY } from "@/app/onboarding";

// Retained for profile.tsx compatibility — startup sound preference key
export const STARTUP_SOUND_KEY = "@akilcep_startup_sound";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get("window");

// Optical centre — slightly above geometric centre
const OX = SW / 2;
const OY = SH * 0.40;

// Timing (ms)
const T_LIGHT      = 400;
const T_EXPAND     = 800;
const T_PARTICLES  = 1200;
const T_TEXT       = 1600;
const T_FADE_OUT   = 2500;
const T_NAVIGATE   = 2800;

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC RANDOM
// ─────────────────────────────────────────────────────────────────────────────
function dr(s: number): number {
  return Math.abs(Math.sin(s * 127.1 + 311.7 * Math.abs(Math.cos(s * 0.3)))) % 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE DATA
// ─────────────────────────────────────────────────────────────────────────────
// 14 particles — evenly fanned around the orb with natural variation
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  // Even angular distribution + small jitter for organic feel
  const baseAngle = (i / 14) * 2 * Math.PI;
  const jitter    = (dr(i * 7 + 3) - 0.5) * 0.38;
  const angle     = baseAngle + jitter;
  const dist      = 44 + dr(i * 13 + 1) * 90;
  return {
    endX:    Math.cos(angle) * dist,
    endY:    Math.sin(angle) * dist,
    delay:   T_PARTICLES + dr(i * 11 + 2) * 360,
    dur:     1400 + dr(i * 17 + 4) * 900,
    r:       1.0  + dr(i * 23 + 5) * 2.0,
    opacity: 0.36 + dr(i * 29 + 6) * 0.55,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE COMPONENT
// One-shot: appears at delay, drifts outward, stays visible through navigation
// ─────────────────────────────────────────────────────────────────────────────
function SplashParticle({
  endX, endY, delay, dur, r, opacity,
}: {
  endX: number; endY: number; delay: number;
  dur: number; r: number; opacity: number;
}) {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(delay,
      withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity * interpolate(prog.value, [0, 0.10, 1], [0, 1, 0.72]),
    transform: [
      { translateX: endX * prog.value },
      { translateY: endY * prog.value },
    ],
  }));

  const sz = r * 2;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            -r,
      top:             -r,
      width:           sz,
      height:          sz,
      borderRadius:    r,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.80,
      shadowRadius:    r * 2.8,
    }, style]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SPLASH
// ─────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {

  // ── Animation values ────────────────────────────────────────────────────
  // 0.4 s — the point of light appears
  const lightOp   = useSharedValue(0);

  // 0.8 s — it expands from a pinprick to its full size
  const expandPrg = useSharedValue(0);

  // Continuous breathing, begins once expanded (~1.4 s)
  const breathePrg = useSharedValue(0);

  // 1.6 s — text materialises, rising gently from below
  const textOp    = useSharedValue(0);
  const textY     = useSharedValue(16);

  // Master opacity — fades to black before navigation
  const masterOp  = useSharedValue(1);

  useEffect(() => {
    // ── 0.4 s: light appears (opacity in) ─────────────────────────────
    lightOp.value = withDelay(T_LIGHT,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }),
    );

    // ── 0.8 s: light expands (scale in) ───────────────────────────────
    expandPrg.value = withDelay(T_EXPAND,
      withTiming(1, { duration: 640, easing: Easing.out(Easing.ease) }),
    );

    // ── 1.4 s: breathing begins, continuous ───────────────────────────
    breathePrg.value = withDelay(T_EXPAND + 600,
      withRepeat(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    // ── 1.6 s: typography fades in, lifts slightly ────────────────────
    textOp.value = withDelay(T_TEXT,
      withTiming(1, { duration: 640, easing: Easing.out(Easing.ease) }),
    );
    textY.value = withDelay(T_TEXT,
      withTiming(0, { duration: 640, easing: Easing.out(Easing.ease) }),
    );

    // ── 2.5 s: fade to black ──────────────────────────────────────────
    masterOp.value = withDelay(T_FADE_OUT,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
    );

    // ── 2.8 s: navigate ───────────────────────────────────────────────
    const nav = setTimeout(async () => {
      // DEV: always show onboarding for UI/animation testing
      router.replace("/onboarding");
    }, T_NAVIGATE);

    return () => clearTimeout(nav);
  }, []);

  // ── Animated styles ──────────────────────────────────────────────────

  // Outer ambient bloom — appears then breathes
  const outerGlowStyle = useAnimatedStyle(() => {
    const base    = interpolate(expandPrg.value, [0, 1], [0.08, 1]);
    const breath  = interpolate(breathePrg.value, [0, 1], [1, 1.18]);
    return {
      opacity:   lightOp.value * interpolate(expandPrg.value, [0, 1], [0.30, 0.85]),
      transform: [{ scale: base * breath }],
    };
  });

  // Inner glow ring — tighter, brighter
  const innerGlowStyle = useAnimatedStyle(() => {
    const base   = interpolate(expandPrg.value, [0, 1], [0.08, 1]);
    const breath = interpolate(breathePrg.value, [0, 1], [1, 1.12]);
    return {
      opacity:   lightOp.value * interpolate(expandPrg.value, [0, 1], [0.50, 1.0]),
      transform: [{ scale: base * breath }],
    };
  });

  // Core dot — tiny, the seed of everything
  const coreStyle = useAnimatedStyle(() => {
    const scale = interpolate(expandPrg.value, [0, 0.4, 1], [0.15, 0.60, 1]);
    return {
      opacity:   lightOp.value,
      transform: [{ scale }],
    };
  });

  // Text block
  const textStyle = useAnimatedStyle(() => ({
    opacity:   textOp.value,
    transform: [{ translateY: textY.value }],
  }));

  // Master — wraps everything
  const masterStyle = useAnimatedStyle(() => ({
    opacity: masterOp.value,
  }));

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      <Animated.View style={[StyleSheet.absoluteFill, masterStyle]}>

        {/* ── Orb + particles (centred at optical centre) ── */}
        <View style={[ss.orbAnchor, { left: OX, top: OY }]}>

          {/* Outer ambient bloom */}
          <Animated.View style={[ss.outerGlow, outerGlowStyle]} />

          {/* Inner tight glow */}
          <Animated.View style={[ss.innerGlow, innerGlowStyle]} />

          {/* Core pinprick */}
          <Animated.View style={[ss.core, coreStyle]} />

          {/* Particles */}
          {PARTICLES.map((p, i) => <SplashParticle key={i} {...p} />)}

        </View>

        {/* ── Typography ── */}
        <Animated.View style={[ss.textBlock, textStyle]}>
          <Text style={ss.title}>AkılCEP</Text>
          <Text style={ss.subtitle}>Cebindeki akıl.</Text>
        </Animated.View>

      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
// Orb radii
const R_OUTER = 72;   // ambient bloom shadow
const R_INNER = 28;   // inner glow shadow
const R_CORE  = 5;    // solid white dot

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000000",
  },

  // Zero-size anchor at OX, OY — children use negative margins to centre
  orbAnchor: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
  },

  // Outer bloom — large, very soft
  outerGlow: {
    position:        "absolute",
    width:           R_OUTER * 2,
    height:          R_OUTER * 2,
    borderRadius:    R_OUTER,
    left:            -R_OUTER,
    top:             -R_OUTER,
    backgroundColor: "transparent",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.65,
    shadowRadius:    R_OUTER,
  },

  // Inner glow — crisper halo
  innerGlow: {
    position:        "absolute",
    width:           R_INNER * 2,
    height:          R_INNER * 2,
    borderRadius:    R_INNER,
    left:            -R_INNER,
    top:             -R_INNER,
    backgroundColor: "transparent",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.90,
    shadowRadius:    R_INNER * 0.9,
  },

  // Core — the original point of light
  core: {
    position:        "absolute",
    width:           R_CORE * 2,
    height:          R_CORE * 2,
    borderRadius:    R_CORE,
    left:            -R_CORE,
    top:             -R_CORE,
    backgroundColor: "#FFFFFF",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    16,
  },

  // Typography block — appears after particles
  textBlock: {
    position:      "absolute",
    left:          40,
    right:         40,
    top:           OY + R_OUTER + 52,
    gap:           12,
  },

  title: {
    fontSize:      56,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -2.2,
    lineHeight:    62,
  },

  subtitle: {
    fontSize:      16,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.36)",
    letterSpacing: -0.1,
    lineHeight:    24,
  },
});
