/**
 * Voice Mode — AI Voice Playback.
 * Receives the last AI message text via router params.
 * Reads it aloud with expo-speech. No microphone. No recording.
 * Always dark #010108 — never adapts to global theme.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Platform,
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

type PlayPhase = "idle" | "playing" | "paused" | "done";

const STATUS: Record<PlayPhase, string> = {
  idle:   "Ses hazır",
  playing:"AkılCEP sizi dinliyor",
  paused: "Duraklatıldı",
  done:   "Tamamlandı",
};

export default function VoiceScreen() {
  const params  = useLocalSearchParams<{ text?: string }>();
  const text    = params.text ?? "";

  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top;
  const btmPad  = Platform.OS === "web" ? 20 : insets.bottom;

  const [phase, setPhase] = useState<PlayPhase>("idle");
  const hasText = text.trim().length > 0;

  // guard against re-speaking on re-render
  const speakingRef = useRef(false);

  // ── Animation shared values ────────────────────────────────────────────────
  const topOp     = useSharedValue(0);
  const logoOp    = useSharedValue(0);
  const logoSc    = useSharedValue(0.84);
  const breathSc  = useSharedValue(1);
  const glowOp    = useSharedValue(0.12);
  const glowSc    = useSharedValue(1);
  const btnSc     = useSharedValue(1);
  const statusOp  = useSharedValue(0);
  const textOp    = useSharedValue(0);

  // waveform bars (7 bars)
  const b0 = useSharedValue(0.15);
  const b1 = useSharedValue(0.15);
  const b2 = useSharedValue(0.15);
  const b3 = useSharedValue(0.15);
  const b4 = useSharedValue(0.15);
  const b5 = useSharedValue(0.15);
  const b6 = useSharedValue(0.15);
  const bars = [b0, b1, b2, b3, b4, b5, b6];

  // ── Entrance animation ─────────────────────────────────────────────────────
  useEffect(() => {
    topOp.value    = withDelay(200, withTiming(1, { duration: 700 }));
    statusOp.value = withDelay(900, withTiming(1, { duration: 600 }));

    const t = setTimeout(() => {
      breathSc.value = withRepeat(
        withSequence(
          withTiming(1.036, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.000, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true
      );
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const handleFormationDone = useCallback(() => {
    logoOp.value = withSpring(1,   { damping: 24, stiffness: 58 });
    logoSc.value = withSpring(1.0, { damping: 20, stiffness: 52 });
    // If text was passed, auto-start after logo appears
    if (hasText) {
      setTimeout(() => startSpeaking(), 600);
    } else {
      textOp.value = withTiming(1, { duration: 500 });
    }
  }, [hasText]);

  // ── Phase-driven glow + waveform ───────────────────────────────────────────
  useEffect(() => {
    const on = phase === "playing";

    glowOp.value = withTiming(on ? 0.46 : 0.12, { duration: 700 });
    glowSc.value = withTiming(on ? 1.14 : 1.00, { duration: 700 });

    if (on) {
      // Animate waveform bars with staggered breathing
      const heights = [0.30, 0.75, 0.55, 0.95, 0.50, 0.80, 0.35];
      bars.forEach((b, i) => {
        b.value = withDelay(i * 60, withRepeat(
          withSequence(
            withTiming(heights[i]!, { duration: 380 + i * 30, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.12,         { duration: 380 + i * 30, easing: Easing.inOut(Easing.sin) }),
          ),
          -1, true
        ));
      });
    } else {
      // Calm bars back down
      bars.forEach((b) => {
        b.value = withTiming(0.15, { duration: 500, easing: Easing.out(Easing.ease) });
      });
    }
  }, [phase]);

  useEffect(() => {
    if (hasText || phase === "done") {
      textOp.value = withTiming(1, { duration: 500 });
    }
  }, [phase, hasText]);

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { Speech.stop(); } catch {}
      speakingRef.current = false;
    };
  }, []);

  // ── Speech ─────────────────────────────────────────────────────────────────
  const startSpeaking = async () => {
    if (!hasText || speakingRef.current) return;
    try {
      speakingRef.current = true;
      setPhase("playing");
      textOp.value = withTiming(1, { duration: 400 });

      Speech.speak(text, {
        language: "tr-TR",
        rate:     0.88,
        pitch:    1.0,
        onStart:  () => setPhase("playing"),
        onDone:   () => { speakingRef.current = false; setPhase("done"); },
        onStopped:() => { speakingRef.current = false; },
        onError:  () => { speakingRef.current = false; setPhase("idle"); },
      });
    } catch {
      speakingRef.current = false;
      setPhase("idle");
    }
  };

  const pauseSpeaking = async () => {
    try {
      const available = await Speech.isSpeakingAsync();
      if (available) {
        Speech.pause?.();
        speakingRef.current = false;
        setPhase("paused");
      }
    } catch {
      setPhase("idle");
    }
  };

  const resumeSpeaking = async () => {
    try {
      Speech.resume?.();
      speakingRef.current = true;
      setPhase("playing");
    } catch {
      // Fallback: restart from beginning
      speakingRef.current = false;
      startSpeaking();
    }
  };

  const handleBtn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnSc.value = withSequence(
      withSpring(0.86, { duration: 75 }),
      withSpring(1.00, { damping: 14, stiffness: 220 }),
    );

    if (phase === "playing") {
      await pauseSpeaking();
    } else if (phase === "paused") {
      await resumeSpeaking();
    } else if (phase === "done") {
      // Replay
      speakingRef.current = false;
      await startSpeaking();
    } else {
      // idle
      await startSpeaking();
    }
  };

  const handleBack = () => {
    try { Speech.stop(); } catch {}
    speakingRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // ── Animated styles ────────────────────────────────────────────────────────
  const logoContStyle = useAnimatedStyle(() => ({
    opacity:   logoOp.value,
    transform: [{ scale: logoSc.value * breathSc.value }],
  }));
  const glowStyle   = useAnimatedStyle(() => ({
    opacity:   glowOp.value,
    transform: [{ scale: glowSc.value }],
  }));
  const topStyle    = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const btnStyle    = useAnimatedStyle(() => ({ transform: [{ scale: btnSc.value }] }));
  const statusStyle = useAnimatedStyle(() => ({ opacity: statusOp.value }));
  const textStyle   = useAnimatedStyle(() => ({ opacity: textOp.value }));

  const b0s = useAnimatedStyle(() => ({ transform: [{ scaleY: b0.value }] }));
  const b1s = useAnimatedStyle(() => ({ transform: [{ scaleY: b1.value }] }));
  const b2s = useAnimatedStyle(() => ({ transform: [{ scaleY: b2.value }] }));
  const b3s = useAnimatedStyle(() => ({ transform: [{ scaleY: b3.value }] }));
  const b4s = useAnimatedStyle(() => ({ transform: [{ scaleY: b4.value }] }));
  const b5s = useAnimatedStyle(() => ({ transform: [{ scaleY: b5.value }] }));
  const b6s = useAnimatedStyle(() => ({ transform: [{ scaleY: b6.value }] }));
  const barStyles = [b0s, b1s, b2s, b3s, b4s, b5s, b6s];

  const canvasState = phase === "playing" ? "speaking" : "idle";
  const isPlaying   = phase === "playing";

  // Button appearance
  const btnBg = isPlaying
    ? "rgba(255,255,255,0.10)"
    : "rgba(255,255,255,0.065)";
  const btnIconColor = isPlaying
    ? "rgba(255,255,255,0.90)"
    : "rgba(255,255,255,0.55)";
  const btnIcon = isPlaying ? "pause" : phase === "done" ? "rotate-ccw" : "play";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* Particle canvas */}
      <VoiceCanvas voiceState={canvasState} onFormationDone={handleFormationDone} />

      {/* Top bar */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 14 }, topStyle]} pointerEvents="box-none">
        <TouchableOpacity style={ss.topBtn} onPress={handleBack} hitSlop={20} activeOpacity={0.6}>
          <Feather name="chevron-left" size={17} color="rgba(255,255,255,0.48)" />
        </TouchableOpacity>

        <View style={ss.topRight} pointerEvents="none">
          <Text style={ss.topLabel}>SES MODU</Text>
        </View>
      </Animated.View>

      {/* Logo + soft glow */}
      <View style={ss.logoArea} pointerEvents="none">
        <Animated.View style={[ss.glowHalo, glowStyle]} />
        <Animated.View style={logoContStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={ss.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* AI response text */}
      {hasText && (
        <Animated.View style={[ss.textArea, textStyle]} pointerEvents="none">
          <Text style={ss.responseText} numberOfLines={6}>{text}</Text>
        </Animated.View>
      )}

      {/* No-text fallback */}
      {!hasText && (
        <Animated.View style={[ss.textArea, textStyle]} pointerEvents="none">
          <Feather name="message-circle" size={18} color="rgba(255,255,255,0.20)" />
          <Text style={ss.emptyText}>Sohbetten bir yanıt seçin{"\n"}ve buradan dinleyin</Text>
        </Animated.View>
      )}

      {/* Bottom controls */}
      <View style={[ss.bottomArea, { paddingBottom: btmPad + 32 }]}>

        {/* Status */}
        <Animated.Text style={[ss.statusLabel, statusStyle]}>
          {STATUS[phase]}
        </Animated.Text>

        {/* Waveform + button row */}
        <View style={ss.controlRow}>

          {/* Waveform (left) */}
          <View style={ss.waveRow}>
            {barStyles.map((s, i) => (
              <Animated.View key={i} style={[ss.waveBar, s]} />
            ))}
          </View>

          {/* Play/Pause button */}
          <Animated.View style={btnStyle}>
            <TouchableOpacity
              style={[ss.playBtn, { backgroundColor: btnBg }]}
              onPress={handleBtn}
              disabled={!hasText}
              activeOpacity={0.80}
              hitSlop={10}
            >
              <Feather name={btnIcon} size={22} color={hasText ? btnIconColor : "rgba(255,255,255,0.18)"} />
            </TouchableOpacity>
          </Animated.View>

          {/* Mirror waveform (right) — mirrored for symmetry */}
          <View style={[ss.waveRow, ss.waveRowMirror]}>
            {[...barStyles].reverse().map((s, i) => (
              <Animated.View key={i} style={[ss.waveBar, s]} />
            ))}
          </View>

        </View>

        {/* Replay/skip hint */}
        {phase === "done" && (
          <Text style={ss.hint}>Tekrar dinlemek için dokunun</Text>
        )}
        {phase === "playing" && (
          <Text style={ss.hint}>Duraklatmak için dokunun</Text>
        )}

      </View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const LOGO_SIZE = Math.round(Math.min(W, H) * 0.34);
const GLOW_SIZE = LOGO_SIZE * 2.8;
const BTN_SIZE  = 68;
const BAR_H     = 42;
const BAR_W     = 3;

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#010108" },

  // ── Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 22,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  topRight: { flex: 1, alignItems: "center", paddingRight: 36 },
  topLabel: {
    fontFamily: "Inter_400Regular", fontSize: 10,
    color: "rgba(255,255,255,0.22)", letterSpacing: 2.6,
  },

  // ── Logo
  logoArea: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    paddingBottom: H * 0.30,
  },
  glowHalo: {
    position: "absolute",
    width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
    // Soft milky white — not neon
    backgroundColor: "rgba(220,228,242,0.028)",
    shadowColor: "#D0D8F0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: LOGO_SIZE * 0.72,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, tintColor: "#FFFFFF" },

  // ── Text overlay
  textArea: {
    position: "absolute",
    bottom: H * 0.32,
    left: 36, right: 36,
    alignItems: "center", gap: 10,
  },
  responseText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: "rgba(255,255,255,0.25)", textAlign: "center",
    lineHeight: 22, marginTop: 8,
  },

  // ── Bottom
  bottomArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", gap: 18,
  },
  statusLabel: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: 1.8, textTransform: "uppercase",
  },

  // ── Control row
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  // ── Waveform
  waveRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    height: BAR_H,
  },
  waveRowMirror: { transform: [{ scaleX: -1 }] },
  waveBar: {
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_W / 2,
    backgroundColor: "rgba(255,255,255,0.30)",
    // scaleY transform origin is centre
  },

  // ── Play button
  playBtn: {
    width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center", justifyContent: "center",
  },

  hint: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.20)", letterSpacing: 0.3,
  },
});
