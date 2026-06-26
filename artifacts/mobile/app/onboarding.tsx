/**
 * AkılCEP — Onboarding
 *
 * Design philosophy:
 *   • Every animation mimics natural breath: slow, organic, inOut(sin) easing
 *   • Intelligence is represented only by living white particles and flowing light
 *   • No mechanical illustrations — only living systems
 *   • Pure black (#000000) · white light only · no colour gradients
 *   • 60px title, –2.5 tracking — the brand name fills the screen like a statement
 *
 * Screen 1 — Awakening   : particle cloud erupting from a single point of light
 * Screen 2 — Think       : neural constellation — glowing nodes connect like thoughts
 * Screen 3 — Understand  : documents, web, images converging into one stream
 * Screen 4 — Speak       : a single ring breathes, particles orbit around it
 * Screen 5 — Begin       : monumental gateway — a path of light leads the way
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
// GLOBAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get("window");

// Illustration container — square, 84% of screen width for breathing room
const ILL = SW * 0.84;
const V   = 280;       // SVG viewBox size (V × V)
const CX  = ILL / 2;  // centre X
const CY  = ILL / 2;  // centre Y

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random [0, 1) from seed — no Math.random() at runtime */
function dr(s: number): number {
  return Math.abs(Math.sin(s * 127.1 + 311.7 * Math.abs(Math.cos(s * 0.3)))) % 1;
}

/** Cubic bezier at parameter t */
function cb(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

/** Compute n waypoints along a cubic bezier — returns ILL-space coordinates */
function bezierWp(
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x3: number, y3: number, n: number,
): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: (cb(t, x0, cx1, cx2, x3) / V) * ILL, y: (cb(t, y0, cy1, cy2, y3) / V) * ILL };
  });
}

/** V-space point → offset from ILL centre */
function voff(vx: number, vy: number): { x: number; y: number } {
  return { x: (vx / V) * ILL - CX, y: (vy / V) * ILL - CY };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SCREEN 1: AWAKENING ─────────────────────────────────────────────────────
// 38 living particles float on Lissajous paths around a central orb.
// They are the continuation of the splash light — now dispersed and alive.
// ─────────────────────────────────────────────────────────────────────────────

// Golden-ratio spiral distributes particles naturally across the illustration.
// Particles closer to the centre are larger, brighter, and slower — depth effect.
const PHI = (1 + Math.sqrt(5)) / 2;

const AW_CLOUD = Array.from({ length: 38 }, (_, i) => {
  const angle  = i * PHI * 2 * Math.PI;
  // Power distribution skewed toward centre — denser inner cloud
  const rFrac  = Math.pow(dr(i * 7 + 1), 0.68);
  const dist   = rFrac * ILL * 0.43;
  // Closer particles: larger, brighter, slower drift
  const r      = Math.max(0.8, 1.1 + (1 - rFrac) * 3.6 + dr(i * 7 + 6) * 1.2);
  const op     = Math.min(0.95, 0.18 + (1 - rFrac) * 0.62 + dr(i * 7 + 7) * 0.18);
  return {
    bx:  Math.cos(angle) * dist,           // base X offset from illustration centre
    by:  Math.sin(angle) * dist,           // base Y offset
    dx:  6  + dr(i * 7 + 2) * 18,         // Lissajous drift amplitude X
    dy:  6  + dr(i * 7 + 3) * 18,         // Lissajous drift amplitude Y
    px:  dr(i * 7 + 4) * Math.PI * 2,     // phase X (distributes start positions)
    py:  dr(i * 7 + 5) * Math.PI * 2,     // phase Y
    dur: 3800 + dr(i * 7 + 6) * 5200,     // 3.8 – 9.0 s loop — feels organic
    r, op,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// ── SCREEN 2: THINK (Neural Constellation) ───────────────────────────────────
// 8 glowing nodes at natural positions. Particles travel through the network.
// ─────────────────────────────────────────────────────────────────────────────
const CNODES: Array<{ vx: number; vy: number; vr: number; delay: number; dur: number }> = [
  { vx: 70,  vy: 56,  vr: 5.0, delay: 0,    dur: 3200 },  // N0 top-left
  { vx: 210, vy: 52,  vr: 5.0, delay: 600,  dur: 2800 },  // N1 top-right
  { vx: 40,  vy: 152, vr: 4.0, delay: 1200, dur: 3400 },  // N2 left
  { vx: 240, vy: 148, vr: 4.0, delay: 300,  dur: 3100 },  // N3 right
  { vx: 140, vy: 124, vr: 8.0, delay: 400,  dur: 2600 },  // N4 centre (primary)
  { vx: 94,  vy: 228, vr: 4.5, delay: 900,  dur: 3300 },  // N5 bottom-left
  { vx: 190, vy: 224, vr: 4.5, delay: 1500, dur: 2900 },  // N6 bottom-right
  { vx: 140, vy: 22,  vr: 3.5, delay: 800,  dur: 3600 },  // N7 top-centre
];

// Traveling particle paths (3 waypoints each — through the centre node)
const CN_TKEYS = [0, 0.5, 1];
const CN_P1_XO = [voff(140, 22).x,  voff(140, 124).x, voff(94,  228).x];
const CN_P1_YO = [voff(140, 22).y,  voff(140, 124).y, voff(94,  228).y];
const CN_P2_XO = [voff(70,  56).x,  voff(140, 124).x, voff(190, 224).x];
const CN_P2_YO = [voff(70,  56).y,  voff(140, 124).y, voff(190, 224).y];
const CN_P3_XO = [voff(40, 152).x,  voff(140, 124).x, voff(240, 148).x];
const CN_P3_YO = [voff(40, 152).y,  voff(140, 124).y, voff(240, 148).y];

// ─────────────────────────────────────────────────────────────────────────────
// ── SCREEN 3: UNDERSTAND ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const CV_DOC = { x: ILL * 0.20, y: ILL * 0.22 };
const CV_WEB = { x: ILL * 0.80, y: ILL * 0.20 };
const CV_IMG = { x: ILL * 0.50, y: ILL * 0.80 };

const CV_PTCLS: Array<{ fromX: number; fromY: number; delay: number }> = [
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 0    },
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 1500 },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 500  },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 2000 },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 1000 },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 2500 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ── SCREEN 4: SPEAK ─────────────────────────────────────────────────────────
// A single ring breathes. Particles orbit slowly around it.
// ─────────────────────────────────────────────────────────────────────────────
const BREATHE_R  = ILL * 0.34;
const ORBIT_R    = ILL * 0.28;
const N_ORBITAL  = 8;

// Pre-compute orbit offsets (angle in radians, phase for opacity variation)
const ORBITAL_PTS = Array.from({ length: N_ORBITAL }, (_, i) => ({
  startAngle: (i / N_ORBITAL) * 2 * Math.PI,
  r: 1.6 + dr(i * 31) * 1.4,
}));

// ─────────────────────────────────────────────────────────────────────────────
// ── SCREEN 5: BEGIN (Gateway) ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const GW_L    = 66;
const GW_R    = 214;
const GW_R2   = (GW_R - GW_L) / 2;   // 74
const GW_TOP  = 42;
const GW_CY   = GW_TOP + GW_R2;       // 116
const GW_BASE = 212;
const GW_PATH = `M ${GW_L} ${GW_BASE} L ${GW_L} ${GW_CY} A ${GW_R2} ${GW_R2} 0 0 1 ${GW_R} ${GW_CY} L ${GW_R} ${GW_BASE}`;

const GW_STONES = [
  { vx: 122, vy: 215, r: 2.0, baseOp: 0.90, delay: 0    },
  { vx: 158, vy: 215, r: 2.0, baseOp: 0.90, delay: 350  },
  { vx: 104, vy: 226, r: 1.6, baseOp: 0.70, delay: 180  },
  { vx: 140, vy: 224, r: 1.6, baseOp: 0.70, delay: 530  },
  { vx: 175, vy: 226, r: 1.6, baseOp: 0.70, delay: 900  },
  { vx:  88, vy: 238, r: 1.1, baseOp: 0.50, delay: 260  },
  { vx: 114, vy: 236, r: 1.1, baseOp: 0.50, delay: 620  },
  { vx: 151, vy: 236, r: 1.1, baseOp: 0.50, delay: 980  },
  { vx: 182, vy: 238, r: 1.1, baseOp: 0.50, delay: 1340 },
  { vx:  74, vy: 250, r: 0.8, baseOp: 0.32, delay: 440  },
  { vx: 102, vy: 248, r: 0.8, baseOp: 0.32, delay: 800  },
  { vx: 140, vy: 247, r: 0.8, baseOp: 0.32, delay: 1160 },
  { vx: 173, vy: 248, r: 0.8, baseOp: 0.32, delay: 520  },
  { vx: 200, vy: 250, r: 0.8, baseOp: 0.32, delay: 1000 },
];

const GW_STARS: [number, number][] = [
  [44, 22], [96, 12], [170, 18], [228, 36],
  [140, 6], [62, 60], [212, 54], [82, 34], [196, 28],
];

const GW_ASCEND: Array<{ xf: number; delay: number }> = [
  { xf: (GW_L + (GW_R - GW_L) * 0.25) / V, delay: 0    },
  { xf: (GW_L + (GW_R - GW_L) * 0.50) / V, delay: 900  },
  { xf: (GW_L + (GW_R - GW_L) * 0.75) / V, delay: 450  },
  { xf: (GW_L + (GW_R - GW_L) * 0.38) / V, delay: 1350 },
  { xf: (GW_L + (GW_R - GW_L) * 0.62) / V, delay: 650  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE ANIMATED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Living particle floating on a Lissajous path — Screen 1 Awakening.
 *
 * Each particle continuously traces its own organic elliptical path around
 * a base position. Independent X/Y frequencies + phase offsets make each
 * particle's trajectory unique — no two move the same way.
 *
 * Math notes:
 *   t  = anim.value × 2π  (linear 0→1 maps to a full cycle)
 *   x  = bx + dx × sin(t + px)
 *   y  = by + dy × cos(t + py)   ← cos gives 90° offset from sin → ellipse
 *   op varies at half the spatial frequency — a slow brightness pulse
 */
function CloudParticle({
  bx, by, dx, dy, px, py, dur, r, op,
}: {
  bx: number; by: number; dx: number; dy: number;
  px: number; py: number; dur: number; r: number; op: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withRepeat(
      withTiming(1, { duration: dur, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const sz = r * 2;
  const style = useAnimatedStyle(() => {
    "worklet";
    const t   = anim.value * 2 * Math.PI;
    const opa = op * (0.50 + 0.50 * Math.sin(t * 0.5 + px));
    return {
      opacity:   Math.max(0, opa),
      transform: [
        { translateX: bx + dx * Math.sin(t + px) },
        { translateY: by + dy * Math.cos(t + py) },
      ],
    };
  });

  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - r,
      top:             CY - r,
      width:           sz,
      height:          sz,
      borderRadius:    r,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.80,
      shadowRadius:    r * 3.2,
    }, style]} />
  );
}

/** Glowing neural-network node — Screen 2 */
function ConstellationNode({
  vx, vy, vr, delay, dur,
}: { vx: number; vy: number; vr: number; delay: number; dur: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const px    = (vx / V) * ILL;
  const py    = (vy / V) * ILL;
  const r     = (vr / V) * ILL;
  const glowR = r * 5;
  const glowStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 1], [0.18, 0.88]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.70, 1.30]) }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 1], [0.65, 1.0]),
  }));
  return (
    <>
      <Animated.View style={[{
        position: "absolute",
        left: px - glowR, top: py - glowR,
        width: glowR * 2, height: glowR * 2, borderRadius: glowR,
        backgroundColor: "transparent",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.80, shadowRadius: glowR * 0.7,
      }, glowStyle]} />
      <Animated.View style={[{
        position: "absolute",
        left: px - r, top: py - r,
        width: r * 2, height: r * 2, borderRadius: r,
        backgroundColor: "#FFFFFF",
      }, coreStyle]} />
    </>
  );
}

/** Particle that travels along a pre-computed path (interpolated waypoints) */
function TravelDot({
  tKeys, xOff, yOff, delay, dur, r, baseOpacity,
}: {
  tKeys: number[]; xOff: number[]; yOff: number[];
  delay: number; dur: number; r: number; baseOpacity: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: baseOpacity * interpolate(anim.value, [0, 0.08, 0.88, 1], [0, 1, 0.88, 0]),
    transform: [
      { translateX: interpolate(anim.value, tKeys, xOff, Extrapolation.CLAMP) },
      { translateY: interpolate(anim.value, tKeys, yOff, Extrapolation.CLAMP) },
    ],
  }));
  const sz = r * 2;
  return (
    <Animated.View style={[{
      position: "absolute", left: CX - r, top: CY - r,
      width: sz, height: sz, borderRadius: r,
      backgroundColor: "#FFFFFF",
      shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.90, shadowRadius: r * 2.5,
    }, style]} />
  );
}

/** Soft floating wrapper — Screen 3 */
function FloatShell({
  delay, rise, children,
}: { delay: number; rise: number; children: React.ReactNode }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.5, 1], [0.46, 0.92, 0.46]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -rise]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Particle converging from a card toward the focal point — Screen 3 */
function ConvergeParticle({ fromX, fromY, delay }: { fromX: number; fromY: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.in(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.10, 0.82, 1], [0, 0.95, 0.75, 0]),
    transform: [
      { translateX: interpolate(anim.value, [0, 1], [fromX - CX, 0]) },
      { translateY: interpolate(anim.value, [0, 1], [fromY - CY, 0]) },
    ],
  }));
  return (
    <Animated.View style={[{
      position: "absolute", left: CX - 3, top: CY - 3,
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

/** Single orbital particle circling the breathing ring — Screen 4 */
function OrbitalParticle({ startAngle, r }: { startAngle: number; r: number }) {
  const angle = useSharedValue(startAngle);
  useEffect(() => {
    angle.value = withRepeat(
      withTiming(startAngle + 2 * Math.PI, {
        duration: 14000 + r * 2000,
        easing: Easing.linear,
      }), -1, false,
    );
  }, []);
  const sz = r * 2;
  const style = useAnimatedStyle(() => {
    "worklet";
    const opacity = 0.28 + 0.55 * ((Math.sin(angle.value * 2.5 + startAngle) + 1) / 2);
    return {
      opacity,
      transform: [
        { translateX: ORBIT_R * Math.cos(angle.value) },
        { translateY: ORBIT_R * Math.sin(angle.value) },
      ],
    };
  });
  return (
    <Animated.View style={[{
      position: "absolute",
      left: CX - r, top: CY - r,
      width: sz, height: sz, borderRadius: r,
      backgroundColor: "#FFFFFF",
      shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.80, shadowRadius: r * 3,
    }, style]} />
  );
}

/** Expanding concentric ring emanating outward — Screen 4 */
function RippleRing({ delay }: { delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.out(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const maxR = CX * 0.95;
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.10, 1], [0, 0.48, 0]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.04, 1]) }],
  }));
  return (
    <Animated.View style={[{
      position: "absolute",
      left: CX - maxR, top: CY - maxR,
      width: maxR * 2, height: maxR * 2, borderRadius: maxR,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "#FFFFFF",
    }, style]} />
  );
}

/** Perspective path stone leading to the gateway — Screen 5 */
function PathStone({ vx, vy, r, baseOp, delay }: {
  vx: number; vy: number; r: number; baseOp: number; delay: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const px = (vx / V) * ILL;
  const py = (vy / V) * ILL;
  const pr = (r  / V) * ILL * 4;
  const style = useAnimatedStyle(() => ({
    opacity: baseOp * interpolate(anim.value, [0, 1], [0.58, 1.0]),
  }));
  return (
    <Animated.View style={[{
      position: "absolute",
      left: px - pr, top: py - pr,
      width: pr * 2, height: pr * 2, borderRadius: pr,
      backgroundColor: "#FFFFFF",
      shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.65, shadowRadius: pr * 3,
    }, style]} />
  );
}

/** Particle ascending through the arch — Screen 5 */
function ArchParticle({ xf, delay }: { xf: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const baseY = (GW_BASE / V) * ILL;
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.25, 1], [0, 0.90, 0]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -ILL * 0.26]) }],
  }));
  return (
    <Animated.View style={[{
      position: "absolute",
      left: ILL * xf - 1.5, top: baseY - 1.5,
      width: 3, height: 3, borderRadius: 1.5,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — AWAKENING
//
// The white light from the Splash Screen has dispersed — the intelligence
// is now alive in the particles. 38 particles float on individual Lissajous
// paths, each breathing at its own rhythm. The central orb is the origin:
// quieter now, but still glowing. Depth is created by particle size and
// brightness — inner particles are larger and brighter than outer ones.
// ─────────────────────────────────────────────────────────────────────────────
function AwakeningIllustration() {
  // Three independent breath timers for orb layers
  const breathA = useSharedValue(0);
  const breathB = useSharedValue(0);
  const breathC = useSharedValue(0);

  useEffect(() => {
    // Outer ambient — slowest, widest swing
    breathA.value = withRepeat(
      withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    // Inner halo — slightly faster
    breathB.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    // Core — subtle pulsing brightness
    breathC.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);

  // Outer bloom: large, very soft, breathes slowly
  const outerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breathA.value, [0, 1], [0.28, 0.72]),
    transform: [{ scale: interpolate(breathA.value, [0, 1], [0.82, 1.18]) }],
  }));

  // Inner glow ring: crisper boundary of the source
  const innerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breathB.value, [0, 1], [0.38, 0.90]),
    transform: [{ scale: interpolate(breathB.value, [0, 1], [0.88, 1.12]) }],
  }));

  // Razor-thin ring: the orb's silhouette
  const ringStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breathB.value, [0, 1], [0.20, 0.52]),
    transform: [{ scale: interpolate(breathB.value, [0, 1], [0.90, 1.10]) }],
  }));

  // Core dot: very tight breathing — it feels alive
  const coreStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breathC.value, [0, 1], [0.72, 1.0]),
    transform: [{ scale: interpolate(breathC.value, [0, 1], [0.90, 1.10]) }],
  }));

  return (
    <View style={illSt.centre}>

      {/* Ambient background — very faint radial atmosphere */}
      <Svg
        width={ILL} height={ILL}
        viewBox={`0 0 ${V} ${V}`}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="aw1_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.14} />
            <Stop offset="42%"  stopColor="#fff" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#aw1_bg)" />
      </Svg>

      {/* 38 living particles — each traces a unique Lissajous path */}
      {AW_CLOUD.map((p, i) => <CloudParticle key={i} {...p} />)}

      {/* Outer ambient bloom — the aura of the source */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 80, top: CY - 80,
        width:           160, height: 160, borderRadius: 80,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.55,
        shadowRadius:    72,
      }, outerStyle]} />

      {/* Inner glow — tighter halo */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 36, top: CY - 36,
        width:           72, height: 72, borderRadius: 36,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.85,
        shadowRadius:    32,
      }, innerStyle]} />

      {/* Razor ring — orb boundary, very faint */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 22, top: CY - 22,
        width:           44, height: 44, borderRadius: 22,
        borderWidth:     StyleSheet.hairlineWidth,
        borderColor:     "rgba(255,255,255,0.55)",
        backgroundColor: "transparent",
      }, ringStyle]} />

      {/* Core — the original point of light from the splash */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 6, top: CY - 6,
        width:           12, height: 12, borderRadius: 6,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1,
        shadowRadius:    14,
      }, coreStyle]} />

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — THINK (Neural Constellation)
// 8 glowing nodes breathe independently. Particles travel through the network.
// ─────────────────────────────────────────────────────────────────────────────
function ThinkIllustration() {
  return (
    <View style={illSt.centre}>
      {/* SVG: static connection lines */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="th_bg" cx="50%" cy="44%" r="54%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.10} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#th_bg)" />

        {/* Primary spoke connections (to centre N4) */}
        <Path fill="none" stroke="#FFFFFF" strokeWidth={0.55} strokeOpacity={0.20}
          d="M 140 22 Q 152 78 140 124
             M 70 56 Q 100 88 140 124
             M 210 52 Q 184 86 140 124
             M 40 152 Q 86 140 140 124
             M 240 148 Q 196 138 140 124
             M 140 124 Q 118 172 94 228
             M 140 124 Q 164 170 190 224"
        />
        {/* Outer connections */}
        <Path fill="none" stroke="#FFFFFF" strokeWidth={0.40} strokeOpacity={0.10}
          d="M 70 56 Q 140 32 210 52
             M 94 228 Q 142 248 190 224
             M 70 56 Q 54 104 40 152
             M 210 52 Q 228 102 240 148"
        />
      </Svg>

      {/* 8 pulsing constellation nodes */}
      {CNODES.map((n, i) => <ConstellationNode key={i} {...n} />)}

      {/* Traveling particles — 3 paths through the network */}
      <TravelDot tKeys={CN_TKEYS} xOff={CN_P1_XO} yOff={CN_P1_YO}
        delay={0}    dur={3400} r={2.4} baseOpacity={1.0} />
      <TravelDot tKeys={CN_TKEYS} xOff={CN_P1_XO} yOff={CN_P1_YO}
        delay={1700} dur={3400} r={2.4} baseOpacity={0.72} />

      <TravelDot tKeys={CN_TKEYS} xOff={CN_P2_XO} yOff={CN_P2_YO}
        delay={600}  dur={3200} r={2.2} baseOpacity={0.90} />
      <TravelDot tKeys={CN_TKEYS} xOff={CN_P2_XO} yOff={CN_P2_YO}
        delay={2200} dur={3200} r={2.2} baseOpacity={0.60} />

      <TravelDot tKeys={CN_TKEYS} xOff={CN_P3_XO} yOff={CN_P3_YO}
        delay={1200} dur={3600} r={2.0} baseOpacity={0.80} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — UNDERSTAND
// Documents, images, web — each a floating card — converge into one focal point.
// ─────────────────────────────────────────────────────────────────────────────
function UnderstandIllustration() {
  const centre = useSharedValue(0);
  useEffect(() => {
    centre.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);
  const centreStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(centre.value, [0, 1], [0.30, 1.0]),
    transform: [{ scale: interpolate(centre.value, [0, 1], [0.78, 1.22]) }],
  }));

  const docVX = (CV_DOC.x / ILL) * V;
  const docVY = (CV_DOC.y / ILL) * V;
  const webVX = (CV_WEB.x / ILL) * V;
  const webVY = (CV_WEB.y / ILL) * V;
  const imgVX = (CV_IMG.x / ILL) * V;
  const imgVY = (CV_IMG.y / ILL) * V;

  return (
    <View style={illSt.centre}>
      {/* SVG: dashed stream paths */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="cv_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#cv_bg)" />
        <Path d={`M ${docVX} ${docVY} Q ${V*0.34} ${V*0.38} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeOpacity={0.20} strokeDasharray="2,8" />
        <Path d={`M ${webVX} ${webVY} Q ${V*0.66} ${V*0.36} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeOpacity={0.20} strokeDasharray="2,8" />
        <Path d={`M ${imgVX} ${imgVY} Q ${V/2} ${imgVY*1.14} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeOpacity={0.20} strokeDasharray="2,8" />
      </Svg>

      {/* Document card */}
      <View style={{ position: "absolute", left: CV_DOC.x - 28, top: CV_DOC.y - 38 }}>
        <FloatShell delay={0} rise={13}>
          <View style={{
            width: 56, height: 72, borderRadius: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.62)",
            backgroundColor: "rgba(255,255,255,0.042)",
          }}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={{
                position: "absolute",
                left: 10, top: 14 + i * 10,
                width: i >= 4 ? 20 : i >= 3 ? 28 : 36,
                height: 0.8,
                backgroundColor: "rgba(255,255,255,0.28)",
              }} />
            ))}
          </View>
        </FloatShell>
      </View>

      {/* Globe / web card */}
      <View style={{ position: "absolute", left: CV_WEB.x - 32, top: CV_WEB.y - 34 }}>
        <FloatShell delay={1100} rise={10}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.62)",
            backgroundColor: "rgba(255,255,255,0.042)",
            overflow: "hidden",
          }}>
            <Svg width={64} height={64} viewBox="0 0 64 64">
              <Path d="M 32 3 Q 46 32 32 61 Q 18 32 32 3"
                fill="none" stroke="#FFFFFF" strokeWidth={0.55} strokeOpacity={0.30} />
              <Path d="M 5 24 Q 32 18 59 24"
                fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.22} />
              <Path d="M 5 40 Q 32 46 59 40"
                fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.22} />
              <Circle cx="32" cy="32" r="29" fill="none"
                stroke="#FFFFFF" strokeWidth={0.55} strokeOpacity={0.18} />
            </Svg>
          </View>
        </FloatShell>
      </View>

      {/* Image card */}
      <View style={{ position: "absolute", left: CV_IMG.x - 42, top: CV_IMG.y - 32 }}>
        <FloatShell delay={2200} rise={15}>
          <View style={{
            width: 84, height: 64, borderRadius: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.62)",
            backgroundColor: "rgba(255,255,255,0.042)",
          }}>
            <View style={{
              position: "absolute", right: 12, top: 12,
              width: 18, height: 18, borderRadius: 9,
              borderWidth: 0.7, borderColor: "rgba(255,255,255,0.40)",
            }} />
            <View style={{
              position: "absolute", left: 10, bottom: 18,
              width: 40, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.26)",
            }} />
            <View style={{
              position: "absolute", left: 10, bottom: 25,
              width: 28, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.16)",
            }} />
          </View>
        </FloatShell>
      </View>

      {/* Centre focal glow */}
      <Animated.View style={[{
        position: "absolute", left: CX-36, top: CY-36,
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: "transparent",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.80, shadowRadius: 36,
      }, centreStyle]} />
      <View style={{
        position: "absolute", left: CX-5, top: CY-5,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: "#FFFFFF",
      }} />

      {/* Converging particles */}
      {CV_PTCLS.map((p, i) => <ConvergeParticle key={i} {...p} />)}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — SPEAK
// A single ring breathes slowly. 8 particles orbit around it like a voice.
// ─────────────────────────────────────────────────────────────────────────────
function SpeakIllustration() {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 4400, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  const mainRingStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breath.value, [0, 1], [0.55, 1.0]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.88, 1.12]) }],
  }));
  const midRingStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breath.value, [0, 1], [0.22, 0.46]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.91, 1.07]) }],
  }));
  const innerRingStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breath.value, [0, 1], [0.12, 0.28]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.94, 1.04]) }],
  }));
  const orbStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(breath.value, [0, 1], [0.55, 1.0]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.80, 1.20]) }],
  }));

  const R  = BREATHE_R;
  const R2 = R * 0.68;
  const R3 = R * 0.42;

  return (
    <View style={illSt.centre}>
      {/* Ambient background radial glow */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="sp_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#sp_bg)" />
      </Svg>

      {/* Expanding ripple rings */}
      {[0, 1050, 2100, 3150].map((d, i) => <RippleRing key={i} delay={d} />)}

      {/* Primary breathing ring */}
      <Animated.View style={[{
        position: "absolute", left: CX-R, top: CY-R,
        width: R*2, height: R*2, borderRadius: R,
        borderWidth: StyleSheet.hairlineWidth * 1.5,
        borderColor: "#FFFFFF",
      }, mainRingStyle]} />

      {/* Middle ring */}
      <Animated.View style={[{
        position: "absolute", left: CX-R2, top: CY-R2,
        width: R2*2, height: R2*2, borderRadius: R2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#FFFFFF",
      }, midRingStyle]} />

      {/* Inner ring */}
      <Animated.View style={[{
        position: "absolute", left: CX-R3, top: CY-R3,
        width: R3*2, height: R3*2, borderRadius: R3,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#FFFFFF",
      }, innerRingStyle]} />

      {/* Orbiting particles */}
      {ORBITAL_PTS.map((p, i) => (
        <OrbitalParticle key={i} startAngle={p.startAngle} r={p.r} />
      ))}

      {/* Central orb glow */}
      <Animated.View style={[{
        position: "absolute", left: CX-28, top: CY-28,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: "transparent",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.90, shadowRadius: 32,
      }, orbStyle]} />

      {/* Core dot */}
      <Animated.View style={[{
        position: "absolute", left: CX-7, top: CY-7,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: "#FFFFFF",
      }, orbStyle]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — BEGIN
// A monumental glowing gateway. A path of light leads toward endless brightness.
// ─────────────────────────────────────────────────────────────────────────────
function BeginIllustration() {
  const glow    = useSharedValue(0);
  const thresh  = useSharedValue(0);
  useEffect(() => {
    glow.value   = withRepeat(withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.sin) }), -1, true);
    thresh.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const portalStyle  = useAnimatedStyle(() => ({
    opacity:   interpolate(glow.value,   [0, 1], [0.18, 0.65]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.76, 1.24]) }],
  }));
  const threshStyle  = useAnimatedStyle(() => ({
    opacity: interpolate(thresh.value, [0, 1], [0.22, 0.60]),
  }));

  const gwLILL   = (GW_L   / V) * ILL;
  const gwWILL   = ((GW_R - GW_L) / V) * ILL;
  const baseILL  = (GW_BASE / V) * ILL;
  const archMidY = ((GW_CY + GW_BASE) / 2 / V) * ILL;

  return (
    <View style={illSt.centre}>
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="gw_in" cx="50%" cy="50%" r="44%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.28} />
            <Stop offset="55%"  stopColor="#fff" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
          <RadialGradient id="gw_gnd" cx="50%" cy="92%" r="44%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.20} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#gw_in)"  />
        <Rect width={V} height={V} fill="url(#gw_gnd)" />

        {/* Arch interior fill */}
        <Path d={GW_PATH} fill="#FFFFFF" fillOpacity={0.06} />

        {/* Arch structure */}
        <Path d={GW_PATH} fill="none" stroke="#FFFFFF"
          strokeWidth={1.5} strokeOpacity={0.88} />

        {/* Threshold ground bar */}
        <Line x1={GW_L+3} y1={GW_BASE} x2={GW_R-3} y2={GW_BASE}
          stroke="#FFFFFF" strokeWidth={3.5} strokeOpacity={0.60} />

        {/* Light spill downward */}
        <Path
          d={`M ${V/2-8} ${GW_BASE} L ${V/2-36} ${V+10} L ${V/2+36} ${V+10} L ${V/2+8} ${GW_BASE} Z`}
          fill="#FFFFFF" fillOpacity={0.046} />

        {/* Stars */}
        {GW_STARS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y}
            r={i < 3 ? 1.7 : 1.0} fill="#FFFFFF"
            fillOpacity={i < 3 ? 0.76 : 0.42} />
        ))}
      </Svg>

      {/* Path stones — perspective road of light */}
      {GW_STONES.map((s, i) => <PathStone key={i} {...s} />)}

      {/* Threshold glow bar */}
      <Animated.View style={[{
        position: "absolute",
        left: gwLILL, top: baseILL - 18,
        width: gwWILL, height: 36, borderRadius: 18,
        backgroundColor: "transparent",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.60, shadowRadius: 24,
      }, threshStyle]} />

      {/* Portal interior radiance */}
      <Animated.View style={[{
        position: "absolute", left: CX-44, top: archMidY-44,
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: "transparent",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75, shadowRadius: 54,
      }, portalStyle]} />

      {/* Focal pinhole */}
      <View style={{
        position: "absolute", left: CX-4.5, top: archMidY-4.5,
        width: 9, height: 9, borderRadius: 4.5,
        backgroundColor: "#FFFFFF",
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1, shadowRadius: 14,
      }} />

      {/* Ascending particles */}
      {GW_ASCEND.map((p, i) => <ArchParticle key={i} {...p} />)}
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
    title: "AkılCEP", subtitle: "Cebindeki akıl.",
    showSkip: false, buttonLabel: "Devam Et",
  },
  {
    Illustration: ThinkIllustration,
    title: "Düşün.", subtitle: "Her soruya daha akıllı yaklaş.",
    showSkip: true, buttonLabel: "Devam",
  },
  {
    Illustration: UnderstandIllustration,
    title: "Anla.", subtitle: "Web, belgeler ve görseller tek yerde.",
    showSkip: true, buttonLabel: "Devam",
  },
  {
    Illustration: SpeakIllustration,
    title: "Konuş.", subtitle: "Yazmak zorunda değilsin.",
    showSkip: true, buttonLabel: "Devam",
  },
  {
    Illustration: BeginIllustration,
    title: "Başlayalım.", subtitle: "AkılCEP seninle.",
    showSkip: false, buttonLabel: "Başla", isFinal: true,
  },
];

const NUM = SCREENS.length;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function PageDot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const r   = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const sz  = interpolate(scrollX.value, r, [4, 8, 4],        Extrapolation.CLAMP);
    const op  = interpolate(scrollX.value, r, [0.16, 1, 0.16],  Extrapolation.CLAMP);
    return { width: sz, opacity: op };
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
    if (idx < NUM - 1)
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
  }, [idx]);

  const goSkip = useCallback(() => {
    listRef.current?.scrollToIndex({ index: NUM - 1, animated: true });
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
    ({ item: pi }: { item: number }) => {
      const cfg    = SCREENS[pi];
      const topPad = Platform.OS === "web" ? 20 : insets.top;
      const btmPad = Platform.OS === "web" ? 40 : insets.bottom;

      return (
        <View style={ss.page}>

          {/* Illustration — upper 58% */}
          <View style={[ss.illArea, { paddingTop: topPad + 6 }]}>
            <cfg.Illustration />
          </View>

          {/* Text — lower 42% */}
          <View style={[ss.textArea, { paddingBottom: btmPad + 68 + 64 + 40 }]}>
            <Text style={ss.title}>{cfg.title}</Text>
            <Text style={ss.subtitle}>{cfg.subtitle}</Text>
          </View>

          {/* Skip */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 18 }]}
              onPress={goSkip}
              hitSlop={16}
              activeOpacity={0.45}
            >
              <Text style={ss.skipTxt}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Dots */}
          <View style={[ss.dots, { bottom: btmPad + 30 + 68 + 40 }]}>
            {SCREENS.map((_, i) => <PageDot key={i} index={i} scrollX={scrollX} />)}
          </View>

          {/* CTA */}
          <View style={[ss.btnBar, { bottom: btmPad + 30 }]}>
            {cfg.isFinal
              ? (
                <FinalButton onPress={goAuth} label={cfg.buttonLabel} />
              ) : (
                <TouchableOpacity style={ss.btnSolid} onPress={goNext} activeOpacity={0.80}>
                  <Text style={ss.btnSolidLbl}>{cfg.buttonLabel}</Text>
                  <Text style={ss.btnArrow}> →</Text>
                </TouchableOpacity>
              )
            }
          </View>

        </View>
      );
    },
    [insets, scrollX, goNext, goSkip, goAuth],
  );

  return (
    <FlatList
      ref={listRef}
      data={Array.from({ length: NUM }, (_, i) => i)}
      renderItem={renderItem}
      keyExtractor={(i) => String(i)}
      horizontal pagingEnabled bounces={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
    />
  );
}

/** Special glowing "Başla" button for the final screen */
function FinalButton({ onPress, label }: { onPress: () => void; label: string }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glow.value, [0, 1], [0.12, 0.40]),
    shadowRadius:  interpolate(glow.value, [0, 1], [6,    22  ]),
  }));
  const W = SW - 44;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[{
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 100,
        paddingHorizontal: 36, paddingVertical: 21,
        width: W,
        shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 },
      }, glowStyle]}>
        <Text style={ss.btnFinalLbl}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const illSt = StyleSheet.create({
  centre: {
    width: ILL, height: ILL,
    alignItems: "center", justifyContent: "center",
  },
});

const BUTTON_W = SW - 44;

const ss = StyleSheet.create({
  page: {
    width: SW, height: SH,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  illArea: {
    flex: 58, alignItems: "center", justifyContent: "center",
  },
  textArea: {
    flex: 42,
    paddingHorizontal: 40,
    justifyContent: "flex-start",
    gap: 16,
  },

  // Title — monumental, brand-statement weight
  title: {
    fontSize:      60,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -2.5,
    lineHeight:    66,
  },

  // Subtitle — minimal, soft
  subtitle: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.40)",
    letterSpacing: -0.2,
    lineHeight:    26,
  },

  skip: {
    position: "absolute", right: 28, zIndex: 10,
  },
  skipTxt: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.30)",
    letterSpacing: -0.1,
  },

  dots: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
  },
  dot: {
    height: 8, borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },

  btnBar: {
    position: "absolute", left: 0, right: 0,
    alignItems: "center",
  },

  // Screens 1–4: solid white pill
  btnSolid: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 100,
    paddingHorizontal: 36, paddingVertical: 21,
    width: BUTTON_W,
  },
  btnSolidLbl: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.4,
  },
  btnArrow: {
    fontSize:   17, fontFamily: "Inter_600SemiBold",
    color: "#000000",
  },

  // Screen 5: final "Başla" label
  btnFinalLbl: {
    fontSize:      17,
    fontFamily:    "Inter_700Bold",
    color:         "#000000",
    letterSpacing: -0.5,
  },
});
