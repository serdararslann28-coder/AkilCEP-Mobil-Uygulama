/**
 * Voice Mode — living AKILCEP logo AI presence.
 * No globe. No mic button. The logo IS the intelligence.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");
type VoiceState = "idle" | "listening" | "speaking";

// ─── Deterministic starfield ──────────────────────────────────────────────────
function makeStars(n: number) {
  let seed = 0xfa1cafe1;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  return Array.from({ length: n }, (_, k) => ({
    key: k, top: rng() * H, left: rng() * W,
    size: rng() * 1.5 + 0.3, opacity: rng() * 0.22 + 0.04,
  }));
}

// ─── Single waveform bar ──────────────────────────────────────────────────────
const BAR_MAX_ACTIVE   = 28;
const BAR_MAX_SPEAKING = 40;
const BAR_MIN          = 3;

function WaveBar({ index, state }: { index: number; state: VoiceState }) {
  const h = useSharedValue(BAR_MIN);
  const phase = (index * 137) % 800; // golden-ratio stagger

  useEffect(() => {
    if (state === "idle") {
      h.value = withTiming(BAR_MIN, { duration: 600 });
      return;
    }
    const maxH = state === "speaking" ? BAR_MAX_SPEAKING : BAR_MAX_ACTIVE;
    const dur   = state === "speaking" ? 260 + (index % 5) * 55 : 420 + (index % 7) * 60;
    h.value = withDelay(
      phase % 300,
      withRepeat(
        withSequence(
          withTiming(BAR_MIN + Math.random() * maxH * 0.4 + maxH * 0.2, { duration: dur,       easing: Easing.inOut(Easing.sin) }),
          withTiming(BAR_MIN + Math.random() * maxH * 0.2,               { duration: dur * 0.9, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true
      )
    );
  }, [state]);

  const barStyle = useAnimatedStyle(() => ({
    height:          h.value,
    opacity:         state === "idle" ? 0.12 : state === "speaking" ? 0.55 : 0.38,
  }));

  return <Animated.View style={[styles.bar, barStyle]} />;
}

// ─── Expanding ring ───────────────────────────────────────────────────────────
function Ring({ size, delay, state }: { size: number; delay: number; state: VoiceState }) {
  const scale   = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (state === "idle") {
      opacity.value = withTiming(0, { duration: 500 });
      return;
    }
    const dur = state === "speaking" ? 1400 : 2000;
    scale.value   = withDelay(delay, withRepeat(withSequence(
      withTiming(0.7,  { duration: 0 }),
      withTiming(2.2,  { duration: dur, easing: Easing.out(Easing.ease) }),
    ), -1, false));
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(state === "speaking" ? 0.22 : 0.14, { duration: 0 }),
      withTiming(0,    { duration: dur }),
    ), -1, false));
  }, [state]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View
      style={[{
        position: "absolute",
        width:    size, height: size,
        borderRadius: size / 2,
        borderWidth:  1,
        borderColor:  "rgba(255,255,255,0.55)",
      }, style]}
      pointerEvents="none"
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 48 : insets.bottom;

  const stars = useMemo(() => makeStars(65), []);

  // Shared voice state as a React state that fans out to children
  const [state, setState] = React.useState<VoiceState>("listening");

  // ── Logo animations ──
  const logoScale   = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);
  const glowRadius  = useSharedValue(60);

  // ── Text fade ──
  const textOpacity = useSharedValue(1);

  // breathing — always on
  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.000, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true
    );
  }, []);

  // state-driven glow
  useEffect(() => {
    const targetOpacity = state === "speaking" ? 0.75 : state === "listening" ? 0.50 : 0.28;
    const targetRadius  = state === "speaking" ? 95   : state === "listening" ? 72   : 52;
    glowOpacity.value = withTiming(targetOpacity, { duration: 700, easing: Easing.out(Easing.ease) });
    glowRadius.value  = withTiming(targetRadius,  { duration: 700, easing: Easing.out(Easing.ease) });
  }, [state]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowRadius.value / 60 }],
  }));
  const textFadeStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    textOpacity.value = withSequence(
      withTiming(0, { duration: 180 }),
      withTiming(1, { duration: 380, easing: Easing.out(Easing.ease) })
    );
    setState(s => s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle");
  };

  const statusLabel = state === "listening" ? "Dinliyorum..." : state === "speaking" ? "Yanıt veriyorum..." : "Hazır";
  const statusSub   = state === "listening" ? "Net ve anlaşılır konuşabilirsin." : state === "speaking" ? "AkılCEP sana yanıt üretiyor." : "";

  const BARS = 11;

  return (
    <View style={styles.root}>

      {/* ── Stars ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map(s => (
          <View key={s.key} style={{
            position: "absolute", top: s.top, left: s.left,
            width: s.size, height: s.size, borderRadius: s.size,
            backgroundColor: "#FFFFFF", opacity: s.opacity,
          }} />
        ))}
      </View>

      {/* ── Full-screen tap ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      {/* ── Top buttons ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={20} activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.40)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} hitSlop={20} activeOpacity={0.6}>
          <Feather name="sliders" size={13} color="rgba(255,255,255,0.25)" />
        </TouchableOpacity>
      </View>

      {/* ── Center — logo + glow ── */}
      <View style={styles.center} pointerEvents="none">

        {/* Ambient glow */}
        <View style={styles.glowContainer}>
          <Animated.View style={[styles.glowCore, glowStyle]} />
        </View>

        {/* Expanding rings */}
        <View style={styles.ringsContainer}>
          <Ring size={160} delay={0}   state={state} />
          <Ring size={160} delay={600} state={state} />
          <Ring size={160} delay={1200} state={state} />
        </View>

        {/* Logo */}
        <Animated.View style={logoStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

      </View>

      {/* ── Bottom — text + waveform ── */}
      <Animated.View style={[styles.bottomBlock, { paddingBottom: btmPad + 32 }, textFadeStyle]} pointerEvents="none">

        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {statusSub ? <Text style={styles.statusSub}>{statusSub}</Text> : null}

        {/* Waveform */}
        <View style={styles.waveform}>
          {Array.from({ length: BARS }, (_, i) => (
            <WaveBar key={i} index={i} state={state} />
          ))}
        </View>

      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#020208",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0, left: 0, right: 0,
    zIndex:            20,
    flexDirection:     "row",
    justifyContent:    "space-between",
    paddingHorizontal: 26,
  },
  topBtn: {
    width:           34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.06)",
    alignItems:      "center", justifyContent: "center",
  },

  // ── Center logo area
  center: {
    position:       "absolute",
    top:            0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
    // nudge up slightly so bottom text has breathing room
    paddingBottom:  H * 0.22,
  },

  // Glow halo behind logo
  glowContainer: {
    position:       "absolute",
    width:          160, height: 160,
    alignItems:     "center", justifyContent: "center",
  },
  glowCore: {
    width:           160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.40,
    shadowRadius:    40,
  },

  // Rings sit at same center as logo
  ringsContainer: {
    position:       "absolute",
    width:          160, height: 160,
    alignItems:     "center", justifyContent: "center",
  },

  // Logo
  logo: {
    width:  100,
    height: 100,
    tintColor: "#FFFFFF",
  },

  // ── Bottom text + wave
  bottomBlock: {
    position:   "absolute",
    bottom:     0, left: 0, right: 0,
    zIndex:     10,
    alignItems: "center",
    gap:        10,
  },
  statusLabel: {
    fontSize:      19,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.3,
    color:         "rgba(255,255,255,0.72)",
  },
  statusSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.2,
    color:         "rgba(255,255,255,0.22)",
  },

  // ── Waveform
  waveform: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    marginTop:      6,
    height:         BAR_MAX_SPEAKING + 4,
  },
  bar: {
    width:           2.5,
    borderRadius:    2,
    backgroundColor: "#FFFFFF",
    alignSelf:       "center",
  },

});
