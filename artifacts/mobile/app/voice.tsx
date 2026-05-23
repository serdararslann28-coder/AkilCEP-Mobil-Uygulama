/**
 * Voice Mode — living AI consciousness.
 * VoiceCanvas handles all particles/energy. RN layer: logo, text, waveform.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import VoiceCanvas from "@/components/VoiceCanvas";

const { width: W, height: H } = Dimensions.get("window");
type VoiceState = "idle" | "listening" | "speaking";

// ─── Single waveform bar ──────────────────────────────────────────────────────
const BAR_COUNT = 13;

function WaveBar({ index, state }: { index: number; state: VoiceState }) {
  const h = useSharedValue(2.5);

  useEffect(() => {
    if (state === "idle") {
      h.value = withTiming(2.5, { duration: 700 });
      return;
    }
    const maxH  = state === "speaking" ? 34 : 22;
    const dur   = state === "speaking"
      ? 200 + (index % 5) * 44
      : 360 + (index % 7) * 52;
    // Each bar gets a unique offset so they don't move in sync
    const delay = (index * 97) % 280;

    h.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(maxH * (0.35 + ((index * 31) % 100) / 150), { duration: dur,       easing: Easing.inOut(Easing.sin) }),
        withTiming(maxH * (0.10 + ((index * 17) % 100) / 300), { duration: dur * 0.9, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true
    ));
  }, [state]);

  const style = useAnimatedStyle(() => ({
    height:  h.value,
    opacity: state === "idle" ? 0.10 : state === "speaking" ? 0.60 : 0.40,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 48 : insets.bottom;

  const [state, setState] = React.useState<VoiceState>("listening");

  // ── Opening entrance ──
  const logoOpacity = useSharedValue(0);
  const logoScale   = useSharedValue(0.55);
  const logoBlur    = useSharedValue(10);   // simulated via opacity
  const textOpacity = useSharedValue(0);
  const topOpacity  = useSharedValue(0);

  // ── Ongoing breathing ──
  const breathScale = useSharedValue(1);

  // ── State-driven glow ──
  const glowOpacity = useSharedValue(0.18);
  const glowScale   = useSharedValue(1);

  // ── Text cross-fade on state change ──
  const labelOpacity = useSharedValue(1);

  useEffect(() => {
    // Entrance sequence
    // 1. Canvas particles start immediately (inside WebView)
    // 2. After 400ms: top buttons fade in
    // 3. After 900ms: logo springs in
    // 4. After 1400ms: text fades in

    topOpacity.value = withDelay(400,  withTiming(1, { duration: 600 }));
    logoOpacity.value= withDelay(800,  withSpring(1,  { damping: 18, stiffness: 90 }));
    logoScale.value  = withDelay(800,  withSpring(1,  { damping: 14, stiffness: 70 }));
    textOpacity.value= withDelay(1500, withTiming(1, { duration: 700 }));

    // Breathing — starts after entrance
    const t = setTimeout(() => {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.040, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.000, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true
      );
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  // State-driven glow intensity
  useEffect(() => {
    const targetOpacity = state === "speaking" ? 0.80 : state === "listening" ? 0.42 : 0.18;
    const targetGlow    = state === "speaking" ? 1.20 : state === "listening" ? 1.05 : 0.90;
    glowOpacity.value = withTiming(targetOpacity, { duration: 600, easing: Easing.out(Easing.ease) });
    glowScale.value   = withTiming(targetGlow,    { duration: 600, easing: Easing.out(Easing.ease) });
  }, [state]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Cross-fade text
    labelOpacity.value = withSequence(
      withTiming(0, { duration: 160 }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    setState(s => s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle");
  };

  // ── Animated styles ──
  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value * breathScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity:   glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const topBarStyle  = useAnimatedStyle(() => ({ opacity: topOpacity.value }));
  const bottomStyle  = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const labelStyle   = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  const statusLabel = state === "listening" ? "Dinliyorum..."
    : state === "speaking" ? "Yanıt veriyorum..."
    : "Hazır";
  const statusSub = state === "listening" ? "Net ve anlaşılır konuşabilirsin."
    : state === "speaking" ? "AkılCEP sana yanıt üretiyor."
    : "";

  return (
    <View style={styles.root}>

      {/* ── Full-screen canvas particle engine ── */}
      <VoiceCanvas voiceState={state} />

      {/* ── Full-screen tap surface ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      {/* ── Top bar (ghost buttons) ── */}
      <Animated.View style={[styles.topBar, { paddingTop: topPad + 12 }, topBarStyle]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={20}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={17} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} hitSlop={20} activeOpacity={0.6}>
          <Feather name="sliders" size={13} color="rgba(255,255,255,0.28)" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Logo — centered ── */}
      <View style={styles.logoArea} pointerEvents="none">

        {/* Glow halo */}
        <Animated.View style={[styles.glowHalo, glowStyle]} />

        {/* Logo image — large, white */}
        <Animated.View style={logoContainerStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

      </View>

      {/* ── Bottom: text + waveform ── */}
      <Animated.View
        style={[styles.bottomBlock, { paddingBottom: btmPad + 36 }, bottomStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.textWrap, labelStyle]}>
          <Text style={styles.statusLabel}>{statusLabel}</Text>
          {statusSub ? <Text style={styles.statusSub}>{statusSub}</Text> : null}
        </Animated.View>

        {/* Waveform */}
        <View style={styles.waveform}>
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <WaveBar key={i} index={i} state={state} />
          ))}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const LOGO_SIZE = Math.round(W * 0.50);   // 50% of screen width — dominant
const GLOW_SIZE = LOGO_SIZE * 2.4;

const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#020208",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0, left: 0, right: 0,
    zIndex:            30,
    flexDirection:     "row",
    justifyContent:    "space-between",
    paddingHorizontal: 26,
  },
  topBtn: {
    width:           36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.07)",
    alignItems:      "center", justifyContent: "center",
  },

  // ── Logo area — vertically centered, slightly above midpoint
  logoArea: {
    position:       "absolute",
    top:            0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  H * 0.18,
  },

  // Ambient glow behind logo
  glowHalo: {
    position:        "absolute",
    width:           GLOW_SIZE,
    height:          GLOW_SIZE,
    borderRadius:    GLOW_SIZE / 2,
    backgroundColor: "rgba(210,225,255,0.06)",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.55,
    shadowRadius:    LOGO_SIZE * 0.55,
  },

  // Logo
  logo: {
    width:     LOGO_SIZE,
    height:    LOGO_SIZE,
    tintColor: "#FFFFFF",
  },

  // ── Bottom
  bottomBlock: {
    position:   "absolute",
    bottom:     0, left: 0, right: 0,
    zIndex:     20,
    alignItems: "center",
    gap:        14,
  },
  textWrap: {
    alignItems: "center",
    gap:        8,
  },
  statusLabel: {
    fontSize:      20,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.3,
    color:         "rgba(255,255,255,0.78)",
  },
  statusSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.2,
    color:         "rgba(255,255,255,0.24)",
  },

  // ── Waveform
  waveform: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4.5,
    height:        44,
  },
  bar: {
    width:           2.5,
    borderRadius:    2,
    backgroundColor: "#FFFFFF",
    alignSelf:       "center",
  },

});
