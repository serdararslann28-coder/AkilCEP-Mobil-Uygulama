/**
 * Voice Mode — cinematic AI presence.
 * The Earth IS the interface. Everything else is silence.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CinematicEarth from "@/components/CinematicEarth";

const { width: W, height: H } = Dimensions.get("window");

type VoiceState = "idle" | "listening" | "speaking";

// ─── Deterministic stars ──────────────────────────────────────────────────────
function makeStars(n: number) {
  let seed = 0xc0ffee42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    key: i,
    top:     rng() * H,
    left:    rng() * W,
    size:    rng() * 1.4 + 0.3,
    opacity: rng() * 0.28 + 0.05,
  }));
}

export default function VoiceScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top;
  const btmPad  = Platform.OS === "web" ? 40 : insets.bottom;

  const [state, setState] = useState<VoiceState>("listening");
  const stars = useMemo(() => makeStars(60), []);

  // ── Text fade when state changes ──
  const textOpacity = useSharedValue(1);

  const cycleState = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    textOpacity.value = withSequence(
      withTiming(0, { duration: 200 }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    setState(s =>
      s === "idle"      ? "listening" :
      s === "listening" ? "speaking"  : "idle"
    );
  };

  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const label =
    state === "listening" ? "Dinliyorum..." :
    state === "speaking"  ? "Yanıt veriyorum..." :
    "Hazır";

  const sub =
    state === "listening" ? "Net ve anlaşılır konuşabilirsin." :
    state === "speaking"  ? "AkılCEP sana yanıt üretiyor." :
    "";

  return (
    <View style={styles.root}>

      {/* ── Stars ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map(s => (
          <View
            key={s.key}
            style={{
              position:        "absolute",
              top:             s.top,
              left:            s.left,
              width:           s.size,
              height:          s.size,
              borderRadius:    s.size,
              backgroundColor: "#FFFFFF",
              opacity:         s.opacity,
            }}
          />
        ))}
      </View>

      {/* ── Earth (full-screen tap surface) ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={cycleState}>
        <CinematicEarth voiceState={state} />
      </Pressable>

      {/* ── Top chrome — two tiny buttons only ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={20}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topBtn} hitSlop={20} activeOpacity={0.6}>
          <Feather name="sliders" size={13} color="rgba(255,255,255,0.30)" />
        </TouchableOpacity>
      </View>

      {/* ── Status text — only two lines, nothing else ── */}
      <Animated.View
        style={[styles.textBlock, { paddingBottom: btmPad + 40 }, textStyle]}
        pointerEvents="none"
      >
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#020208",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    zIndex:            20,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 26,
  },
  topBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.07)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Status text
  textBlock: {
    position:   "absolute",
    bottom:     0,
    left:       0,
    right:      0,
    zIndex:     20,
    alignItems: "center",
    gap:        8,
  },
  label: {
    fontSize:      18,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.3,
    color:         "rgba(255,255,255,0.72)",
  },
  sub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.25)",
    letterSpacing: 0.2,
  },

});
