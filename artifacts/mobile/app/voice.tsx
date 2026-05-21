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

type VoiceState = "idle" | "listening" | "speaking";

const BAR_COUNT = 24;

interface WaveBarProps {
  index: number;
  total: number;
  active: boolean;
}

function WaveBar({ index, total, active }: WaveBarProps) {
  const height = useSharedValue(3);
  const maxH = 6 + Math.sin((index / total) * Math.PI) * 26;
  const delay = (index / total) * 260;
  const dur = 180 + ((index * 37) % 200);

  useEffect(() => {
    if (active) {
      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxH * (0.5 + ((index * 13) % 50) / 100), { duration: dur }),
            withTiming(3 + ((index * 7) % 8), { duration: dur })
          ),
          -1,
          true
        )
      );
    } else {
      height.value = withTiming(3);
    }
  }, [active]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));
  const color = index % 3 === 0 ? "#111111" : index % 3 === 1 ? "#A1A1AA" : "#D4D4D8";

  return (
    <Animated.View style={[styles.waveBar, { backgroundColor: color }, barStyle]} />
  );
}

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>("listening");

  const ring1Scale = useSharedValue(1);
  const ring2Scale = useSharedValue(1);
  const ring3Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.12);
  const ring2Opacity = useSharedValue(0.07);
  const ring3Opacity = useSharedValue(0.04);
  const orbScale = useSharedValue(1);

  useEffect(() => {
    if (state === "idle") {
      ring1Scale.value = withTiming(1);
      ring2Scale.value = withTiming(1);
      ring3Scale.value = withTiming(1);
      orbScale.value = withTiming(1);
      return;
    }
    const speed = state === "speaking" ? 0.7 : 1;
    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 1000 * speed }),
        withTiming(1, { duration: 1000 * speed })
      ),
      -1, true
    );
    ring2Scale.value = withDelay(180, withRepeat(
      withSequence(
        withTiming(1.28, { duration: 1200 * speed }),
        withTiming(1, { duration: 1200 * speed })
      ),
      -1, true
    ));
    ring3Scale.value = withDelay(360, withRepeat(
      withSequence(
        withTiming(1.44, { duration: 1400 * speed }),
        withTiming(1, { duration: 1400 * speed })
      ),
      -1, true
    ));
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 800 * speed }),
        withTiming(0.95, { duration: 800 * speed })
      ),
      -1, true
    );
  }, [state]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const stateLabel =
    state === "listening" ? "Dinliyorum..." : state === "speaking" ? "Yanıtlıyorum..." : "Hazır";

  return (
    <View style={[styles.container, { backgroundColor: "#F7F7F7" }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={10}>
          <View style={styles.closePill}>
            <Feather name="x" size={18} color="#111111" />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Sesli Mod</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.orbSection}>
        <Animated.View style={[styles.ring3, ring3Style]} />
        <Animated.View style={[styles.ring2, ring2Style]} />
        <Animated.View style={[styles.ring1, ring1Style]} />
        <Animated.View style={[styles.orbShadow, orbStyle]}>
          <View style={styles.orb}>
            <View style={styles.orbInner}>
              <Feather name="mic" size={28} color="#F7F7F7" />
            </View>
          </View>
        </Animated.View>
      </View>

      <Text style={styles.stateLabel}>{stateLabel}</Text>
      <Text style={styles.hint}>
        {state === "listening" ? "Konuşun, sizi dinliyorum" : "AkılCEP yanıtlıyor..."}
      </Text>

      <View style={styles.waveContainer}>
        {bars.map((i) => (
          <WaveBar key={i} index={i} total={BAR_COUNT} active={state !== "idle"} />
        ))}
      </View>

      <View style={[styles.controls, { paddingBottom: bottomPad + 24 }]}>
        <TouchableOpacity
          style={styles.controlBtn}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setState("idle");
          }}
        >
          <Feather name="pause" size={19} color="#9E9E9E" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mainBtn,
            {
              backgroundColor: state === "listening" ? "#111111" : "#E0E0E0",
              shadowColor: state === "listening" ? "#111111" : "#000",
              shadowOpacity: state === "listening" ? 0.22 : 0.08,
            },
          ]}
          onPress={handleToggle}
          activeOpacity={0.82}
        >
          <Feather
            name={state === "listening" ? "mic" : "mic-off"}
            size={26}
            color={state === "listening" ? "#FFFFFF" : "#9E9E9E"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} hitSlop={8}>
          <Feather name="volume-2" size={19} color="#9E9E9E" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#111111",
    letterSpacing: -0.3,
  },
  placeholder: {
    width: 40,
  },
  orbSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  ring3: {
    position: "absolute",
    width: 248,
    height: 248,
    borderRadius: 124,
    backgroundColor: "#111111",
  },
  ring2: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#111111",
  },
  ring1: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#111111",
  },
  orbShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  orb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  orbInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  stateLabel: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    color: "#111111",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9E9E9E",
    marginBottom: 32,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 56,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 3,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 40,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  mainBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
  },
});
