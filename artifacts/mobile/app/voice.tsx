/**
 * Voice Screen — immersive globe voice mode (modal overlay).
 * Opens directly in listening state. Tap to cycle / dismiss via close button.
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

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity:   ringOpacity.value,
  }));

  useEffect(() => {
    if (state === "listening") {
      ringScale.value   = withRepeat(withSequence(withTiming(1, { duration: 0 }), withTiming(1.9, { duration: 1500 })), -1, false);
      ringOpacity.value = withRepeat(withSequence(withTiming(0.24, { duration: 0 }), withTiming(0, { duration: 1500 })), -1, false);
    } else if (state === "speaking") {
      ringScale.value   = withRepeat(withSequence(withTiming(1, { duration: 0 }), withTiming(1.5, { duration: 850 })), -1, false);
      ringOpacity.value = withRepeat(withSequence(withTiming(0.16, { duration: 0 }), withTiming(0, { duration: 850 })), -1, false);
    } else {
      ringOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [state]);

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState(s => s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle");
  };

  const label =
    state === "listening" ? "Seni dinliyorum" :
    state === "speaking"  ? "Yanıt veriyorum" :
    "Konuşmak için dokun";

  const accentColor =
    state === "listening" ? "rgba(68,162,255,0.85)" :
    state === "speaking"  ? "rgba(255,162,60,0.85)"  :
    "rgba(255,255,255,0.28)";

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleTap}>
        <CinematicEarth voiceState={state} />
      </Pressable>

      {/* ── Close button — top right ──────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 6 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          hitSlop={16}
        >
          <Feather name="x" size={15} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom status ─────────────────────────────────────────────────── */}
      <View style={[styles.bottom, { paddingBottom: btmPad + 32 }]} pointerEvents="none">

        {/* Pulsing ring + dot */}
        <View style={styles.indicatorWrap}>
          <Animated.View style={[styles.pulseRing, { borderColor: accentColor }, ringStyle]} />
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
        </View>

        {/* Status text */}
        <Text style={[
          styles.label,
          { color: state !== "idle" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.28)" }
        ]}>
          {label}
        </Text>

        {/* Subtle hint — only in active state */}
        {state !== "idle" && (
          <Text style={styles.hint}>durdurmak için dokun</Text>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#00000c",
  },

  topBar: {
    position:     "absolute",
    top:          0,
    right:        0,
    paddingRight: 20,
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
    position:   "absolute",
    bottom:     0,
    left:       0,
    right:      0,
    alignItems: "center",
    gap:        12,
    zIndex:     20,
  },

  indicatorWrap: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  pulseRing: {
    position:     "absolute",
    width:        44,
    height:       44,
    borderRadius: 22,
    borderWidth:  1.5,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
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
    color:         "rgba(255,255,255,0.22)",
    letterSpacing: 1.2,
  },
});
