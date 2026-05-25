/**
 * Voice Mode — cinematic always-dark experience.
 * Recording: expo-av Audio.Recording (Expo Go compatible).
 * TTS: expo-speech (no native modules required).
 * Always dark #010108 — never adapts to global theme.
 */
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
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

type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const STATUS_LABELS: Record<VoicePhase, string> = {
  idle:      "Konuşmak için dokunun",
  listening: "Dinliyorum...",
  thinking:  "Düşünüyorum...",
  speaking:  "Cevap veriyorum...",
};

const canvasState = (p: VoicePhase): "idle" | "listening" | "speaking" =>
  p === "listening" ? "listening" : p === "speaking" ? "speaking" : "idle";

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const [phase, setPhase]                 = useState<VoicePhase>("idle");
  const [userText, setUserText]           = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [convId, setConvId]               = useState<number | null>(null);
  // null = not checked, false = unavailable, true = ready
  const [available, setAvailable]         = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const abortRef     = useRef<AbortController | null>(null);

  // ── Animation values ───────────────────────────────────────────────────────
  const topOpacity        = useSharedValue(0);
  const logoOpacity       = useSharedValue(0);
  const logoScale         = useSharedValue(0.82);
  const breathScale       = useSharedValue(1);
  const glowOpacity       = useSharedValue(0.14);
  const glowScale         = useSharedValue(1);
  const micScale          = useSharedValue(1);
  const micRingScale      = useSharedValue(1);
  const micRingOpacity    = useSharedValue(0);
  const statusOpacity     = useSharedValue(0);
  const transcriptOpacity = useSharedValue(0);

  // ── Entrance ────────────────────────────────────────────────────────────────
  useEffect(() => {
    topOpacity.value    = withDelay(300, withTiming(1, { duration: 700 }));
    statusOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
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

  const handleFormationDone = useCallback(() => {
    logoOpacity.value = withSpring(1,   { damping: 22, stiffness: 60 });
    logoScale.value   = withSpring(1.0, { damping: 18, stiffness: 55 });
  }, []);

  // ── Phase-driven animation effects ────────────────────────────────────────
  useEffect(() => {
    const active = phase === "listening" || phase === "speaking";
    glowOpacity.value = withTiming(active ? 0.60 : 0.14, { duration: 650 });
    glowScale.value   = withTiming(active ? 1.18 : 1.06, { duration: 650 });

    if (phase === "listening") {
      micRingOpacity.value = withTiming(0.55, { duration: 400 });
      micRingScale.value = withRepeat(
        withSequence(
          withTiming(1.60, { duration: 900, easing: Easing.out(Easing.ease) }),
          withTiming(1.00, { duration: 100 }),
        ),
        -1, false
      );
    } else {
      micRingOpacity.value = withTiming(0,   { duration: 300 });
      micRingScale.value   = withTiming(1.0, { duration: 300 });
    }
  }, [phase]);

  useEffect(() => {
    const has = !!userText || !!assistantText;
    transcriptOpacity.value = withTiming(has ? 1 : 0, { duration: 400 });
  }, [userText, assistantText]);

  // ── Mount: check availability ──────────────────────────────────────────────
  useEffect(() => {
    initVoice();
    return () => {
      abortRef.current?.abort();
      cleanupRecording();
      Speech.stop();
    };
  }, []);

  const initVoice = async () => {
    // Web: voice mode not supported in browser
    if (Platform.OS === "web") {
      setAvailable(false);
      return;
    }

    try {
      // Request microphone permission
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setAvailable(false);
        Alert.alert(
          "Mikrofon İzni",
          "Sesli mod için mikrofon izni gereklidir. Lütfen ayarlardan izin verin.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Configure audio session for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setAvailable(true);
      createConversation();
    } catch (err) {
      console.warn("Voice init error:", err);
      setAvailable(false);
    }
  };

  const cleanupRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    try {
      const status = await rec.getStatusAsync();
      if (status.isRecording) await rec.stopAndUnloadAsync();
      else await rec.stopAndUnloadAsync();
    } catch {}
  };

  const createConversation = async () => {
    try {
      const res = await fetch(`${API_BASE}/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sesli Sohbet" }),
      });
      if (res.ok) {
        const data = await res.json() as { id: number };
        setConvId(data.id);
      }
    } catch (err) {
      console.warn("createConversation error:", err);
    }
  };

  // ── Mic tap ────────────────────────────────────────────────────────────────
  const handleMicPress = async () => {
    if (available === false) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micScale.value = withSequence(
      withSpring(0.88, { duration: 80 }),
      withSpring(1.00, { damping: 14, stiffness: 220 }),
    );

    if (phase === "listening") {
      await stopAndProcess();
      return;
    }

    if (phase === "thinking" || phase === "speaking") {
      abortRef.current?.abort();
      Speech.stop();
      await cleanupRecording();
      setPhase("idle");
      setUserText("");
      setAssistantText("");
      return;
    }

    // idle → start
    await startRecording();
  };

  const startRecording = async () => {
    try {
      setUserText("");
      setAssistantText("");

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        100
      );
      recordingRef.current = recording;
      setPhase("listening");
    } catch (err) {
      console.warn("startRecording error:", err);
      Alert.alert("Kayıt Hatası", "Mikrofon başlatılamadı. Lütfen tekrar deneyin.");
      setPhase("idle");
    }
  };

  const stopAndProcess = async () => {
    setPhase("thinking");
    const rec = recordingRef.current;
    recordingRef.current = null;

    if (!rec) {
      setPhase("idle");
      return;
    }

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) {
        setPhase("idle");
        return;
      }

      // Reset audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Read file as base64 using fetch (works in Expo Go)
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      await sendToServer(base64);
    } catch (err) {
      console.warn("stopAndProcess error:", err);
      setPhase("idle");
    }
  };

  const sendToServer = async (audioBase64: string) => {
    const abort = new AbortController();
    abortRef.current = abort;
    const id = convId ?? 0;

    try {
      const res = await fetch(
        `${API_BASE}/openai/conversations/${id}/voice-messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({ audio: audioBase64 }),
        }
      );

      if (!res.ok) {
        setPhase("idle");
        return;
      }

      const data = await res.json() as { userText?: string; assistantText?: string; error?: string };

      if (data.error || !data.assistantText) {
        setPhase("idle");
        return;
      }

      setUserText(data.userText ?? "");
      setAssistantText(data.assistantText ?? "");
      setPhase("speaking");

      // Speak the reply using expo-speech (Expo Go compatible)
      Speech.speak(data.assistantText, {
        language: "tr-TR",
        rate: 0.92,
        onDone: () => setPhase("idle"),
        onError: () => setPhase("idle"),
        onStopped: () => setPhase("idle"),
      });
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.warn("sendToServer error:", err);
        setPhase("idle");
      }
    }
  };

  // ── Animated styles ────────────────────────────────────────────────────────
  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value * breathScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity:   glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const topStyle        = useAnimatedStyle(() => ({ opacity: topOpacity.value }));
  const micStyle        = useAnimatedStyle(() => ({ transform: [{ scale: micScale.value }] }));
  const micRingStyle    = useAnimatedStyle(() => ({
    opacity:   micRingOpacity.value,
    transform: [{ scale: micRingScale.value }],
  }));
  const statusStyle     = useAnimatedStyle(() => ({ opacity: statusOpacity.value }));
  const transcriptStyle = useAnimatedStyle(() => ({ opacity: transcriptOpacity.value }));

  const isActive   = phase !== "idle";
  const micBg      = phase === "listening"
    ? "rgba(255,255,255,0.16)"
    : "rgba(255,255,255,0.07)";
  const micIconClr = phase === "listening"
    ? "rgba(255,255,255,0.95)"
    : "rgba(255,255,255,0.52)";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* Particle canvas */}
      <VoiceCanvas voiceState={canvasState(phase)} onFormationDone={handleFormationDone} />

      {/* Top bar */}
      <Animated.View
        style={[ss.topBar, { paddingTop: topPad + 14 }, topStyle]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={ss.topBtn}
          onPress={() => {
            abortRef.current?.abort();
            Speech.stop();
            cleanupRecording();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={20}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={17} color="rgba(255,255,255,0.48)" />
        </TouchableOpacity>
      </Animated.View>

      {/* Logo + glow */}
      <View style={ss.logoArea} pointerEvents="none">
        <Animated.View style={[ss.glowHalo, glowStyle]} />
        <Animated.View style={logoContainerStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={ss.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Unavailable fallback */}
      {available === false && (
        <View style={ss.fallbackBox} pointerEvents="none">
          <Feather name="mic-off" size={22} color="rgba(255,255,255,0.30)" />
          <Text style={ss.fallbackTitle}>Sesli Mod Kullanılamıyor</Text>
          <Text style={ss.fallbackBody}>
            {Platform.OS === "web"
              ? "Sesli mod yalnızca mobil cihazlarda çalışır."
              : "Mikrofon erişimi sağlanamadı. Lütfen ayarlardan izin verin."}
          </Text>
        </View>
      )}

      {/* Transcript */}
      {available !== false && (
        <Animated.View style={[ss.transcriptArea, transcriptStyle]} pointerEvents="none">
          {!!userText && (
            <Text style={ss.userText} numberOfLines={2}>{userText}</Text>
          )}
          {!!assistantText && (
            <Text style={ss.assistantText} numberOfLines={5}>{assistantText}</Text>
          )}
        </Animated.View>
      )}

      {/* Bottom controls */}
      <View style={[ss.bottomArea, { paddingBottom: btmPad + 28 }]}>
        <Animated.Text style={[ss.statusLabel, statusStyle]}>
          {available === false
            ? "Sesli mod kullanılamıyor"
            : available === null
            ? "Hazırlanıyor..."
            : STATUS_LABELS[phase]}
        </Animated.Text>

        <View style={ss.micWrap}>
          <Animated.View style={[ss.micRing, micRingStyle]} />
          <Animated.View style={micStyle}>
            <TouchableOpacity
              style={[
                ss.micBtn,
                { backgroundColor: micBg },
                available === false && ss.micDisabled,
              ]}
              onPress={handleMicPress}
              disabled={available !== true}
              activeOpacity={0.80}
              hitSlop={12}
            >
              {available === false ? (
                <Feather name="mic-off" size={24} color="rgba(255,255,255,0.25)" />
              ) : phase === "thinking" ? (
                <ThinkingDots />
              ) : phase === "speaking" ? (
                <Feather name="volume-2" size={24} color="rgba(255,255,255,0.82)" />
              ) : (
                <Feather name="mic" size={24} color={micIconClr} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {isActive && available === true && (
          <Text style={ss.cancelHint}>
            {phase === "listening" ? "Durdurmak için dokunun" : "İptal etmek için dokunun"}
          </Text>
        )}
      </View>

    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:audio/m4a;base64,")
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Thinking dots ──────────────────────────────────────────────────────────────
function ThinkingDots() {
  const d0 = useSharedValue(0.3);
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);

  useEffect(() => {
    const loop = (sv: typeof d0, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(1,   { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 350, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false
      ));
    };
    loop(d0, 0);
    loop(d1, 200);
    loop(d2, 400);
  }, []);

  const s0 = useAnimatedStyle(() => ({ opacity: d0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));

  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
      <Animated.View style={[ss.dot, s0]} />
      <Animated.View style={[ss.dot, s1]} />
      <Animated.View style={[ss.dot, s2]} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const LOGO_SIZE = Math.round(Math.min(W, H) * 0.36);
const GLOW_SIZE = LOGO_SIZE * 2.6;
const MIC_SIZE  = 72;
const RING_SIZE = MIC_SIZE * 2.2;

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#010108" },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
    flexDirection: "row", paddingHorizontal: 24,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },

  logoArea: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    paddingBottom: H * 0.26,
  },
  glowHalo: {
    position: "absolute",
    width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
    backgroundColor: "rgba(180,210,255,0.035)",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: LOGO_SIZE * 0.6,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, tintColor: "#FFFFFF" },

  fallbackBox: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: H * 0.28,
    alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40,
  },
  fallbackTitle: {
    fontFamily: "Inter_500Medium", fontSize: 16,
    color: "rgba(255,255,255,0.50)", textAlign: "center",
  },
  fallbackBody: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.28)", textAlign: "center", lineHeight: 20,
  },

  transcriptArea: {
    position: "absolute", bottom: H * 0.30, left: 32, right: 32,
    alignItems: "center", gap: 10,
  },
  userText: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: "rgba(255,255,255,0.38)", textAlign: "center", letterSpacing: -0.2,
  },
  assistantText: {
    fontFamily: "Inter_400Regular", fontSize: 17,
    color: "rgba(255,255,255,0.82)", textAlign: "center",
    lineHeight: 26, letterSpacing: -0.3,
  },

  bottomArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", gap: 20,
  },
  statusLabel: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.30)", letterSpacing: 0.4, textTransform: "uppercase",
  },

  micWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: "center", justifyContent: "center",
  },
  micRing: {
    position: "absolute",
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  micBtn: {
    width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  micDisabled: { opacity: 0.4 },

  cancelHint: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.22)", letterSpacing: 0.2,
  },

  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.80)",
  },
});
