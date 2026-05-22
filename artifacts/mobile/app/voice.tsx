/**
 * Voice Screen — immersive globe voice mode (modal overlay).
 * Opens directly in listening state. Tap to pause / dismiss.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CinematicEarth from "@/components/CinematicEarth";

type VoiceState = "idle" | "listening" | "speaking";

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>("listening");

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 40 : insets.bottom;

  // Expanding ring behind the indicator dot
  const ringScale   = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  // 7 waveform bars — declared at top level
  const b0 = useSharedValue(0.10);
  const b1 = useSharedValue(0.10);
  const b2 = useSharedValue(0.10);
  const b3 = useSharedValue(0.10);
  const b4 = useSharedValue(0.10);
  const b5 = useSharedValue(0.10);
  const b6 = useSharedValue(0.10);

  const s0 = useAnimatedStyle(() => ({ height: Math.max(2, b0.value * 11) }));
  const s1 = useAnimatedStyle(() => ({ height: Math.max(2, b1.value * 15) }));
  const s2 = useAnimatedStyle(() => ({ height: Math.max(2, b2.value * 20) }));
  const s3 = useAnimatedStyle(() => ({ height: Math.max(2, b3.value * 24) }));
  const s4 = useAnimatedStyle(() => ({ height: Math.max(2, b4.value * 20) }));
  const s5 = useAnimatedStyle(() => ({ height: Math.max(2, b5.value * 15) }));
  const s6 = useAnimatedStyle(() => ({ height: Math.max(2, b6.value * 11) }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity:   ringOpacity.value,
  }));

  useEffect(() => {
    // Expanding ring
    if (state === "listening") {
      ringScale.value   = withRepeat(withSequence(withTiming(1, { duration: 0 }), withTiming(1.8, { duration: 1500 })), -1, false);
      ringOpacity.value = withRepeat(withSequence(withTiming(0.22, { duration: 0 }), withTiming(0, { duration: 1500 })), -1, false);
    } else if (state === "speaking") {
      ringScale.value   = withRepeat(withSequence(withTiming(1, { duration: 0 }), withTiming(1.45, { duration: 850 })), -1, false);
      ringOpacity.value = withRepeat(withSequence(withTiming(0.16, { duration: 0 }), withTiming(0, { duration: 850 })), -1, false);
    } else {
      ringOpacity.value = withTiming(0, { duration: 300 });
    }

    // Waveform bars
    const vals = [b0, b1, b2, b3, b4, b5, b6];
    const dur  = state === "speaking"  ? [265, 215, 175, 150, 175, 215, 265]
               : state === "listening" ? [500, 420, 365, 325, 365, 420, 500]
               : [2000, 1750, 1550, 1350, 1550, 1750, 2000];
    const peak = state === "speaking"  ? [0.50, 0.70, 0.88, 1.00, 0.88, 0.70, 0.50]
               : state === "listening" ? [0.36, 0.54, 0.72, 0.90, 0.72, 0.54, 0.36]
               : [0.14, 0.20, 0.26, 0.32, 0.26, 0.20, 0.14];
    vals.forEach((v, i) => {
      v.value = withRepeat(
        withSequence(withTiming(peak[i], { duration: dur[i] }), withTiming(0.05, { duration: dur[i] })),
        -1, true
      );
    });
  }, [state]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState(s => s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle");
  };

  const label =
    state === "listening" ? "Seni dinliyorum" :
    state === "speaking"  ? "Yanıt veriyorum" :
    "Konuşmak için dokun";

  const hint = state !== "idle" ? "durdurmak için dokun" : "";

  const accentColor =
    state === "listening" ? "rgba(68,162,255,0.80)" :
    state === "speaking"  ? "rgba(255,162,60,0.80)"  :
    "rgba(255,255,255,0.28)";

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleTap}>
        <CinematicEarth voiceState={state} />
      </Pressable>

      {/* ── Close button ─────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 4 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={16}
        >
          <Feather name="x" size={15} color="rgba(255,255,255,0.42)" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom status ────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingBottom: btmPad + 18 }]} pointerEvents="none">

        {/* Pulsing ring + dot */}
        <View style={styles.indicatorWrap}>
          <Animated.View style={[styles.pulseRing, { borderColor: accentColor }, ringStyle]} />
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
        </View>

        {/* Status */}
        <Text style={[styles.label, { color: state !== "idle" ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.30)" }]}>
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}

        {/* Waveform */}
        <View style={styles.waveRow}>
          {Array.from({ length: 10 }, (_, i) => <View key={`ld${i}`} style={styles.waveDot} />)}
          <Animated.View style={[styles.waveBar, s0]} />
          <Animated.View style={[styles.waveBar, s1]} />
          <Animated.View style={[styles.waveBar, s2]} />
          <Animated.View style={[styles.waveBar, s3]} />
          <Animated.View style={[styles.waveBar, s4]} />
          <Animated.View style={[styles.waveBar, s5]} />
          <Animated.View style={[styles.waveBar, s6]} />
          {Array.from({ length: 10 }, (_, i) => <View key={`rd${i}`} style={styles.waveDot} />)}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000010",
  },

  topBar: {
    position:     "absolute",
    top:          0,
    right:        0,
    paddingRight: 18,
    zIndex:       20,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.09)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  bottom: {
    position:  "absolute",
    bottom:    0,
    left:      0,
    right:     0,
    alignItems: "center",
    zIndex:    20,
    gap:       7,
  },
  indicatorWrap: {
    width:          40,
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   4,
  },
  pulseRing: {
    position:     "absolute",
    width:        40,
    height:       40,
    borderRadius: 20,
    borderWidth:  1.5,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  label: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  hint: {
    fontSize:      9,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.20)",
    letterSpacing: 1.2,
  },

  waveRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
    marginTop:     6,
    height:        26,
  },
  waveDot: {
    width:           1.5,
    height:          1.5,
    borderRadius:    1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  waveBar: {
    width:           2.5,
    borderRadius:    1.5,
    backgroundColor: "rgba(148,202,255,0.60)",
  },
});
