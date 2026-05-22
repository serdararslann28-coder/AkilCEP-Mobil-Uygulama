import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CinematicEarth from "@/components/CinematicEarth";

type VoiceState = "idle" | "listening" | "speaking";

const BAR_COUNT = 28;

interface WaveBarProps {
  index: number;
  total: number;
  active: boolean;
  state: VoiceState;
}

function WaveBar({ index, total, active, state }: WaveBarProps) {
  const height = useSharedValue(2);
  const maxH   = 5 + Math.sin((index / total) * Math.PI) * 28;
  const delay  = (index / total) * 280;
  const dur    = 160 + ((index * 41) % 220);

  useEffect(() => {
    if (active) {
      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxH * (0.45 + ((index * 17) % 55) / 100), { duration: dur }),
            withTiming(2 + ((index * 7) % 6), { duration: dur })
          ),
          -1,
          true
        )
      );
    } else {
      height.value = withTiming(2);
    }
  }, [active]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));

  // Speaking = warm white, listening = cool blue-white
  const baseOpacity = state === "speaking" ? 0.9 : 0.65;
  const color =
    index % 3 === 0
      ? `rgba(255,255,255,${baseOpacity})`
      : index % 3 === 1
      ? `rgba(180,210,255,${baseOpacity - 0.2})`
      : `rgba(140,180,255,${baseOpacity - 0.35})`;

  return (
    <Animated.View
      style={[styles.waveBar, { backgroundColor: color }, barStyle]}
    />
  );
}

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>("listening");

  // ── Mic pulse ring ─────────────────────────────────────────
  const ring1Scale   = useSharedValue(1);
  const ring2Scale   = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Opacity = useSharedValue(0);
  const orbPulse     = useSharedValue(1);

  useEffect(() => {
    if (state === "idle") {
      ring1Scale.value   = withTiming(1);
      ring2Scale.value   = withTiming(1);
      ring1Opacity.value = withTiming(0);
      ring2Opacity.value = withTiming(0);
      orbPulse.value     = withTiming(1);
      return;
    }
    const spd = state === "speaking" ? 0.75 : 1;
    ring1Opacity.value = withTiming(state === "speaking" ? 0.45 : 0.3);
    ring2Opacity.value = withTiming(state === "speaking" ? 0.25 : 0.15);
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900 * spd }),
        withTiming(1.0,  { duration: 900 * spd })
      ),
      -1, true
    );
    ring2Scale.value = withDelay(200, withRepeat(
      withSequence(
        withTiming(1.36, { duration: 1200 * spd }),
        withTiming(1.0,  { duration: 1200 * spd })
      ),
      -1, true
    ));
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 700 * spd }),
        withTiming(0.94, { duration: 700 * spd })
      ),
      -1, true
    );
  }, [state]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity:   ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity:   ring2Opacity.value,
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }],
  }));

  const bars = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => i), []);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState((s) => (s === "listening" ? "speaking" : "listening"));
  };
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const topPad    = Platform.OS === "web" ? 56 : insets.top;
  const bottomPad = Platform.OS === "web" ? 28 : insets.bottom;

  const stateLabel =
    state === "listening" ? "Dinliyorum..." :
    state === "speaking"  ? "Yanıtlıyorum..." : "Hazır";

  const stateHint =
    state === "listening" ? "Konuşun, sizi dinliyorum" : "AkılCEP yanıtlıyor...";

  return (
    <View style={styles.container}>

      {/* ── Cinematic Earth — full screen background ──────── */}
      <View style={StyleSheet.absoluteFillObject}>
        <CinematicEarth voiceState={state} />
      </View>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={styles.glassBtn}
          onPress={handleClose}
          hitSlop={10}
        >
          <Feather name="x" size={18} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        <View style={styles.titlePill}>
          <Text style={styles.titleText}>Sesli Mod</Text>
        </View>

        <View style={styles.glassBtn} />
      </View>

      {/* ── Spacer — Earth breathes in middle ───────────────── */}
      <View style={styles.spacer} />

      {/* ── Mic orb — overlaid center-bottom of Earth ──────── */}
      <View style={styles.orbSection}>
        <Animated.View style={[styles.ring2, ring2Style]} />
        <Animated.View style={[styles.ring1, ring1Style]} />
        <Animated.View style={orbStyle}>
          <TouchableOpacity
            style={[
              styles.orbBtn,
              {
                backgroundColor:
                  state === "listening"
                    ? "rgba(20,20,30,0.82)"
                    : "rgba(40,40,60,0.75)",
                borderColor:
                  state === "listening"
                    ? "rgba(180,210,255,0.5)"
                    : "rgba(100,140,220,0.35)",
              },
            ]}
            onPress={handleToggle}
            activeOpacity={0.8}
          >
            <Feather
              name={state === "listening" ? "mic" : "mic-off"}
              size={26}
              color={
                state === "listening"
                  ? "rgba(200,225,255,0.95)"
                  : "rgba(140,170,220,0.7)"
              }
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Voice status + wave ──────────────────────────────── */}
      <View style={styles.statusSection}>
        <Text style={styles.stateLabel}>{stateLabel}</Text>
        <Text style={styles.hint}>{stateHint}</Text>

        <View style={styles.waveContainer}>
          {bars.map((i) => (
            <WaveBar
              key={i}
              index={i}
              total={BAR_COUNT}
              active={state !== "idle"}
              state={state}
            />
          ))}
        </View>
      </View>

      {/* ── Bottom controls ──────────────────────────────────── */}
      <View style={[styles.controls, { paddingBottom: bottomPad + 20 }]}>
        <TouchableOpacity
          style={styles.controlBtn}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setState("idle");
          }}
        >
          <Feather name="pause" size={18} color="rgba(200,220,255,0.65)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mainBtn,
            {
              backgroundColor:
                state === "listening"
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(60,70,100,0.75)",
            },
          ]}
          onPress={handleToggle}
          activeOpacity={0.82}
        >
          <Feather
            name={state === "listening" ? "mic" : "mic-off"}
            size={26}
            color={state === "listening" ? "#111111" : "rgba(180,200,255,0.8)"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} hitSlop={8}>
          <Feather name="volume-2" size={18} color="rgba(200,220,255,0.65)" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#000008",
  },

  /* ── Top bar ── */
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  titlePill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  titleText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.3,
  },

  /* ── Spacer (Earth breathes here) ── */
  spacer: { flex: 1 },

  /* ── Mic orb with pulse rings ── */
  orbSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    zIndex: 10,
  },
  ring2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: "rgba(150,190,255,0.6)",
    backgroundColor: "transparent",
  },
  ring1: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "rgba(180,215,255,0.7)",
    backgroundColor: "transparent",
  },
  orbBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Status + wave ── */
  statusSection: {
    alignItems: "center",
    marginBottom: 10,
    zIndex: 10,
  },
  stateLabel: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(160,190,255,0.65)",
    marginBottom: 22,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 52,
    paddingHorizontal: 28,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 2,
    minHeight: 2,
  },

  /* ── Controls ── */
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingHorizontal: 40,
    zIndex: 10,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
  },
});
