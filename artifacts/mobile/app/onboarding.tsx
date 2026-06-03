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

const LOGO = require("../assets/images/akilcep-logo.png");

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
      <Animated.View style={[ill.ring, { width: ILL * 0.80, height: ILL * 0.80, borderRadius: ILL * 0.40 }, outerRing]} />
      <Animated.View style={[ill.ring, { width: ILL * 0.54, height: ILL * 0.54, borderRadius: ILL * 0.27 }, innerRing]} />
      <Image source={LOGO} style={[ill.logo, { width: ILL * 0.60, height: ILL * 0.60 }]} resizeMode="contain" />
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
const NODES: [number, number][] = [
  [58, 42], [180, 28], [224, 104], [155, 152], [100, 148],
  [36, 195], [200, 198], [136, 224],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 4], [1, 3], [2, 3], [3, 4], [4, 5], [3, 6], [5, 7], [6, 7],
];

function CreateIllustration() {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.10, 0.26]),
  }));

  return (
    <View style={ill.center}>
      <Animated.View style={[ill.ring, { width: ILL * 0.50, height: ILL * 0.50, borderRadius: ILL * 0.25 }, glowStyle]} />
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#cg)" />
        {EDGES.map(([a, b], i) => (
          <Line key={i}
            x1={NODES[a][0]} y1={NODES[a][1]}
            x2={NODES[b][0]} y2={NODES[b][1]}
            stroke="#fff" strokeWidth={0.6} strokeOpacity={0.25}
          />
        ))}
        {NODES.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i === 7 ? 5 : 3.5}
            fill="#fff" fillOpacity={i === 7 ? 0.90 : 0.55}
          />
        ))}
      </Svg>
    </View>
  );
}

// ── Illustration: Research — orbital rings ────────────────────────────────────
const OC = V / 2;  // orbital center

function ResearchIllustration() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1, false,
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={ill.center}>
      <Svg width={ILL} height={ILL} viewBox={`0 0 ${V} ${V}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="og" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#fff" stopOpacity={0.12} />
            <Stop offset="100%" stopColor="#fff" stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect width={V} height={V} fill="url(#og)" />

        {/* Orbital rings at 0°, 60°, 120° */}
        {[0, 60, 120].map((deg, i) => (
          <G key={i} rotation={deg} origin={`${OC}, ${OC}`}>
            <Ellipse cx={OC} cy={OC} rx={96} ry={34}
              fill="none" stroke="#fff" strokeWidth={0.8} strokeOpacity={0.28}
            />
          </G>
        ))}

        {/* Core */}
        <Circle cx={OC} cy={OC} r={18} fill="#fff" fillOpacity={0.12} />
        <Circle cx={OC} cy={OC} r={10} fill="#fff" fillOpacity={0.70} />

        {/* Orbit dots */}
        <Circle cx={OC + 96} cy={OC} r={4} fill="#fff" fillOpacity={0.70} />
        <G rotation={60} origin={`${OC}, ${OC}`}>
          <Circle cx={OC - 96} cy={OC} r={3.5} fill="#fff" fillOpacity={0.55} />
        </G>
        <G rotation={120} origin={`${OC}, ${OC}`}>
          <Circle cx={OC} cy={OC - 34} r={3} fill="#fff" fillOpacity={0.45} />
        </G>
      </Svg>

      {/* Animated orbiting dot */}
      <Animated.View style={[ill.orbitContainer, dotStyle]}>
        <View style={ill.orbitDot} />
      </Animated.View>
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
