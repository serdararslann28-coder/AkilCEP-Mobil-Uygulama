/**
 * Voice Mode — living AI consciousness.
 * VoiceCanvas owns particles + formation.
 * Logo materialises exactly when particles reach their targets.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
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

// ─── Waveform bar ─────────────────────────────────────────────────────────────
const N_BARS = 13;

function WaveBar({ index, state }: { index: number; state: VoiceState }) {
  const h = useSharedValue(2);

  useEffect(() => {
    if (state === "idle") {
      h.value = withTiming(2, { duration: 600 });
      return;
    }
    const maxH = state === "speaking" ? 32 : 20;
    const dur  = state === "speaking"
      ? 190 + (index % 5) * 42
      : 380 + (index % 7) * 50;
    const stagger = (index * 89) % 260;

    h.value = withDelay(
      stagger,
      withRepeat(
        withSequence(
          withTiming(maxH * (0.4 + (index * 37 % 100) / 165), {
            duration: dur,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(maxH * (0.08 + (index * 23 % 100) / 280), {
            duration: dur * 0.85,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1, true
      )
    );
  }, [state]);

  const style = useAnimatedStyle(() => ({
    height:  h.value,
    opacity: state === "idle" ? 0.09 : state === "speaking" ? 0.62 : 0.38,
  }));

  return <Animated.View style={[ss.bar, style]} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 48 : insets.bottom;

  const [state, setState] = React.useState<VoiceState>("listening");

  // ── Entrance values ──
  const topOpacity  = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale   = useSharedValue(0.82);
  const btmOpacity  = useSharedValue(0);

  // ── Ongoing breath ──
  const breathScale = useSharedValue(1);

  // ── State-driven glow behind logo ──
  const glowOpacity = useSharedValue(0.14);
  const glowScale   = useSharedValue(1);

  // ── Label cross-fade ──
  const labelA = useSharedValue(1);

  // Entrance sequence — top & bottom appear immediately,
  // logo waits for canvas formationDone callback
  useEffect(() => {
    topOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));
    btmOpacity.value = withDelay(600, withTiming(1, { duration: 800 }));

    // Start breathing loop (runs quietly, logo invisible at first)
    const t = setTimeout(() => {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.038, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.000, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true
      );
    }, 100);

    return () => clearTimeout(t);
  }, []);

  // Called by canvas when particles have fully converged
  const handleFormationDone = useCallback(() => {
    logoOpacity.value = withSpring(1,   { damping: 22, stiffness: 60 });
    logoScale.value   = withSpring(1.0, { damping: 18, stiffness: 55 });
  }, []);

  // State-driven glow
  useEffect(() => {
    const op = state === "speaking" ? 0.82 : state === "listening" ? 0.44 : 0.14;
    const sc = state === "speaking" ? 1.22 : state === "listening" ? 1.06 : 0.94;
    glowOpacity.value = withTiming(op, { duration: 650, easing: Easing.out(Easing.ease) });
    glowScale.value   = withTiming(sc, { duration: 650, easing: Easing.out(Easing.ease) });
  }, [state]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    labelA.value = withSequence(
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    setState(s =>
      s === "idle"      ? "listening" :
      s === "listening" ? "speaking"  : "idle"
    );
  };

  // ── Animated styles ──
  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value * breathScale.value }],
  }));
  const glowStyle  = useAnimatedStyle(() => ({
    opacity:   glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const topStyle   = useAnimatedStyle(() => ({ opacity: topOpacity.value }));
  const btmStyle   = useAnimatedStyle(() => ({ opacity: btmOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelA.value }));

  const statusLabel =
    state === "listening" ? "Dinliyorum..."      :
    state === "speaking"  ? "Yanıt veriyorum..." : "Hazır";

  const statusSub =
    state === "listening" ? "Net ve anlaşılır konuşabilirsin."  :
    state === "speaking"  ? "AkılCEP sana yanıt üretiyor."      : "";

  return (
    <View style={ss.root}>

      {/* ── Particle canvas — full-screen behind everything ── */}
      <VoiceCanvas voiceState={state} onFormationDone={handleFormationDone} />

      {/* ── Tap surface ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      {/* ── Top bar ── */}
      <Animated.View
        style={[ss.topBar, { paddingTop: topPad + 14 }, topStyle]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={ss.topBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={20}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={17} color="rgba(255,255,255,0.48)" />
        </TouchableOpacity>

        <TouchableOpacity style={ss.topBtn} hitSlop={20} activeOpacity={0.6}>
          <Feather name="sliders" size={13} color="rgba(255,255,255,0.28)" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Logo — centered, slightly above midpoint ── */}
      <View style={ss.logoArea} pointerEvents="none">
        {/* Glow halo */}
        <Animated.View style={[ss.glowHalo, glowStyle]} />

        {/* Logo image materialises after particle formation */}
        <Animated.View style={logoContainerStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={ss.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* ── Status text + waveform ── */}
      <Animated.View
        style={[ss.bottomBlock, { paddingBottom: btmPad + 40 }, btmStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[ss.labelWrap, labelStyle]}>
          <Text style={ss.label}>{statusLabel}</Text>
          {statusSub ? <Text style={ss.sub}>{statusSub}</Text> : null}
        </Animated.View>

        <View style={ss.waveform}>
          {Array.from({ length: N_BARS }, (_, i) => (
            <WaveBar key={i} index={i} state={state} />
          ))}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const LOGO_SIZE = Math.round(Math.min(W, H) * 0.36);
const GLOW_SIZE = LOGO_SIZE * 2.6;

const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#010108",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top: 0, left: 0, right: 0,
    zIndex:            30,
    flexDirection:     "row",
    justifyContent:    "space-between",
    paddingHorizontal: 24,
  },
  topBtn: {
    width:           36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.08)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Logo area
  logoArea: {
    position:       "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  H * 0.20,
  },
  glowHalo: {
    position:        "absolute",
    width:           GLOW_SIZE,
    height:          GLOW_SIZE,
    borderRadius:    GLOW_SIZE / 2,
    backgroundColor: "rgba(180,210,255,0.04)",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.55,
    shadowRadius:    LOGO_SIZE * 0.6,
  },
  logo: {
    width:     LOGO_SIZE,
    height:    LOGO_SIZE,
    tintColor: "#FFFFFF",
  },

  // ── Bottom
  bottomBlock: {
    position:   "absolute",
    bottom: 0, left: 0, right: 0,
    zIndex:     20,
    alignItems: "center",
    gap:        16,
  },
  labelWrap: {
    alignItems: "center",
    gap:        9,
  },
  label: {
    fontSize:      20,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.4,
    color:         "rgba(255,255,255,0.78)",
  },
  sub: {
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
    height:        42,
  },
  bar: {
    width:           2.5,
    borderRadius:    2,
    backgroundColor: "#FFFFFF",
    alignSelf:       "center",
  },

});
