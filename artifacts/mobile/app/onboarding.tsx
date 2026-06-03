/**
 * Onboarding — 5 cinematic screens, each with a unique code-drawn illustration.
 *
 * Illustrations use React Native SVG + Reanimated — no external images except
 * the AkılCEP logo on the Welcome screen. Navigation flows to /auth on finish.
 */
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
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
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Defs,
  RadialGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "@akilcep_onboarding_done";

const LOGO = require("../assets/images/akilcep-icon.png");

const { width: SW, height: SH } = Dimensions.get("window");
const ILL = SW * 0.78;   // illustration viewport size

// ── Illustration: Welcome — logo + pulsing glow rings ───────────────────────
function WelcomeIllustration() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const outerRing = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [0.04, 0.13]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.10]) }],
  }));
  const innerRing = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [0.07, 0.22]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.05]) }],
  }));

  return (
    <View style={ill.center}>
      {/* Soft glow bloom behind the icon */}
      <View style={ill.iconHalo} />
      <Animated.View style={[ill.ring, { width: ILL * 0.80, height: ILL * 0.80, borderRadius: ILL * 0.40 }, outerRing]} />
      <Animated.View style={[ill.ring, { width: ILL * 0.54, height: ILL * 0.54, borderRadius: ILL * 0.27 }, innerRing]} />
      <Image source={LOGO} style={[ill.logo, { width: ILL * 0.70, height: ILL * 0.70 }]} resizeMode="contain" />
    </View>
  );
}

// ── Illustration: Voice — animated waveform bars ─────────────────────────────
const OFFSETS = [0, 0.08, 0.17, 0.26, 0.35, 0.44, 0.35, 0.26, 0.17, 0.08, 0];

function WaveBar({ offset, phase }: { offset: number; phase: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = (phase.value + offset) % 1;
    const h = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
    return {
      height:  10 + h * 60,
      opacity: 0.25 + h * 0.75,
    };
  });
  return <Animated.View style={[ill.waveBar, style]} />;
}

function VoiceIllustration() {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const ringPulse = useSharedValue(0);
  useEffect(() => {
    ringPulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(ringPulse.value, [0, 1], [0.08, 0.22]),
    transform: [{ scale: interpolate(ringPulse.value, [0, 1], [1, 1.08]) }],
  }));

  return (
    <View style={ill.center}>
      <Animated.View style={[ill.ring, { width: ILL * 0.62, height: ILL * 0.62, borderRadius: ILL * 0.31 }, outerStyle]} />
      {/* Brand icon sits above the voice waveform */}
      <Image source={LOGO} style={[ill.logo, { width: ILL * 0.21, height: ILL * 0.21, marginBottom: 20 }]} resizeMode="contain" />
      <View style={ill.waveRow}>
        {OFFSETS.map((off, i) => (
          <WaveBar key={i} offset={off} phase={phase} />
        ))}
      </View>
    </View>
  );
}

// ── Illustration: Create — particle constellation ────────────────────────────
const V = 260; // SVG viewBox size
// ── Create illustration — neural-mesh AI generation visual ───────────────────
// 12 nodes laid out as a flowing neural network: inputs → hidden → center → output
const C_NODES: [number, number][] = [
  [30,  60], [26, 130], [38, 200],          // 0-2  left inputs
  [100, 42], [95, 112], [88, 192],          // 3-5  mid-left hidden
  [130, 130],                               // 6    CENTER — focal node
  [165, 58], [172, 168],                    // 7-8  mid-right hidden
  [218, 48], [228, 130], [214, 208],        // 9-11 right outputs
];

const C_EDGES: [number, number][] = [
  // Left inputs → hidden
  [0, 3], [0, 4], [1, 4], [1, 5], [2, 5],
  // Hidden → center
  [3, 6], [4, 6], [5, 6],
  // Center → right hidden
  [6, 7], [6, 8],
  // Right hidden → outputs
  [7, 9], [7, 10], [8, 10], [8, 11],
  // Long diagonals (cross-layer flow)
  [3, 7], [5, 8],
  // Within-layer verticals
  [0, 1], [1, 2], [3, 4], [4, 5], [7, 8], [9, 10], [10, 11],
];

// Floating light particles — positions as fraction of ILL
const C_PARTICLES: Array<{ x: number; y: number; r: number; delay: number }> = [
  { x: 0.14, y: 0.18, r: 1.5, delay: 0    },
  { x: 0.62, y: 0.08, r: 2.0, delay: 520  },
  { x: 0.87, y: 0.33, r: 1.5, delay: 940  },
  { x: 0.08, y: 0.74, r: 2.0, delay: 1380 },
  { x: 0.50, y: 0.91, r: 1.5, delay: 210  },
  { x: 0.80, y: 0.82, r: 2.0, delay: 730  },
  { x: 0.36, y: 0.04, r: 1.5, delay: 1120 },
  { x: 0.93, y: 0.60, r: 1.5, delay: 420  },
];

function CreationParticle({
  x, y, r, delay,
}: { x: number; y: number; r: number; delay: number }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2600 + delay % 400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.45, 1], [0, 0.88, 0]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -10]) }],
  }));

  const SIZE = r * 2;
  return (
    <Animated.View
      style={[
        {
          position:        "absolute",
          left:            ILL * x - r,
          top:             ILL * y - r,
          width:           SIZE,
          height:          SIZE,
          borderRadius:    r,
          backgroundColor: "#FFFFFF",
        },
        style,
      ]}
    />
  );
}

function CreateIllustration() {
  const outerGlow = useSharedValue(0);
  const centerPulse = useSharedValue(0);

  useEffect(() => {
    // Outer ring breathes slowly
    outerGlow.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    // Center focal node pulses faster
    centerPulse.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(outerGlow.value, [0, 1], [0.06, 0.22]),
  }));

  const glowHaloStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(centerPulse.value, [0, 1], [0.20, 0.72]),
    transform: [{ scale: interpolate(centerPulse.value, [0, 1], [0.75, 1.35]) }],
  }));

  const focalDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(centerPulse.value, [0, 1], [0.88, 1.12]) }],
  }));

  // Center pixel coords within the ILL container
  const CX = ILL / 2;
  const CY = ILL / 2;

  return (
    <View style={ill.center}>

      {/* Outer breathing ring */}
      <Animated.View
        style={[ill.ring, { width: ILL * 0.60, height: ILL * 0.60, borderRadius: ILL * 0.30 }, ringStyle]}
      />

      {/* Node mesh — static SVG */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.10} />
            <Stop offset="55%"  stopColor="#fff" stopOpacity={0.03} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#cg)" />

        {/* Edges — center-connected lines are slightly brighter */}
        {C_EDGES.map(([a, b], i) => {
          const hot = a === 6 || b === 6;
          return (
            <Line key={i}
              x1={C_NODES[a][0]} y1={C_NODES[a][1]}
              x2={C_NODES[b][0]} y2={C_NODES[b][1]}
              stroke="#fff"
              strokeWidth={hot ? 0.9 : 0.5}
              strokeOpacity={hot ? 0.32 : 0.14}
            />
          );
        })}

        {/* Peripheral nodes — outputs slightly larger */}
        {C_NODES.map(([x, y], i) => {
          if (i === 6) return null; // center rendered as Animated.View
          const isOutput = i >= 9;
          return (
            <Circle key={i}
              cx={x} cy={y}
              r={isOutput ? 4.5 : 3.0}
              fill="#fff"
              fillOpacity={isOutput ? 0.72 : 0.40}
            />
          );
        })}
      </Svg>

      {/* Center focal node — animated glow halo */}
      <Animated.View
        style={[
          {
            position:        "absolute",
            left:            CX - 24,
            top:             CY - 24,
            width:           48,
            height:          48,
            borderRadius:    24,
            backgroundColor: "transparent",
            shadowColor:     "#FFFFFF",
            shadowOffset:    { width: 0, height: 0 },
            shadowOpacity:   0.65,
            shadowRadius:    22,
            borderWidth:     StyleSheet.hairlineWidth,
            borderColor:     "rgba(255,255,255,0.50)",
          },
          glowHaloStyle,
        ]}
      />

      {/* Center focal node — bright core dot */}
      <Animated.View
        style={[
          {
            position:        "absolute",
            left:            CX - 5,
            top:             CY - 5,
            width:           10,
            height:          10,
            borderRadius:    5,
            backgroundColor: "#FFFFFF",
          },
          focalDotStyle,
        ]}
      />

      {/* Floating light particles */}
      {C_PARTICLES.map((p, i) => (
        <CreationParticle key={i} {...p} />
      ))}

    </View>
  );
}

// ── Illustration: Research — knowledge graph + radar sweep ───────────────────
const OC = V / 2;  // orbital center (also used by ReadyIllustration)

// Knowledge graph: center query node → inner hex ring → outer partial ring
const R_NODES: [number, number][] = [
  [130, 130],          // 0  center — query node
  [130,  68],          // 1  inner top
  [182, 100],          // 2  inner top-right
  [182, 162],          // 3  inner bot-right
  [130, 192],          // 4  inner bottom
  [ 78, 162],          // 5  inner bot-left
  [ 78, 100],          // 6  inner top-left
  [ 56,  36],          // 7  outer top-left
  [202,  36],          // 8  outer top-right
  [236, 130],          // 9  outer right
  [200, 222],          // 10 outer bot-right
  [ 56, 222],          // 11 outer bot-left
];

const R_EDGES: [number, number][] = [
  // Center → inner ring
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  // Inner ring perimeter
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1],
  // Inner → outer (sparse, like search pathways)
  [1, 7], [1, 8], [2, 8], [3, 9], [4, 10], [5, 11],
  // Outer partial connections
  [7, 8], [9, 10], [10, 11], [11, 7],
];

// Nodes that "ping" (simulate discovered knowledge)
const R_PULSES: Array<{ cx: number; cy: number; delay: number }> = [
  { cx: 130, cy:  68, delay: 0    },
  { cx: 182, cy: 100, delay: 720  },
  { cx: 236, cy: 130, delay: 1440 },
  { cx: 200, cy: 222, delay: 320  },
  { cx:  78, cy: 162, delay: 1060 },
  { cx: 202, cy:  36, delay: 1780 },
];

// Discovery ping — sharp flash at a knowledge node
function ResearchPulse({ cx, cy, delay }: { cx: number; cy: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 1100, easing: Easing.in(Easing.ease) }),
        ),
        -1, false,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   anim.value,
    transform: [{ scale: interpolate(anim.value, [0, 0.35, 1], [0.4, 1.55, 0.5]) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position:        "absolute",
          left:            (cx / V) * ILL - 7,
          top:             (cy / V) * ILL - 7,
          width:           14,
          height:          14,
          borderRadius:    7,
          backgroundColor: "rgba(255,255,255,0.08)",
          shadowColor:     "#FFFFFF",
          shadowOffset:    { width: 0, height: 0 },
          shadowOpacity:   0.70,
          shadowRadius:    12,
          borderWidth:     StyleSheet.hairlineWidth,
          borderColor:     "rgba(255,255,255,0.60)",
        },
        style,
      ]}
    />
  );
}

function ResearchIllustration() {
  const radarSpin  = useSharedValue(0);
  const centerGlow = useSharedValue(0);

  useEffect(() => {
    // Radar sweep — full rotation every 6 s
    radarSpin.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1, false,
    );
    // Center query node breathes
    centerGlow.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${radarSpin.value}deg` }],
  }));

  const centerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(centerGlow.value, [0, 1], [0.28, 0.82]),
    transform: [{ scale: interpolate(centerGlow.value, [0, 1], [0.78, 1.22]) }],
  }));

  const CX = ILL / 2;
  const CY = ILL / 2;

  return (
    <View style={ill.center}>

      {/* Outer boundary ring — very faint */}
      <View style={[ill.ring, {
        width: ILL * 0.70, height: ILL * 0.70,
        borderRadius: ILL * 0.35, opacity: 0.07,
      }]} />

      {/* SVG — static knowledge graph */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="og" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.09} />
            <Stop offset="55%"  stopColor="#fff" stopOpacity={0.03} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#og)" />

        {/* Edges — center-connected ones are brighter (search pathways) */}
        {R_EDGES.map(([a, b], i) => {
          const isPath = a === 0 || b === 0;
          return (
            <Line key={i}
              x1={R_NODES[a][0]} y1={R_NODES[a][1]}
              x2={R_NODES[b][0]} y2={R_NODES[b][1]}
              stroke="#fff"
              strokeWidth={isPath ? 0.9 : 0.5}
              strokeOpacity={isPath ? 0.28 : 0.12}
            />
          );
        })}

        {/* Knowledge nodes */}
        {R_NODES.map(([x, y], i) => {
          if (i === 0) return null; // center rendered as Animated.View
          const outer = i >= 7;
          return (
            <Circle key={i} cx={x} cy={y}
              r={outer ? 3.5 : 2.5}
              fill="#fff"
              fillOpacity={outer ? 0.60 : 0.36}
            />
          );
        })}
      </Svg>

      {/* Radar sweep — ILL×ILL rotating container, pivots at its center */}
      <Animated.View
        style={[{ position: "absolute", left: 0, top: 0, width: ILL, height: ILL }, sweepStyle]}
      >
        <View
          style={{
            position:        "absolute",
            left:            CX,
            top:             CY - 0.75,
            width:           ILL * 0.40,
            height:          1.5,
            backgroundColor: "rgba(255,255,255,0.16)",
            borderRadius:    1,
            shadowColor:     "#FFFFFF",
            shadowOffset:    { width: 0, height: 0 },
            shadowOpacity:   0.42,
            shadowRadius:    5,
          }}
        />
      </Animated.View>

      {/* Center query node — animated glow ring */}
      <Animated.View
        style={[
          {
            position:        "absolute",
            left:            CX - 18,
            top:             CY - 18,
            width:           36,
            height:          36,
            borderRadius:    18,
            backgroundColor: "transparent",
            shadowColor:     "#FFFFFF",
            shadowOffset:    { width: 0, height: 0 },
            shadowOpacity:   0.58,
            shadowRadius:    18,
            borderWidth:     StyleSheet.hairlineWidth,
            borderColor:     "rgba(255,255,255,0.42)",
          },
          centerStyle,
        ]}
      />

      {/* Center dot */}
      <View style={{
        position:        "absolute",
        left:            CX - 4,
        top:             CY - 4,
        width:           8,
        height:          8,
        borderRadius:    4,
        backgroundColor: "#FFFFFF",
      }} />

      {/* Discovery pings */}
      {R_PULSES.map((p, i) => (
        <ResearchPulse key={i} {...p} />
      ))}

    </View>
  );
}

// ── Illustration: Ready — glowing arch portal ────────────────────────────────
// Arch: M lx base  L lx top+r  A r r 0 0 1 rx top+r  L rx base
const ARCH_L = 76;
const ARCH_R = V - ARCH_L;   // = 184
const ARCH_R2 = (ARCH_R - ARCH_L) / 2;  // radius = 54
const ARCH_TOP = 62;
const ARCH_BASE = 222;
const ARCH_PATH = `M ${ARCH_L} ${ARCH_BASE} L ${ARCH_L} ${ARCH_TOP + ARCH_R2} A ${ARCH_R2} ${ARCH_R2} 0 0 1 ${ARCH_R} ${ARCH_TOP + ARCH_R2} L ${ARCH_R} ${ARCH_BASE}`;

function ReadyIllustration() {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.12, 0.32]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.06]) }],
  }));

  return (
    <View style={ill.center}>
      <Animated.View style={[ill.ring, { width: ILL * 0.55, height: ILL * 0.55, borderRadius: ILL * 0.28 }, glowStyle]} />
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="pg" cx="50%" cy="85%" r="55%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.22} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#pg)" />

        {/* Inner glow fill */}
        <Path d={ARCH_PATH} fill="#fff" fillOpacity={0.06} />
        {/* Arch border */}
        <Path d={ARCH_PATH} fill="none" stroke="#fff" strokeWidth={1.6} strokeOpacity={0.80} />

        {/* Ground platform */}
        <Rect x={ARCH_L + 4} y={ARCH_BASE} width={ARCH_R - ARCH_L - 8} height={3}
          rx={1.5} fill="#fff" fillOpacity={0.45}
        />

        {/* Light beam from arch base */}
        <Path
          d={`M ${OC - 6} ${ARCH_BASE + 3} L ${OC - 24} ${V + 10} L ${OC + 24} ${V + 10} L ${OC + 6} ${ARCH_BASE + 3} Z`}
          fill="#fff" fillOpacity={0.06}
        />

        {/* Stars */}
        {[[44, 38], [210, 54], [28, 130], [228, 140], [130, 26]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i === 2 ? 1.8 : 1.2} fill="#fff" fillOpacity={0.55} />
        ))}
      </Svg>
      {/* Brand icon — hero focal point inside the arch portal */}
      <Image
        source={LOGO}
        style={[
          ill.logo,
          {
            width:    ILL * 0.32,
            height:   ILL * 0.32,
            position: "absolute",
            top:      ILL * 0.42,
            left:     ILL * 0.34,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

// ── Screens config ────────────────────────────────────────────────────────────
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
    Illustration: WelcomeIllustration,
    title:        "AkılCEP",
    subtitle:     "Cebindeki akıl.",
    showSkip:     false,
    buttonLabel:  "Devam Et",
  },
  {
    Illustration: VoiceIllustration,
    title:        "Sesinle Konuş",
    subtitle:     "Yazmak zorunda değilsin.",
    showSkip:     true,
    buttonLabel:  "Devam Et",
  },
  {
    Illustration: CreateIllustration,
    title:        "Üret. Düzenle. Oluştur.",
    subtitle:     "Görseller ve içerikler üret.",
    showSkip:     true,
    buttonLabel:  "Devam Et",
  },
  {
    Illustration: ResearchIllustration,
    title:        "Araştır. Öğren. Çöz.",
    subtitle:     "Web'de ara ve dosyaları analiz et.",
    showSkip:     true,
    buttonLabel:  "Devam Et",
  },
  {
    Illustration: ReadyIllustration,
    title:        "Hazırsın",
    subtitle:     "Yeni nesil deneyim başlıyor.",
    showSkip:     false,
    buttonLabel:  "Başla",
    isFinal:      true,
  },
];

const NUM_SCREENS = SCREENS.length;

// ── Animated dot ──────────────────────────────────────────────────────────────
function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const r    = [(index - 1) * SW, index * SW, (index + 1) * SW];
    const size = interpolate(scrollX.value, r, [6, 9, 6],       Extrapolation.CLAMP);
    const opac = interpolate(scrollX.value, r, [0.22, 1, 0.22], Extrapolation.CLAMP);
    return { width: size, height: size, opacity: opac };
  });
  return <Animated.View style={[ss.dot, style]} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
      const BTN_H  = 56;
      const GAP    = 48;

      return (
        <View style={ss.page}>

          {/* Illustration — upper half */}
          <View style={[ss.illArea, { paddingTop: topPad + 16 }]}>
            <cfg.Illustration />
          </View>

          {/* Text — lower half */}
          <View style={[ss.textArea, { paddingBottom: btmPad + BTN_H + GAP + 9 + 32 }]}>
            <Text style={ss.title}>{cfg.title}</Text>
            <Text style={ss.subtitle}>{cfg.subtitle}</Text>
          </View>

          {/* Skip */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 14 }]}
              onPress={goSkip}
              hitSlop={14}
              activeOpacity={0.55}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Dots */}
          <View style={[ss.dotsBar, { bottom: btmPad + 20 + BTN_H + GAP }]}>
            {SCREENS.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          {/* Button */}
          <View style={[ss.btnBar, { bottom: btmPad + 20 }]}>
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

// ── Illustration shared styles ────────────────────────────────────────────────
const ill = StyleSheet.create({
  center: {
    width:          ILL,
    height:         ILL,
    alignItems:     "center",
    justifyContent: "center",
  },
  // Pulsing glow ring (white border, no fill)
  ring: {
    position:    "absolute",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  // AkılCEP logo
  logo: {
    zIndex: 2,
  },
  // Soft white bloom behind the icon on Welcome screen
  iconHalo: {
    position:        "absolute",
    width:           ILL * 0.50,
    height:          ILL * 0.50,
    borderRadius:    ILL * 0.25,
    backgroundColor: "rgba(255,255,255,0.032)",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.16,
    shadowRadius:    48,
  },
  // Voice waveform
  waveRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            5,
    zIndex:         2,
  },
  waveBar: {
    width:           3,
    borderRadius:    2,
    backgroundColor: "#FFFFFF",
    alignSelf:       "center",
  },
  // Research orbit animation container
  orbitContainer: {
    position:       "absolute",
    width:          ILL,
    height:         ILL,
    alignItems:     "center",
    justifyContent: "flex-start",
  },
  orbitDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: "#FFFFFF",
    marginTop:       (ILL - ILL * 0.28) / 2 - 3,  // ~align to inner ring edge
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const BUTTON_W = SW - 52;

const ss = StyleSheet.create({

  page: {
    width:           SW,
    height:          SH,
    backgroundColor: "#050505",
    overflow:        "hidden",
  },

  illArea: {
    flex:           5,
    alignItems:     "center",
    justifyContent: "center",
  },

  textArea: {
    flex:            4,
    paddingHorizontal: 32,
    justifyContent:  "flex-start",
    gap:             10,
  },

  title: {
    fontSize:      32,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -0.8,
    lineHeight:    38,
  },

  subtitle: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.50)",
    letterSpacing: -0.2,
    lineHeight:    24,
  },

  skip: {
    position: "absolute",
    right:    24,
    zIndex:   10,
  },
  skipText: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.40)",
    letterSpacing: -0.1,
  },

  dotsBar: {
    position:       "absolute",
    left:           0,
    right:          0,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },
  dot: {
    borderRadius:    99,
    backgroundColor: "#FFFFFF",
  },

  btnBar: {
    position:   "absolute",
    left:       0,
    right:      0,
    alignItems: "center",
  },

  // Screens 1–4: white pill
  btnSolid: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      50,
    paddingHorizontal: 28,
    paddingVertical:   17,
    width:             BUTTON_W,
  },
  btnSolidLabel: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.3,
  },
  btnArrow: {
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    color:      "#000000",
  },

  // Screen 5: glass outlined button
  btnFinal: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "rgba(255,255,255,0.06)",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.55)",
    borderRadius:      50,
    paddingHorizontal: 28,
    paddingVertical:   17,
    width:             BUTTON_W,
  },
  btnFinalLabel: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.3,
  },
});
