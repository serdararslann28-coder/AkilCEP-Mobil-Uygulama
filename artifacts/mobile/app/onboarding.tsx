/**
 * Onboarding — 5 cinematic AkılCEP screens.
 *
 * Aesthetic:  Pure black (#000000) · soft white light only · no neon · no logos in illustrations
 * Screens:    Awakening → Thinking → Convergence → Ripples → Gateway
 * Every illustration is coded in SVG + Reanimated — zero external assets after screen 1.
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

const { width: SW, height: SH } = Dimensions.get("window");

const ILL = SW * 0.76; // illustration container (square)
const V   = 260;       // SVG viewBox edge length
const CX  = ILL / 2;  // illustration center X
const CY  = ILL / 2;  // illustration center Y

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — AWAKENING
// A beam of white light awakens from the center, ascending upward.
// ─────────────────────────────────────────────────────────────────────────────
const AW_PARTICLES: Array<{ xf: number; delay: number; dur: number }> = [
  { xf: 0.460, delay: 0,    dur: 2800 },
  { xf: 0.505, delay: 560,  dur: 3100 },
  { xf: 0.530, delay: 1120, dur: 2600 },
  { xf: 0.480, delay: 840,  dur: 3200 },
  { xf: 0.515, delay: 280,  dur: 2900 },
  { xf: 0.495, delay: 1400, dur: 2700 },
];

function AwakeningParticle({ xf, delay, dur }: { xf: number; delay: number; dur: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.38, 1], [0, 0.78, 0]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -(ILL * 0.28)]) }],
  }));
  return (
    <Animated.View
      style={[{
        position:        "absolute",
        left:            ILL * xf - 1.5,
        top:             CY,
        width:           3, height: 3, borderRadius: 1.5,
        backgroundColor: "#FFFFFF",
      }, style]}
    />
  );
}

function AwakeningIllustration() {
  const orb   = useSharedValue(0);
  const beam  = useSharedValue(0);

  useEffect(() => {
    orb.value  = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    beam.value = withRepeat(withTiming(1, { duration: 5400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(orb.value, [0, 1], [0.42, 1.0]),
    transform: [{ scale: interpolate(orb.value, [0, 1], [0.80, 1.22]) }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(beam.value, [0, 1], [0.52, 1.0]),
  }));

  return (
    <View style={ill.center}>

      {/* Animated beam layer */}
      <Animated.View style={[StyleSheet.absoluteFillObject, beamStyle]}>
        <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="aw_bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#fff" stopOpacity={0.13} />
              <Stop offset="45%"  stopColor="#fff" stopOpacity={0.04} />
              <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          {/* Ambient centre glow */}
          <Rect width={V} height={V} fill="url(#aw_bg)" />
          {/* Inner beam — narrow cone ascending from centre */}
          <Path
            d={`M ${V/2} ${V/2} L ${V/2 - 16} 0 L ${V/2 + 16} 0 Z`}
            fill="#FFFFFF" fillOpacity={0.10}
          />
          {/* Outer soft halo cone */}
          <Path
            d={`M ${V/2} ${V/2 + 28} L ${V/2 - 54} 0 L ${V/2 + 54} 0 Z`}
            fill="#FFFFFF" fillOpacity={0.04}
          />
          {/* Downward mirror reflection — very faint */}
          <Path
            d={`M ${V/2} ${V/2} L ${V/2 - 8} ${V} L ${V/2 + 8} ${V} Z`}
            fill="#FFFFFF" fillOpacity={0.03}
          />
        </Svg>
      </Animated.View>

      {/* Outer glow orb */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 50, top: CY - 50,
        width:           100, height: 100, borderRadius: 50,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.75,
        shadowRadius:    52,
      }, orbStyle]} />

      {/* Inner halo ring */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 22, top: CY - 22,
        width:           44, height: 44, borderRadius: 22,
        borderWidth:     StyleSheet.hairlineWidth,
        borderColor:     "rgba(255,255,255,0.42)",
        backgroundColor: "transparent",
      }, orbStyle]} />

      {/* Bright core dot */}
      <View style={{
        position:        "absolute",
        left:            CX - 4, top: CY - 4,
        width:           8, height: 8, borderRadius: 4,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1, shadowRadius: 12,
      }} />

      {/* Particles ascending through beam */}
      {AW_PARTICLES.map((p, i) => <AwakeningParticle key={i} {...p} />)}

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — THINKING (Düşün)
// A constellation of thought-nodes that float and connect like firing neurons.
// ─────────────────────────────────────────────────────────────────────────────
const TH_NODES: [number, number][] = [
  [36, 48], [92, 32], [155, 42], [212, 68],
  [240, 130], [218, 200], [155, 232], [88, 228],
  [34, 192], [18, 115], [80, 130], [130, 90],
  [180, 140], [110, 175],
];

const TH_EDGES: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],
  [1,11],[2,11],[3,12],[5,12],[6,13],[7,13],
  [10,11],[10,13],[11,12],[12,13],[9,10],[4,12],
];

const TH_ANIM: Array<{ dy: number; dur: number; delay: number }> = [
  { dy:9,  dur:3100, delay:0    }, { dy:7,  dur:2700, delay:400  },
  { dy:11, dur:3600, delay:200  }, { dy:8,  dur:3200, delay:800  },
  { dy:10, dur:2900, delay:600  }, { dy:7,  dur:3400, delay:1000 },
  { dy:9,  dur:2800, delay:300  }, { dy:11, dur:3100, delay:700  },
  { dy:8,  dur:3500, delay:500  }, { dy:10, dur:2700, delay:900  },
  { dy:12, dur:3000, delay:100  }, { dy:9,  dur:3300, delay:1200 },
  { dy:7,  dur:2900, delay:450  }, { dy:11, dur:3200, delay:750  },
];

function ThoughtNode({
  nx, ny, dy, dur, delay,
}: { nx: number; ny: number; dy: number; dur: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const px = (nx / V) * ILL;
  const py = (ny / V) * ILL;
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.5, 1], [0.24, 0.92, 0.24]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -dy]) }],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            px - 3, top: py - 3,
      width:           6, height: 6, borderRadius: 3,
      backgroundColor: "#FFFFFF",
      shadowColor:     "#FFFFFF",
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.55, shadowRadius: 7,
    }, style]} />
  );
}

function ThinkingIllustration() {
  const linesPulse = useSharedValue(0);
  useEffect(() => {
    linesPulse.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);
  const linesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(linesPulse.value, [0, 1], [0.55, 1.0]),
  }));

  return (
    <View style={ill.center}>
      {/* SVG — connection lines */}
      <Animated.View style={[StyleSheet.absoluteFillObject, linesStyle]}>
        <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="th_bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#fff" stopOpacity={0.07} />
              <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          <Rect width={V} height={V} fill="url(#th_bg)" />
          {TH_EDGES.map(([a, b], i) => (
            <Line key={i}
              x1={TH_NODES[a][0]} y1={TH_NODES[a][1]}
              x2={TH_NODES[b][0]} y2={TH_NODES[b][1]}
              stroke="#FFFFFF" strokeWidth={0.5} strokeOpacity={0.11}
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Animated floating nodes */}
      {TH_NODES.map(([nx, ny], i) => (
        <ThoughtNode key={i} nx={nx} ny={ny} {...TH_ANIM[i]} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — CONVERGENCE (Anla)
// A document, a globe, an image frame — all streaming into a single focal point.
// ─────────────────────────────────────────────────────────────────────────────
const CV_DOC = { x: ILL * 0.22, y: ILL * 0.26 };
const CV_WEB = { x: ILL * 0.78, y: ILL * 0.24 };
const CV_IMG = { x: ILL * 0.50, y: ILL * 0.79 };

const CV_PARTICLES: Array<{ fromX: number; fromY: number; delay: number }> = [
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 0    },
  { fromX: CV_DOC.x, fromY: CV_DOC.y, delay: 1300 },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 430  },
  { fromX: CV_WEB.x, fromY: CV_WEB.y, delay: 1730 },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 860  },
  { fromX: CV_IMG.x, fromY: CV_IMG.y, delay: 2160 },
];

function ConvergeParticle({ fromX, fromY, delay }: { fromX: number; fromY: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.in(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.12, 0.78, 1], [0, 0.92, 0.68, 0]),
    transform: [
      { translateX: interpolate(anim.value, [0, 1], [fromX - CX, 0]) },
      { translateY: interpolate(anim.value, [0, 1], [fromY - CY, 0]) },
    ],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            CX - 2.5, top: CY - 2.5,
      width:           5, height: 5, borderRadius: 2.5,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

function FloatShell({
  delay, rise, children,
}: { delay: number; rise: number; children: React.ReactNode }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.5, 1], [0.52, 0.90, 0.52]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -rise]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function ConvergenceIllustration() {
  const center = useSharedValue(0);
  useEffect(() => {
    center.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);
  const centerStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(center.value, [0, 1], [0.38, 1.0]),
    transform: [{ scale: interpolate(center.value, [0, 1], [0.82, 1.18]) }],
  }));

  // SVG stream-line endpoints in V space
  const docVX = (CV_DOC.x / ILL) * V;
  const docVY = (CV_DOC.y / ILL) * V;
  const webVX = (CV_WEB.x / ILL) * V;
  const webVY = (CV_WEB.y / ILL) * V;
  const imgVX = (CV_IMG.x / ILL) * V;
  const imgVY = (CV_IMG.y / ILL) * V;

  return (
    <View style={ill.center}>

      {/* SVG: ambient + dashed stream lines */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="cv_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.10} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#cv_bg)" />
        {/* Curved dashed streams toward centre */}
        <Path
          d={`M ${docVX} ${docVY} Q ${V*0.36} ${docVY*0.85} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.55}
          strokeOpacity={0.16} strokeDasharray="2,6"
        />
        <Path
          d={`M ${webVX} ${webVY} Q ${V*0.65} ${webVY*0.85} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.55}
          strokeOpacity={0.16} strokeDasharray="2,6"
        />
        <Path
          d={`M ${imgVX} ${imgVY} Q ${V/2} ${imgVY*1.15} ${V/2} ${V/2}`}
          fill="none" stroke="#FFFFFF" strokeWidth={0.55}
          strokeOpacity={0.16} strokeDasharray="2,6"
        />
      </Svg>

      {/* Shape 1: Document (top-left) */}
      <View style={{ position: "absolute", left: CV_DOC.x - 26, top: CV_DOC.y - 34 }}>
        <FloatShell delay={0} rise={11}>
          <View style={{
            width:       52, height: 68,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.55)",
            borderRadius: 5,
          }}>
            {[0,1,2,3].map(i => (
              <View key={i} style={{
                position:        "absolute",
                left:            9, top: 15 + i * 12,
                width:           i === 3 ? 22 : 34, height: 0.8,
                backgroundColor: "rgba(255,255,255,0.28)",
                borderRadius:    0.4,
              }} />
            ))}
          </View>
        </FloatShell>
      </View>

      {/* Shape 2: Globe / Web (top-right) */}
      <View style={{ position: "absolute", left: CV_WEB.x - 30, top: CV_WEB.y - 30 }}>
        <FloatShell delay={700} rise={9}>
          <Svg width={60} height={60} viewBox="0 0 60 60">
            <Circle cx={30} cy={30} r={27}
              fill="none" stroke="#FFFFFF"
              strokeWidth={0.7} strokeOpacity={0.55}
            />
            {/* Central meridian */}
            <Path d="M 30 3 Q 42 30 30 57 Q 18 30 30 3"
              fill="none" stroke="#FFFFFF"
              strokeWidth={0.5} strokeOpacity={0.26}
            />
            {/* Latitude bands */}
            <Path d="M 6 22 Q 30 17 54 22" fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.20} />
            <Path d="M 6 38 Q 30 43 54 38" fill="none" stroke="#FFFFFF" strokeWidth={0.45} strokeOpacity={0.20} />
          </Svg>
        </FloatShell>
      </View>

      {/* Shape 3: Image frame (bottom-centre) */}
      <View style={{ position: "absolute", left: CV_IMG.x - 38, top: CV_IMG.y - 28 }}>
        <FloatShell delay={1400} rise={13}>
          <View style={{
            width:        76, height: 56,
            borderWidth:  StyleSheet.hairlineWidth,
            borderColor:  "rgba(255,255,255,0.55)",
            borderRadius: 7,
          }}>
            {/* Landscape indicator: horizon + sun */}
            <View style={{
              position: "absolute", right: 9, top: 9,
              width: 14, height: 14, borderRadius: 7,
              borderWidth: 0.7, borderColor: "rgba(255,255,255,0.35)",
            }} />
            <View style={{
              position:        "absolute",
              left: 9, bottom: 12,
              width: 36, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.22)",
            }} />
            <View style={{
              position:        "absolute",
              left: 9, bottom: 18,
              width: 24, height: 0.8,
              backgroundColor: "rgba(255,255,255,0.14)",
            }} />
          </View>
        </FloatShell>
      </View>

      {/* Centre focal glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 30, top: CY - 30,
        width:           60, height: 60, borderRadius: 30,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.72, shadowRadius: 30,
      }, centerStyle]} />
      <View style={{
        position:        "absolute",
        left:            CX - 4, top: CY - 4,
        width:           8, height: 8, borderRadius: 4,
        backgroundColor: "#FFFFFF",
      }} />

      {/* Flowing particles */}
      {CV_PARTICLES.map((p, i) => <ConvergeParticle key={i} {...p} />)}

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — RIPPLES (Konuş)
// Concentric voice-wave rings expanding from a central point of silence.
// ─────────────────────────────────────────────────────────────────────────────
const RIPPLE_DELAYS = [0, 800, 1600, 2400];

function RippleRing({ delay }: { delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.out(Easing.ease) }),
      -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.14, 1], [0, 0.52, 0]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.04, 1]) }],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            0, top: 0,
      width:           ILL, height: ILL, borderRadius: ILL / 2,
      borderWidth:     StyleSheet.hairlineWidth,
      borderColor:     "#FFFFFF",
    }, style]} />
  );
}

function RipplesIllustration() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [0.60, 1.0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.85, 1.15]) }],
  }));

  return (
    <View style={ill.center}>
      {/* SVG ambient + boundary hint */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="rp_bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.11} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#rp_bg)" />
        {/* Very faint outer boundary */}
        <Circle cx={V/2} cy={V/2} r={V/2 - 4}
          fill="none" stroke="#FFFFFF" strokeWidth={0.35} strokeOpacity={0.06}
        />
      </Svg>

      {/* Expanding rings */}
      {RIPPLE_DELAYS.map((d, i) => <RippleRing key={i} delay={d} />)}

      {/* Centre glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 26, top: CY - 26,
        width:           52, height: 52, borderRadius: 26,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.82, shadowRadius: 32,
      }, dotStyle]} />

      {/* Core dot */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 5.5, top: CY - 5.5,
        width:           11, height: 11, borderRadius: 5.5,
        backgroundColor: "#FFFFFF",
      }, dotStyle]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — GATEWAY (Başlayalım)
// A luminous archway opening into limitless possibility.
// ─────────────────────────────────────────────────────────────────────────────
const GW_L    = 82;           // left pillar x (V space)
const GW_R    = 178;          // right pillar x
const GW_R2   = (GW_R - GW_L) / 2;  // 48 — semicircle radius
const GW_TOP  = 60;           // top of arch (V space)
const GW_BASE = 220;          // threshold y (V space)
const GW_CY   = GW_TOP + GW_R2; // pillar top y = 108 (semicircle origin y)
// Arch path: left base → up pillar → semicircle → down pillar → right base
const GW_PATH = `M ${GW_L} ${GW_BASE} L ${GW_L} ${GW_CY} A ${GW_R2} ${GW_R2} 0 0 1 ${GW_R} ${GW_CY} L ${GW_R} ${GW_BASE}`;

// Stars visible above the arch
const GW_STARS: [number, number][] = [
  [48, 26], [100, 16], [162, 22], [214, 40], [130, 8], [60, 72], [200, 62],
];

// Particles rise from threshold through arch interior
const GW_PARTICLES: Array<{ xf: number; delay: number }> = [
  { xf: (GW_L + (GW_R-GW_L)*0.28) / V, delay: 0    },
  { xf: (GW_L + (GW_R-GW_L)*0.50) / V, delay: 800  },
  { xf: (GW_L + (GW_R-GW_L)*0.72) / V, delay: 400  },
  { xf: (GW_L + (GW_R-GW_L)*0.40) / V, delay: 1200 },
  { xf: (GW_L + (GW_R-GW_L)*0.62) / V, delay: 600  },
];

function GatewayParticle({ xf, delay }: { xf: number; delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);
  const baseY = (GW_BASE / V) * ILL;
  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 0.28, 1], [0, 0.82, 0]),
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -(ILL * 0.26)]) }],
  }));
  return (
    <Animated.View style={[{
      position:        "absolute",
      left:            ILL * xf - 1.5,
      top:             baseY - 1.5,
      width:           3, height: 3, borderRadius: 1.5,
      backgroundColor: "#FFFFFF",
    }, style]} />
  );
}

function GatewayIllustration() {
  const portalGlow  = useSharedValue(0);
  const thresholdPl = useSharedValue(0);

  useEffect(() => {
    portalGlow.value  = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
    thresholdPl.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, []);

  const portalStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(portalGlow.value, [0, 1], [0.22, 0.65]),
    transform: [{ scale: interpolate(portalGlow.value, [0, 1], [0.80, 1.20]) }],
  }));
  const threshStyle = useAnimatedStyle(() => ({
    opacity: interpolate(thresholdPl.value, [0, 1], [0.22, 0.58]),
  }));

  const gwLILL     = (GW_L    / V) * ILL;
  const gwWILL     = ((GW_R - GW_L) / V) * ILL;
  const baseILL    = (GW_BASE / V) * ILL;
  const archMidILL = ((GW_CY  + GW_BASE) / 2 / V) * ILL; // midpoint of arch interior

  return (
    <View style={ill.center}>

      {/* SVG — arch structure, gradients, stars */}
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          {/* Light radiating from inside the arch */}
          <RadialGradient id="gw_in" cx="50%" cy="55%" r="40%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.22} />
            <Stop offset="55%"  stopColor="#fff" stopOpacity={0.07} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
          {/* Ground spill below threshold */}
          <RadialGradient id="gw_gnd" cx="50%" cy="90%" r="42%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.14} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>

        <Rect width={V} height={V} fill="url(#gw_in)"  />
        <Rect width={V} height={V} fill="url(#gw_gnd)" />

        {/* Arch interior fill — breathes with the glow */}
        <Path d={GW_PATH} fill="#FFFFFF" fillOpacity={0.055} />

        {/* Arch frame — the threshold structure */}
        <Path d={GW_PATH} fill="none" stroke="#FFFFFF" strokeWidth={1.3} strokeOpacity={0.82} />

        {/* Ground threshold bar */}
        <Line
          x1={GW_L + 2} y1={GW_BASE}
          x2={GW_R - 2} y2={GW_BASE}
          stroke="#FFFFFF" strokeWidth={2.2} strokeOpacity={0.55}
        />

        {/* Light spill downward */}
        <Path
          d={`M ${V/2 - 5} ${GW_BASE} L ${V/2 - 26} ${V+6} L ${V/2+26} ${V+6} L ${V/2+5} ${GW_BASE} Z`}
          fill="#FFFFFF" fillOpacity={0.04}
        />

        {/* Stars above arch */}
        {GW_STARS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y}
            r={i < 2 ? 1.5 : 0.9}
            fill="#FFFFFF"
            fillOpacity={i < 2 ? 0.68 : 0.38}
          />
        ))}
      </Svg>

      {/* Threshold glow band */}
      <Animated.View style={[{
        position:        "absolute",
        left:            gwLILL, top: baseILL - 14,
        width:           gwWILL, height: 28, borderRadius: 14,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.55, shadowRadius: 20,
      }, threshStyle]} />

      {/* Interior portal glow */}
      <Animated.View style={[{
        position:        "absolute",
        left:            CX - 34, top: archMidILL - 34,
        width:           68, height: 68, borderRadius: 34,
        backgroundColor: "transparent",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   0.65, shadowRadius: 40,
      }, portalStyle]} />

      {/* Focal pinhole of light */}
      <View style={{
        position:        "absolute",
        left:            CX - 3.5, top: archMidILL - 3.5,
        width:           7, height: 7, borderRadius: 3.5,
        backgroundColor: "#FFFFFF",
        shadowColor:     "#FFFFFF",
        shadowOffset:    { width: 0, height: 0 },
        shadowOpacity:   1, shadowRadius: 10,
      }} />

      {/* Ascending particles */}
      {GW_PARTICLES.map((p, i) => <GatewayParticle key={i} {...p} />)}

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
    Illustration: ThinkingIllustration,
    title:        "Düşün.",
    subtitle:     "Her soruya daha akıllı yaklaş.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: ConvergenceIllustration,
    title:        "Anla.",
    subtitle:     "Web, belgeler ve görseller tek yerde.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: RipplesIllustration,
    title:        "Konuş.",
    subtitle:     "Yazmak zorunda değilsin.",
    showSkip:     true,
    buttonLabel:  "Devam",
  },
  {
    Illustration: GatewayIllustration,
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
    const size = interpolate(scrollX.value, r, [5, 8, 5],        Extrapolation.CLAMP);
    const opac = interpolate(scrollX.value, r, [0.20, 1, 0.20],  Extrapolation.CLAMP);
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
          <View style={[ss.illArea, { paddingTop: topPad + 10 }]}>
            <cfg.Illustration />
          </View>

          {/* Text — lower area */}
          <View style={[ss.textArea, { paddingBottom: btmPad + 56 + 60 + 32 }]}>
            <Text style={ss.title}>{cfg.title}</Text>
            <Text style={ss.subtitle}>{cfg.subtitle}</Text>
          </View>

          {/* Skip */}
          {cfg.showSkip && (
            <TouchableOpacity
              style={[ss.skip, { top: topPad + 14 }]}
              onPress={goSkip}
              hitSlop={14}
              activeOpacity={0.50}
            >
              <Text style={ss.skipText}>Atla</Text>
            </TouchableOpacity>
          )}

          {/* Dot indicator */}
          <View style={[ss.dotsBar, { bottom: btmPad + 20 + 56 + 36 }]}>
            {SCREENS.map((_, i) => (
              <Dot key={i} index={i} scrollX={scrollX} />
            ))}
          </View>

          {/* CTA button */}
          <View style={[ss.btnBar, { bottom: btmPad + 24 }]}>
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
const BUTTON_W = SW - 48;

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
    backgroundColor: "#000000",   // pure black
    overflow:        "hidden",
  },

  illArea: {
    flex:           5,
    alignItems:     "center",
    justifyContent: "center",
  },

  textArea: {
    flex:              3,
    paddingHorizontal: 36,
    justifyContent:    "flex-start",
    gap:               14,
  },

  // Large cinematic title
  title: {
    fontSize:      52,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.5,
    lineHeight:    58,
  },

  // Soft descriptive subtitle
  subtitle: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.48)",
    letterSpacing: -0.2,
    lineHeight:    25,
  },

  skip: {
    position: "absolute",
    right:    26,
    zIndex:   10,
  },
  skipText: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.35)",
    letterSpacing: -0.1,
  },

  dotsBar: {
    position:       "absolute",
    left:           0, right: 0,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            9,
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

  // Screens 1–4: solid white pill
  btnSolid: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      100,
    paddingHorizontal: 32,
    paddingVertical:   18,
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

  // Screen 5: glass outlined pill with white text
  btnFinal: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    backgroundColor:   "rgba(255,255,255,0.07)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.55)",
    borderRadius:      100,
    paddingHorizontal: 32,
    paddingVertical:   18,
    width:             BUTTON_W,
  },
  btnFinalLabel: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.3,
  },

});
