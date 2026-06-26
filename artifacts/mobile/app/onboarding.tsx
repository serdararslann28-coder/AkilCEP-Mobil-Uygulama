/**
 * Onboarding — AkılCEP world-class cinematic experience.
 *
 * Visual language: living white particles, flowing light, soft volumetric glow.
 * Pure black (#000000). No logos in illustrations. No humans. No robots.
 *
 * Screen 1 — AWAKENING   : particle cloud erupting from a single point of light
 * Screen 2 — THINK       : three bezier particle streams connecting flowing nodes
 * Screen 3 — UNDERSTAND  : documents, web, images converging into a stream of light
 * Screen 4 — SPEAK       : circular waveform + expanding sound ripples
 * Screen 5 — BEGIN       : monumental glowing doorway, path of light beneath
 */
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "@akilcep_onboarding_done";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get("window");

const ILL = SW * 0.82;  // illustration container — slightly larger for drama
const V   = 280;         // SVG viewBox size
const CX  = ILL / 2;    // illustration centre X (pixels)
const CY  = ILL / 2;    // illustration centre Y (pixels)

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC PSEUDO-RANDOM  (no Math.random — deterministic per seed)
// ─────────────────────────────────────────────────────────────────────────────
function dr(seed: number): number {
  return Math.abs(Math.sin(seed * 127.1 + 311.7 * Math.abs(Math.cos(seed * 0.3)))) % 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// BEZIER HELPER
// ─────────────────────────────────────────────────────────────────────────────
function cubicB(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

/** Compute n waypoints along a cubic bezier (all in V space → converted to ILL pixels) */
function bezierWp(
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x3: number, y3: number,
  n: number,
): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return {
      x: (cubicB(t, x0, cx1, cx2, x3) / V) * ILL,
      y: (cubicB(t, y0, cy1, cy2, y3) / V) * ILL,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-COMPUTED STREAM DATA  (Screen 2 — THINK)
// Three bezier curves in V=280 space; particles flow along them.
// ─────────────────────────────────────────────────────────────────────────────
const N_WP = 22; // waypoints per stream

// Stream A — central S-curve (primary, full-brightness)
const SA = bezierWp(140, 8,  210, 82,  70, 168, 140, 272, N_WP);
// Stream B — left sweep (secondary)
const SB = bezierWp( 78, 28,  22, 98, 176, 174,  78, 272, N_WP);
// Stream C — right sweep (secondary)
const SC = bezierWp(202, 28, 258,100,  104, 174, 202, 272, N_WP);

// t-key array shared by all streams
const S_TKEYS: number[] = Array.from({ length: N_WP }, (_, i) => i / (N_WP - 1));

// Pre-compute x/y offsets from ILL centre for each stream
const SA_XO = SA.map(p => p.x - CX);
const SA_YO = SA.map(p => p.y - CY);
const SB_XO = SB.map(p => p.x - CX);
const SB_YO = SB.map(p => p.y - CY);
const SC_XO = SC.map(p => p.x - CX);
const SC_YO = SC.map(p => p.y - CY);

// Key node positions (bright intersection spheres along streams)
const SA_NODE = { x: SA[Math.floor(N_WP * 0.45)].x, y: SA[Math.floor(N_WP * 0.45)].y };
const SB_NODE = { x: SB[Math.floor(N_WP * 0.45)].x, y: SB[Math.floor(N_WP * 0.45)].y };
const SC_NODE = { x: SC[Math.floor(N_WP * 0.45)].x, y: SC[Math.floor(N_WP * 0.45)].y };

// ─────────────────────────────────────────────────────────────────────────────
// PRE-COMPUTED AWAKENING PARTICLES  (Screen 1)
// 28 particles radiate upward from centre — no symmetry, fully organic.
// ─────────────────────────────────────────────────────────────────────────────
const AW_PTCLS = Array.from({ length: 28 }, (_, i) => {
  const angleDeg = -90 + (dr(i * 3) * 2 - 1) * 82;      // -172° … -8° (upward)
  const angle    = angleDeg * (Math.PI / 180);
  const dist     = 44 + dr(i * 7 + 1) * 112;              // 44 … 156 px
  return {
    endX:  CX + Math.cos(angle) * dist,
    endY:  CY + Math.sin(angle) * dist,
    delay: dr(i * 11 + 2) * 2200,
    dur:   2000 + dr(i * 13 + 3) * 1800,
    r:     1.0  + dr(i * 17 + 4) * 2.4,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// PRE-COMPUTED CIRCULAR WAVEFORM TICKS  (Screen 4 — SPEAK)
// 48 radial bars arranged in a circle, heights follow a 5-period sine wave.
// ─────────────────────────────────────────────────────────────────────────────
const N_TICKS    = 48;
const TICK_R     = V * 0.36;   // ring radius in V space
const TICK_MAX_H = 16;          // max bar height (V units)
const TICK_MIN_H = 3;           // min bar height

const TICKS = Array.from({ length: N_TICKS }, (_, i) => {
  const angle    = (i / N_TICKS) * 2 * Math.PI;
  const hFrac    = 0.5 + 0.5 * Math.sin(angle * 5);      // 5-period wave
  const h        = TICK_MIN_H + hFrac * (TICK_MAX_H - TICK_MIN_H);
  const cx       = V / 2 + TICK_R * Math.cos(angle);
  const cy       = V / 2 + TICK_R * Math.sin(angle);
  const angleDeg = angle * (180 / Math.PI);
  const opacity  = 0.22 + 0.55 * hFrac;
  return { cx, cy, h, angleDeg, opacity };
});

// ─────────────────────────────────────────────────────────────────────────────
// PRE-COMPUTED GATEWAY PATH STONES  (Screen 5 — BEGIN)
// Dots converging toward the threshold — perspective road of light.
// ─────────────────────────────────────────────────────────────────────────────
const GW2_L    = 68;    // left pillar x (V space) — wider arch
const GW2_R    = 212;   // right pillar x
const GW2_R2   = (GW2_R - GW2_L) / 2;   // 72 — semicircle radius
const GW2_TOP  = 44;    // top of arch (y, V space)
const GW2_BASE = 210;   // ground threshold (y, V space)
const GW2_CY   = GW2_TOP + GW2_R2; // pillar-top y = 116
const GW2_PATH = `M ${GW2_L} ${GW2_BASE} L ${GW2_L} ${GW2_CY} A ${GW2_R2} ${GW2_R2} 0 0 1 ${GW2_R} ${GW2_CY} L ${GW2_R} ${GW2_BASE}`;

const GW_STONES = [
  // Nearest threshold (narrow)
  { vx: 126, vy: 213, r: 2.0, baseOp: 0.88, delay: 0    },
  { vx: 154, vy: 213, r: 2.0, baseOp: 0.88, delay: 350  },
  // Middle row
  { vx: 108, vy: 224, r: 1.6, baseOp: 0.70, delay: 180  },
  { vx: 140, vy: 222, r: 1.6, baseOp: 0.70, delay: 530  },
  { vx: 170, vy: 224, r: 1.6, baseOp: 0.70, delay: 900  },
  // Wide row
  { vx:  92, vy: 236, r: 1.2, baseOp: 0.52, delay: 260  },
  { vx: 118, vy: 234, r: 1.2, baseOp: 0.52, delay: 620  },
  { vx: 150, vy: 234, r: 1.2, baseOp: 0.52, delay: 980  },
  { vx: 180, vy: 236, r: 1.2, baseOp: 0.52, delay: 1340 },
  // Far (small)
  { vx:  76, vy: 248, r: 0.8, baseOp: 0.35, delay: 440  },
  { vx: 104, vy: 246, r: 0.8, baseOp: 0.35, delay: 800  },
  { vx: 140, vy: 245, r: 0.8, baseOp: 0.35, delay: 1160 },
  { vx: 172, vy: 246, r: 0.8, baseOp: 0.35, delay: 1520 },
  { vx: 200, vy: 248, r: 0.8, baseOp: 0.35, delay: 700  },
];

const GW2_STARS: [number, number][] = [
  [46, 24], [98, 14], [168, 20], [226, 38],
  [140, 8], [64, 64], [210, 58], [84, 36], [192, 30],
];

const GW2_ASCEND: Array<{ xf: number; delay: number }> = [
  { xf: (GW2_L + (GW2_R - GW2_L) * 0.25) / V, delay: 0    },
  { xf: (GW2_L + (GW2_R - GW2_L) * 0.50) / V, delay: 800  },
  { xf: (GW2_L + (GW2_R - GW2_L) * 0.75) / V, delay: 400  },
  { xf: (GW2_L + (GW2_R - GW2_L) * 0.38) / V, delay: 1200 },
  { xf: (GW2_L + (GW2_R - GW2_L) * 0.62) / V, delay: 600  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE PARTICLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Particle erupting from ILL centre toward (endX, endY) — Screen 1 */
function AwakeningParticle({
  endX, endY, delay, dur, r,
}: { endX: number; endY: number; delay: number; dur: number; r: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.12, 0.72, 1], [0, 1, 0.80, 0]),
    transform: [
      { translateX: interpolate(anim.value, [0, 1], [0, endX - CX]) },
      { translateY: interpolate(anim.value, [0, 1], [0, endY - CY]) },
    ],
  }));
  const sz = r * 2;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - r, top: CY - r,
      width:           sz, height: sz, borderRadius: r,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.85, shadowRadius: r * 3,
    }, style]} />
  );
}

/** Particle that travels along a pre-computed bezier path — Screen 2 */
function StreamDot({
  tKeys, xOff, yOff, delay, dur, r, baseOpacity,
}: {
  tKeys: number[]; xOff: number[]; yOff: number[];
  delay: number; dur: number; r: number; baseOpacity: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.linear }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: baseOpacity * interpolate(anim.value, [0, 0.07, 0.88, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateX: interpolate(anim.value, tKeys, xOff, Extrapolation.CLAMP) },
      { translateY: interpolate(anim.value, tKeys, yOff, Extrapolation.CLAMP) },
    ],
  }));
  const sz = r * 2;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - r, top: CY - r,
      width:           sz, height: sz, borderRadius: r,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.90, shadowRadius: r * 2.5,
    }, style]} />
  );
}

/** Scatter node that floats in place — background depth for Screen 2 */
function ScatterNode({
  nx, ny, delay, dur,
}: { nx: number; ny: number; delay: number; dur: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.5, 1], [0.16, 0.70, 0.16]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -9]) }],
  }));
  const px = (nx / V) * ILL;
  const py = (ny / V) * ILL;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            px - 2.5, top: py - 2.5,
      width:           5, height: 5, borderRadius: 2.5,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.55, shadowRadius: 5,
    }, style]} />
  );
}

/** Expanding concentric ring — Screen 4 */
function RippleRing({ delay, maxR }: { delay: number; maxR: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.out(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.12, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.04, 1]) }],
  }));
  const sz = maxR * 2;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - maxR, top: CY - maxR,
      width:           sz, height: sz, borderRadius: maxR,
      borderWidth:     StyleSheet.hairlineWidth,
      borderColor:     "#FFFFFF",
    }, style]} />
  );
}

/** Floating shape wrapper — Screen 3 */
function FloatShell({
  delay, rise, children,
}: { delay: number; rise: number; children: React.ReactNode }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.5, 1], [0.50, 0.92, 0.50]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -rise]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Path stone at gateway entrance — Screen 5 */
function PathStone({
  cx, cy, r, delay, baseOp,
}: { cx: number; cy: number; r: number; delay: number; baseOp: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: baseOp * interpolate(anim.value, [0, 1], [0.62, 1.0]),
  }));
  const sz = r * 2;
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            cx - r, top: cy - r,
      width:           sz, height: sz, borderRadius: r,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.65, shadowRadius: r * 4,
    }, style]} />
  );
}

/** Gateway ascending particle through arch — Screen 5 */
function ArchParticle({ xf, delay }: { xf: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const baseY = (GW2_BASE / V) * ILL;
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.25, 1], [0, 0.88, 0]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -(ILL * 0.27)]) }],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            ILL * xf - 1.5, top: baseY - 1.5,
      width:           3, height: 3, borderRadius: 1.5,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — AWAKENING
// A single point of light erupts into a cloud of living white particles.
// ─────────────────────────────────────────────────────────────────────────────
function AwakeningIllustration() {
  const orb  = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    orb.value  = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    halo.value = withRepeat(withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(orb.value, [0, 1], [0.44, 1.0]),
    transform: [{ scale: interpolate(orb.value, [0, 1], [0.78, 1.22]) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.50, 1.0]),
  }));

  return (
    <View style={ill.center}>

      {/* SVG: volume beam + ambient */}
      <Animated.View style={[StyleSheet.absoluteFillObject, haloStyle]}>
        <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="aw_a" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#fff" stopOpacity={0.16} />
              <Stop offset="48%"  stopColor="#fff" stopOpacity={0.05} />
              <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          <Rect width={V} height={V} fill="url(#aw_a)" />
          {/* Primary beam — narrow upward cone */}
          <Path
            d={`M ${V/2} ${V/2} L ${V/2 - 18} 0 L ${V/2 + 18} 0 Z`}
            fill="#FFFFFF" fillOpacity={0.11}
          />
          {/* Secondary soft beam */}
          <Path
            d={`M ${V/2} ${V/2 + 32} L ${V/2 - 60} 0 L ${V/2 + 60} 0 Z`}
            fill="#FFFFFF" fillOpacity={0.04}
          />
          {/* Tertiary ghost beam */}
          <Path
            d={`M ${V/2} ${V/2 + 64} L ${V/2 - 105} 0 L ${V/2 + 105} 0 Z`}
            fill="#FFFFFF" fillOpacity={0.018}
          />
          {/* Downward reflection */}
          <Path
            d={`M ${V/2} ${V/2} L ${V/2 - 10} ${V} L ${V/2 + 10} ${V} Z`}
            fill="#FFFFFF" fillOpacity={0.04}
          />
        </Svg>
      </Animated.View>

      {/* Erupting particles */}
      {AW_PTCLS.map((p, i) => <AwakeningParticle key={i} {...p} />)}

      {/* Outer halo glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 64, top: CY - 64,
        width:           128, height: 128, borderRadius: 64,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.60, shadowRadius: 58,
      }, orbStyle]} />

      {/* Middle glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 28, top: CY - 28,
        width:           56, height: 56, borderRadius: 28,
        borderWidth:     StyleSheet.hairlineWidth,
        borderColor:     "rgba(255,255,255,0.38)",
        backgroundColor: "transparent",
      }, orbStyle]} />

      {/* Core: single white point */}
      <View style={{
        position:        "absolute",
        left:            CX - 5, top: CY - 5,
        width:           10, height: 10, borderRadius: 5,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1, shadowRadius: 14,
      }} />

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — THINK
// Three bezier particle streams flow from top to bottom, connecting thought-nodes.
// ─────────────────────────────────────────────────────────────────────────────
const SCATTER_NODES: Array<[number, number, number, number]> = [
  // [nx, ny, delay, dur]
  [30,  44,  0,    3200], [88,  18,  400,  2900],
  [178, 28,  200,  3400], [238, 60,  700,  2800],
  [252, 145, 500,  3100], [224, 222, 1000, 2700],
  [162, 260, 300,  3300], [82,  258, 800,  3000],
  [18,  200, 600,  2800], [8,   110, 100,  3400],
  [54,  150, 900,  2900], [216, 160, 1100, 3100],
];

const STREAM_DUR = 2900;

function ThinkIllustration() {
  const nodePulse = useSharedValue(0);
  useEffect(() => {
    nodePulse.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);
  const nodeStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(nodePulse.value, [0, 1], [0.44, 1.0]),
    transform: [{ scale: interpolate(nodePulse.value, [0, 1], [0.82, 1.22]) }],
  }));

  return (
    <View style={ill.center}>

      {/* SVG: faint bezier trail lines + ambient glow */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="th_bg" cx="50%" cy="48%" r="52%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.09} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#th_bg)" />
        {/* Stream A trail */}
        <Path d="M 140 8 C 210 82 70 168 140 272"
          fill="none" stroke="#FFFFFF" strokeWidth={0.6} strokeOpacity={0.13}
        />
        {/* Stream B trail */}
        <Path d="M 78 28 C 22 98 176 174 78 272"
          fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.08}
        />
        {/* Stream C trail */}
        <Path d="M 202 28 C 258 100 104 174 202 272"
          fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.08}
        />
      </Svg>

      {/* Background scatter nodes */}
      {SCATTER_NODES.map(([nx, ny, delay, dur], i) => (
        <ScatterNode key={i} nx={nx} ny={ny} delay={delay} dur={dur} />
      ))}

      {/* Stream A — 5 particles (primary) */}
      {Array.from({ length: 5 }, (_, i) => (
        <StreamDot key={`a${i}`}
          tKeys={S_TKEYS} xOff={SA_XO} yOff={SA_YO}
          delay={(STREAM_DUR / 5) * i} dur={STREAM_DUR}
          r={2.4} baseOpacity={1.0}
        />
      ))}

      {/* Stream B — 4 particles (secondary left) */}
      {Array.from({ length: 4 }, (_, i) => (
        <StreamDot key={`b${i}`}
          tKeys={S_TKEYS} xOff={SB_XO} yOff={SB_YO}
          delay={(STREAM_DUR / 4) * i + 240} dur={STREAM_DUR * 0.94}
          r={1.8} baseOpacity={0.68}
        />
      ))}

      {/* Stream C — 4 particles (secondary right) */}
      {Array.from({ length: 4 }, (_, i) => (
        <StreamDot key={`c${i}`}
          tKeys={S_TKEYS} xOff={SC_XO} yOff={SC_YO}
          delay={(STREAM_DUR / 4) * i + 480} dur={STREAM_DUR * 0.96}
          r={1.8} baseOpacity={0.68}
        />
      ))}

      {/* Bright intersection nodes — where streams "meet" */}
      {/* Node A (brightest — primary stream midpoint) */}
      <Animated.View style={[{
        position:        "absolute",
        left:            SA_NODE.x - 14, top: SA_NODE.y - 14,
        width:           28, height: 28, borderRadius: 14,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.80, shadowRadius: 20,
      }, nodeStyle]} />
      <View style={{
        position:        "absolute",
        left:            SA_NODE.x - 3.5, top: SA_NODE.y - 3.5,
        width:           7, height: 7, borderRadius: 3.5,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1, shadowRadius: 6,
      }} />

      {/* Node B (left stream) */}
      <Animated.View style={[{
        position:        "absolute",
        left:            SB_NODE.x - 8, top: SB_NODE.y - 8,
        width:           16, height: 16, borderRadius: 8,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.50, shadowRadius: 10,
      }, nodeStyle]} />
      <View style={{
        position:        "absolute",
        left:            SB_NODE.x - 2.5, top: SB_NODE.y - 2.5,
        width:           5, height: 5, borderRadius: 2.5,
        backgroundColor: "#FFFFFF", opacity: 0.80,
      }} />

      {/* Node C (right stream) */}
      <Animated.View style={[{
        position:        "absolute",
        left:            SC_NODE.x - 8, top: SC_NODE.y - 8,
        width:           16, height: 16, borderRadius: 8,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.50, shadowRadius: 10,
      }, nodeStyle]} />
      <View style={{
        position:        "absolute",
        left:            SC_NODE.x - 2.5, top: SC_NODE.y - 2.5,
        width:           5, height: 5, borderRadius: 2.5,
        backgroundColor: "#FFFFFF", opacity: 0.80,
      }} />

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — UNDERSTAND
// Documents, web pages and images flow into a single luminous stream of light.
// ─────────────────────────────────────────────────────────────────────────────
const CV_DOC = { x: ILL * 0.20, y: ILL * 0.24 };
const CV_WEB = { x: ILL * 0.80, y: ILL * 0.22 };
const CV_IMG = { x: ILL * 0.50, y: ILL * 0.80 };

const CV_PTCLS: Array<{ fromX: number; fromY: number; delay: number }> = [
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 0    },
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 1400 },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 480  },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 1880 },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 960  },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 2360 },
];

function ConvergeParticle({ fromX, fromY, delay }: { fromX: number; fromY: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.in(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.10, 0.80, 1], [0, 0.95, 0.72, 0]),
    transform: [
      { translateX: interpolate(anim.value, [0, 1], [fromX - CX, 0]) },
      { translateY: interpolate(anim.value, [0, 1], [fromY - CY, 0]) },
    ],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - 3, top: CY - 3,
      width:           6, height: 6, borderRadius: 3,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

function UnderstandIllustration() {
  const center = useSharedValue(0);
  useEffect(() => {
    center.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);
  const centerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(center.value, [0, 1], [0.35, 1.0]),
    transform: [{ scale: interpolate(center.value, [0, 1], [0.80, 1.20]) }],
  }));

  const docVX = (CV_DOC.x / ILL) * V;
  const docVY = (CV_DOC.y / ILL) * V;
  const webVX = (CV_WEB.x / ILL) * V;
  const webVY = (CV_WEB.y / ILL) * V;
  const imgVX = (CV_IMG.x / ILL) * V;
  const imgVY = (CV_IMG.y / ILL) * V;

  return (
    <View style={ill.center}>

      {/* SVG: ambient + dashed stream paths */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="cv_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.12} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#cv_bg)" />
        <Path
          d={`M ${docVX} ${docVY} Q ${V*0.35} ${docVY*0.82} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5}
          strokeOpacity={0.18} strokeDasharray="2,7"
        />
        <Path
          d={`M ${webVX} ${webVY} Q ${V*0.66} ${webVY*0.82} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5}
          strokeOpacity={0.18} strokeDasharray="2,7"
        />
        <Path
          d={`M ${imgVX} ${imgVY} Q ${V/2} ${imgVY*1.18} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5}
          strokeOpacity={0.18} strokeDasharray="2,7"
        />
      </Svg>

      {/* Shape 1: Document */}
      <View style={{ position: "absolute", left: CV_DOC.x - 28, top: CV_DOC.y - 38 }}>
        <FloatShell delay={0} rise={12}>
          <View style={{
            width:           56, height: 72,
            borderWidth:     StyleSheet.hairlineWidth,
            borderColor:     "rgba(255,255,255,0.60)",
            borderRadius:    6,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}>
            {[0,1,2,3,4].map(i => (
              <View key={i} style={{
                position:        "absolute",
                left:            10, top: 14 + i * 10,
                width:           i >= 4 ? 22 : i >= 3 ? 28 : 36,
                height:          0.8,
                backgroundColor: "rgba(255,255,255,0.28)",
              }} />
            ))}
          </View>
        </FloatShell>
      </View>

      {/* Shape 2: Web / Globe */}
      <View style={{ position: "absolute", left: CV_WEB.x - 32, top: CV_WEB.y - 32 }}>
        <FloatShell delay={800} rise={10}>
          <View style={{
            width:           64, height: 64,
            borderRadius:    32,
            borderWidth:     StyleSheet.hairlineWidth,
            borderColor:     "rgba(255,255,255,0.60)",
            backgroundColor: "rgba(255,255,255,0.04)",
            overflow:        "hidden",
          }}>
            <Svg width={64} height={64} viewBox="0 0 64 64">
              {/* Vertical meridian */}
              <Path d="M 32 2 Q 44 32 32 62 Q 20 32 32 2"
                fill="none" stroke="#FFFFFF" strokeWidth={0.55} strokeOpacity={0.30}
              />
              {/* Horizontal parallels */}
              <Path d="M 6 24 Q 32 18 58 24" fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.22} />
              <Path d="M 6 40 Q 32 46 58 40" fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.22} />
            </Svg>
          </View>
        </FloatShell>
      </View>

      {/* Shape 3: Image frame */}
      <View style={{ position: "absolute", left: CV_IMG.x - 40, top: CV_IMG.y - 30 }}>
        <FloatShell delay={1600} rise={14}>
          <View style={{
            width:           80, height: 60,
            borderWidth:     StyleSheet.hairlineWidth,
            borderColor:     "rgba(255,255,255,0.60)",
            borderRadius:    8,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}>
            {/* Image "horizon" — minimal landscape suggestion */}
            <View style={{
              position:        "absolute", right: 10, top: 10,
              width:           16, height: 16, borderRadius: 8,
              borderWidth:     0.7, borderColor: "rgba(255,255,255,0.38)",
            }} />
            <View style={{
              position:        "absolute", left: 10, bottom: 14,
              width:           38, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.24)",
            }} />
            <View style={{
              position:        "absolute", left: 10, bottom: 21,
              width:           26, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.14)",
            }} />
          </View>
        </FloatShell>
      </View>

      {/* Centre focal glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 32, top: CY - 32,
        width:           64, height: 64, borderRadius: 32,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.75, shadowRadius: 32,
      }, centerStyle]} />
      <View style={{
        position:        "absolute",
        left:            CX - 4.5, top: CY - 4.5,
        width:           9, height: 9, borderRadius: 4.5,
        backgroundColor: "#FFFFFF",
      }} />

      {/* Flowing convergence particles */}
      {CV_PTCLS.map((p, i) => <ConvergeParticle key={i} {...p} />)}

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — SPEAK
// Circular waveform radiates from a central orb. Expanding sound ripples.
// ─────────────────────────────────────────────────────────────────────────────
function SpeakIllustration() {
  const pulse  = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    pulse.value  = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    rotate.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false,
    );
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [0.55, 1.0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.82, 1.18]) }],
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [0.65, 1.0]),
    transform: [{ rotate: `${interpolate(rotate.value, [0, 1], [0, 360])}deg` }],
  }));

  return (
    <View style={ill.center}>

      {/* SVG: circular waveform ticks + ambient glow */}
      <Animated.View style={[StyleSheet.absoluteFillObject, tickStyle]}>
        <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="sp_bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#fff" stopOpacity={0.12} />
              <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          <Rect width={V} height={V} fill="url(#sp_bg)" />

          {/* Circular waveform ticks — 48 radial bars */}
          {TICKS.map((t, i) => (
            <Rect key={i}
              x={t.cx - 0.8}
              y={t.cy - t.h}
              width={1.6}
              height={t.h}
              fill="#FFFFFF"
              fillOpacity={t.opacity}
              transform={`rotate(${t.angleDeg + 90}, ${t.cx}, ${t.cy})`}
            />
          ))}

          {/* Inner guide circles */}
          <Circle cx={V/2} cy={V/2} r={TICK_R - 2}
            fill="none" stroke="#FFFFFF" strokeWidth={0.4} strokeOpacity={0.14}
          />
          <Circle cx={V/2} cy={V/2} r={TICK_R * 0.55}
            fill="none" stroke="#FFFFFF" strokeWidth={0.3} strokeOpacity={0.08}
          />
        </Svg>
      </Animated.View>

      {/* Expanding ripple rings */}
      {[0, 850, 1700, 2550].map((d, i) => (
        <RippleRing key={i} delay={d} maxR={CX * 0.96} />
      ))}

      {/* Central glow orb */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 36, top: CY - 36,
        width:           72, height: 72, borderRadius: 36,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.85, shadowRadius: 40,
      }, orbStyle]} />

      {/* Core bright dot */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 7, top: CY - 7,
        width:           14, height: 14, borderRadius: 7,
        backgroundColor: "#FFFFFF",
      }, orbStyle]} />

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — BEGIN
// A monumental glowing doorway opens. A path of light leads the way inside.
// ─────────────────────────────────────────────────────────────────────────────
function BeginIllustration() {
  const portalGlow = useSharedValue(0);
  const threshPl   = useSharedValue(0);

  useEffect(() => {
    portalGlow.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    threshPl.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);

  const portalStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(portalGlow.value, [0, 1], [0.20, 0.68]),
    transform: [{ scale: interpolate(portalGlow.value, [0, 1], [0.78, 1.22]) }],
  }));
  const threshStyle = useAnimatedStyle(() => ({
    opacity: interpolate(threshPl.value, [0, 1], [0.24, 0.62]),
  }));

  const gwLILL   = (GW2_L    / V) * ILL;
  const gwWILL   = ((GW2_R - GW2_L) / V) * ILL;
  const baseILL  = (GW2_BASE / V) * ILL;
  const midArchY = ((GW2_CY + GW2_BASE) / 2 / V) * ILL;

  return (
    <View style={ill.center}>

      {/* SVG: arch structure + stars + light fills */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          {/* Interior light from arch centre */}
          <RadialGradient id="gw_in" cx="50%" cy="52%" r="40%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.26} />
            <Stop offset="50%"  stopColor="#fff" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
          {/* Ground glow */}
          <RadialGradient id="gw_gnd" cx="50%" cy="90%" r="46%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>

        <Rect width={V} height={V} fill="url(#gw_in)"  />
        <Rect width={V} height={V} fill="url(#gw_gnd)" />

        {/* Arch interior — very faint fill */}
        <Path d={GW2_PATH} fill="#FFFFFF" fillOpacity={0.055} />

        {/* Arch frame — the threshold structure */}
        <Path d={GW2_PATH} fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeOpacity={0.85} />

        {/* Ground threshold bar */}
        <Line
          x1={GW2_L + 2} y1={GW2_BASE}
          x2={GW2_R - 2} y2={GW2_BASE}
          stroke="#FFFFFF" strokeWidth={3} strokeOpacity={0.55}
        />

        {/* Light spill — fan below threshold */}
        <Path
          d={`M ${V/2 - 7} ${GW2_BASE} L ${V/2 - 32} ${V+8} L ${V/2+32} ${V+8} L ${V/2+7} ${GW2_BASE} Z`}
          fill="#FFFFFF" fillOpacity={0.05}
        />

        {/* Stars above arch */}
        {GW2_STARS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y}
            r={i < 3 ? 1.6 : 1.0}
            fill="#FFFFFF"
            fillOpacity={i < 3 ? 0.72 : 0.40}
          />
        ))}
      </Svg>

      {/* Path stones — perspective road of light beneath the arch */}
      {GW_STONES.map((s, i) => (
        <PathStone key={i}
          cx={(s.vx / V) * ILL}
          cy={(s.vy / V) * ILL}
          r={(s.r / V) * ILL * 3.5}
          delay={s.delay}
          baseOp={s.baseOp}
        />
      ))}

      {/* Threshold glow band */}
      <Animated.View style={[{
        position:        "absolute",
        left:            gwLILL, top: baseILL - 16,
        width:           gwWILL, height: 32, borderRadius: 16,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.55, shadowRadius: 22,
      }, threshStyle]} />

      {/* Portal interior glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 40, top: midArchY - 40,
        width:           80, height: 80, borderRadius: 40,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.70, shadowRadius: 48,
      }, portalStyle]} />

      {/* Focal pinhole */}
      <View style={{
        position:        "absolute",
        left:            CX - 4, top: midArchY - 4,
        width:           8, height: 8, borderRadius: 4,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1, shadowRadius: 12,
      }} />

      {/* Ascending particles */}
      {GW2_ASCEND.map((p, i) => <ArchParticle key={i} xf={p.xf} delay={p.delay} />)}

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
interface ScreenCfg {
  Illustration: () => React.ReactElement;
  title:        string;
  subtitle:     string;
  showSkip:     boolean;
  buttonLabel:  string;
  isFinal?:     boolean;
}

const SCREENS: ScreenCfg[] = [
  {
    Illustration: AwakeningIllustration,
    title:        "AkılCEP",
    subtitle:     "Cebindeki akıl.",
    showSkip:     false,
    buttonLabel:  "Keşfet",
  },
  {
    Illustration: ThinkIllustration,
    title:        "Düşün.",
    subtitle:     "Her soruya daha akıllı yaklaş.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: UnderstandIllustration,
    title:        "Anla.",
    subtitle:     "Web, belgeler ve görseller tek yerde.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: SpeakIllustration,
    title:        "Konuş.",
    subtitle:     "Yazmak zorunda değilsin.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: BeginIllustration,
    title:        "Başlayalım.",
    subtitle:     "AkılCEP seninle.",
    showSkip:     false,
    buttonLabel:  "Başla",
    isFinal:      true,
  },
];

const NUM_SCREENS = SCREENS.length;

// ─────────────────────────────────────────────────────────────────────────────
// DOT INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const r    = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const size = interpolate(scrollX.value, r, [4, 7, 4],        Extrapolation.CLAMP);
    const opac = interpolate(scrollX.value, r, [0.18, 1, 0.18],  Extrapolation.CLAMP);
    return { width: size, height: size, opacity: opac };
  });
  return <Animated.View style={[ss.dot, style]} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList<number>>(null);
  const [idx, setIdx] = useState(0);
  const scrollX = useSharedValue(0);

  const goNext = useCallback(() => {
    if (idx < NUM_SCREENS - 1)
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
  }, [idx]);

  const goSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: NUM_SCREENS - 1, animated: true });
  }, []);

  const goAuth = useCallback(() => { router.replace("/auth"); }, []);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setIdx(viewableItems[0].index ?? 0);
    }, [],
  );

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
    }, [scrollX],
  );

  const renderItem = useCallback(
    ({ item: pageIdx }: { item: number }) => {
      const cfg    = SCREENS[pageIdx];
      const topPad = Platform.OS === "web" ? 20 : insets.top;
      const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

      return (
        <View style={ss.page}>

          {/* Illustration — upper area */}
          <View style={[ss.illArea, { paddingTop: topPad + 8 }]}>
            <cfg.Illustration />
          </View>

          {/* Text — lower area */}
          <View style={[ss.textArea, { paddingBottom: btmPad + 56 + 60 + 40 }]}>
            <Text style={ss.title}>{cfg.title}</Text>
            <Text style={ss.subtitle}>{cfg.subtitle}</Text>
          </View>

          {/* Skip */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 16 }]}
              onPress={goSkip}
              hitSlop={14}
              activeOpacity={0.50}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Dots */}
          <View style={[ss.dotsBar, { bottom: btmPad + 26 + 56 + 38 }]}>
            {SCREENS.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          {/* CTA Button */}
          <View style={[ss.btnBar, { bottom: btmPad + 26 }]}>
            {cfg.isFinal ? (
              <TouchableOpacity style={ss.btnFinal} onPress={goAuth} activeOpacity={0.80}>
                <Text style={ss.btnFinalLabel}>{cfg.buttonLabel}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={ss.btnSolid} onPress={goNext} activeOpacity={0.80}>
                <Text style={ss.btnSolidLabel}>{cfg.buttonLabel}</Text>
                <Text style={ss.btnArrow}> →</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      );
    },
    [insets, scrollX, goNext, goSkip, goAuth],
  );

  return (
    <FlatList
      ref={listRef}
      data={Array.from({ length: NUM_SCREENS }, (_, i) => i)}
      renderItem={renderItem}
      keyExtractor={(i) => String(i)}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const BUTTON_W = SW - 44;

const ill = StyleSheet.create({
  center: {
    width:          ILL,
    height:         ILL,
    alignItems:     "center",
    justifyContent: "center",
  },
});

const ss = StyleSheet.create({

  page: {
    width:           SW,
    height:          SH,
    backgroundColor: "#000000",
    overflow:        "hidden",
  },

  illArea: {
    flex:           5,
    alignItems:     "center",
    justifyContent: "center",
  },

  textArea: {
    flex:              3,
    paddingHorizontal: 38,
    justifyContent:    "flex-start",
    gap:               14,
  },

  // Cinematic large title
  title: {
    fontSize:      56,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.8,
    lineHeight:    62,
  },

  // Soft minimal subtitle
  subtitle: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.46)",
    letterSpacing: -0.2,
    lineHeight:    25,
  },

  skip: {
    position: "absolute",
    right:    28,
    zIndex:   10,
  },
  skipText: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.32)",
    letterSpacing: -0.1,
  },

  dotsBar: {
    position:       "absolute",
    left:           0, right: 0,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
  },
  dot: {
    borderRadius:    99,
    backgroundColor: "#FFFFFF",
  },

  btnBar: {
    position:   "absolute",
    left:       0, right: 0,
    alignItems: "center",
  },

  // Screens 1–4: large solid white pill
  btnSolid: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      100,
    paddingHorizontal: 36,
    paddingVertical:   20,
    width:             BUTTON_W,
  },
  btnSolidLabel: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.4,
  },
  btnArrow: {
    fontSize:   17,
    fontFamily: "Inter_600SemiBold",
    color:      "#000000",
  },

  // Screen 5: luminous glass pill — entering the gateway
  btnFinal: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      100,
    paddingHorizontal: 36,
    paddingVertical:   20,
    width:             BUTTON_W,
  },
  btnFinalLabel: {
    fontSize:      17,
    fontFamily:    "Inter_700Bold",
    color:         "#000000",
    letterSpacing: -0.5,
  },

});
