/**
 * Voice Screen — the Earth IS the AI.
 *
 * Minimal: no mic buttons, no waveforms.
 * Tap anywhere → cycle state. Earth reacts visually.
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
  const [state, setState] = useState<VoiceState>("idle");

  // Tiny indicator dot — pulses per state
  const dotScale   = useSharedValue(1);
  const dotOpacity = useSharedValue(0.35);

  useEffect(() => {
    if (state === "listening") {
      dotScale.value = withRepeat(
        withSequence(withTiming(1.6, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1, true
      );
      dotOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0.28, { duration: 700 })),
        -1, true
      );
    } else if (state === "speaking") {
      dotScale.value = withRepeat(
        withSequence(withTiming(1.35, { duration: 420 }), withTiming(0.88, { duration: 420 })),
        -1, true
      );
      dotOpacity.value = withTiming(0.90);
    } else {
      dotScale.value   = withTiming(1);
      dotOpacity.value = withTiming(0.30);
    }
  }, [state]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity:   dotOpacity.value,
  }));

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState(s =>
      s === "idle"      ? "listening" :
      s === "listening" ? "speaking"  : "listening"
    );
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const topPad = Platform.OS === "web" ? 20 : insets.top + 14;
  const btmPad = Platform.OS === "web" ? 40 : insets.bottom + 32;

  const label =
    state === "listening" ? "Dinliyorum..." :
    state === "speaking"  ? "Yanıtlıyorum..." :
    "Konuşmak için dokun";

  const dotColor =
    state === "listening" ? "rgba(100,185,255,0.95)" :
    state === "speaking"  ? "rgba(255,175,70,0.95)"  :
    "rgba(255,255,255,0.35)";

  return (
    <View style={styles.container}>

      {/* ── Earth fills entire screen — tap anywhere ─────────────────── */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleTap}
      >
        <CinematicEarth voiceState={state} />
      </Pressable>

      {/* ── Top edge — close button ───────────────────────────────────── */}
      <View
        style={[styles.topEdge, { paddingTop: topPad }, { pointerEvents: "box-none" } as any]}
      >
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={18}
          style={styles.closeBtn}
          activeOpacity={0.6}
        >
          <Feather name="x" size={16} color="rgba(255,255,255,0.42)" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom edge — state indicator ────────────────────────────── */}
      <View
        style={[styles.bottomEdge, { paddingBottom: btmPad }, { pointerEvents: "none" } as any]}
      >
        <Animated.View
          style={[styles.dot, { backgroundColor: dotColor }, dotStyle]}
        />
        <Text style={styles.label}>{label}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000010",
  },

  topEdge: {
    position:  "absolute",
    top:        0,
    right:      0,
    paddingRight: 20,
    zIndex:    20,
    alignItems: "flex-end",
  },
  closeBtn: {
    width:  36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomEdge: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    alignItems: "center",
    zIndex:   20,
  },
  dot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
    marginBottom: 8,
  },
  label: {
    fontSize:     11,
    color:        "rgba(255,255,255,0.38)",
    letterSpacing: 2.0,
    textTransform: "uppercase",
    fontFamily:   "Inter_400Regular",
  },
});
