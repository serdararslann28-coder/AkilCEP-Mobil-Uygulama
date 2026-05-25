/**
 * Voice Mode — premium cinematic experience.
 * Flow: record → POST base64 to /api/openai/conversations/:id/voice-messages
 *       SSE events: user_transcript, transcript, audio (base64 mp3), done
 * UI: particle canvas + breathing logo, tap mic button, transcript overlay.
 * Always dark #010108 — never adapts to global theme.
 */
import { Feather } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
  const [audioUri, setAudioUri]           = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // expo-audio hooks
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player   = useAudioPlayer(audioUri ?? undefined);

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

  // ── Phase-driven effects ───────────────────────────────────────────────────
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

  // ── Mount: permissions + conversation ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert(
            "Mikrofon İzni",
            "Sesli mod için mikrofon erişimi gereklidir.",
            [{ text: "Tamam", onPress: () => router.back() }]
          );
          return;
        }
      }
      createConversation();
    })();

    return () => {
      abortRef.current?.abort();
      try { recorder.stop(); } catch {}
    };
  }, []);

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
    } catch {}
  };

  // ── Mic tap ────────────────────────────────────────────────────────────────
  const handleMicPress = async () => {
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
      try { recorder.stop(); } catch {}
      setAudioUri(null);
      setPhase("idle");
      setUserText("");
      setAssistantText("");
      return;
    }
    // idle → start recording
    await startRecording();
  };

  const startRecording = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Sesli Mod", "Sesli mod Android/iOS cihazlarda çalışır.");
      return;
    }
    try {
      setUserText("");
      setAssistantText("");
      setAudioUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("listening");
    } catch {
      Alert.alert("Kayıt Hatası", "Mikrofon başlatılamadı. Lütfen tekrar deneyin.");
    }
  };

  const stopAndProcess = async () => {
    setPhase("thinking");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setPhase("idle"); return; }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await sendVoiceMessage(base64);
    } catch {
      setPhase("idle");
    }
  };

  const sendVoiceMessage = async (audioBase64: string) => {
    const abort = new AbortController();
    abortRef.current = abort;
    const id = convId ?? 0;

    try {
      const res = await fetch(`${API_BASE}/openai/conversations/${id}/voice-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({ audio: audioBase64 }),
      });

      if (!res.ok || !res.body) { setPhase("idle"); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type?: string; data?: string; done?: boolean; error?: string;
            };

            if (evt.type === "user_transcript" && evt.data) {
              setUserText(evt.data);
            } else if (evt.type === "transcript" && evt.data) {
              setAssistantText(evt.data);
              setPhase("speaking");
            } else if (evt.type === "audio" && evt.data) {
              await playBase64Audio(evt.data, abort);
            } else if (evt.done || evt.error) {
              setPhase("idle");
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") setPhase("idle");
    }
  };

  const playBase64Audio = async (b64: string, abort: AbortController) => {
    if (abort.signal.aborted) return;
    try {
      const tmpUri = `${FileSystem.Paths.cache.uri}akılcep_voice.mp3`;
      await FileSystem.writeAsStringAsync(tmpUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Setting the uri triggers expo-audio to load + play via the player hook
      setAudioUri(tmpUri);
    } catch {}
  };

  // Watch player for completion
  useEffect(() => {
    if (!player || phase !== "speaking") return;
    const status = player.currentStatus;
    if (status && "didJustFinish" in status && status.didJustFinish) {
      setPhase("idle");
    }
  }, [player?.currentStatus]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value * breathScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity:   glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const topStyle       = useAnimatedStyle(() => ({ opacity: topOpacity.value }));
  const micStyle       = useAnimatedStyle(() => ({ transform: [{ scale: micScale.value }] }));
  const micRingStyle   = useAnimatedStyle(() => ({
    opacity:   micRingOpacity.value,
    transform: [{ scale: micRingScale.value }],
  }));
  const statusStyle    = useAnimatedStyle(() => ({ opacity: statusOpacity.value }));
  const transcriptStyle = useAnimatedStyle(() => ({ opacity: transcriptOpacity.value }));

  const isActive    = phase !== "idle";
  const micBg       = phase === "listening" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)";
  const micIconClr  = phase === "listening" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.52)";

  return (
    <View style={ss.root}>

      {/* Particle canvas */}
      <VoiceCanvas voiceState={canvasState(phase)} onFormationDone={handleFormationDone} />

      {/* Top bar */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 14 }, topStyle]} pointerEvents="box-none">
        <TouchableOpacity
          style={ss.topBtn}
          onPress={() => {
            abortRef.current?.abort();
            try { recorder.stop(); } catch {}
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

      {/* Transcript */}
      <Animated.View style={[ss.transcriptArea, transcriptStyle]} pointerEvents="none">
        {!!userText && (
          <Text style={ss.userText} numberOfLines={2}>{userText}</Text>
        )}
        {!!assistantText && (
          <Text style={ss.assistantText} numberOfLines={5}>{assistantText}</Text>
        )}
      </Animated.View>

      {/* Bottom controls */}
      <View style={[ss.bottomArea, { paddingBottom: btmPad + 28 }]}>
        <Animated.Text style={[ss.statusLabel, statusStyle]}>
          {STATUS_LABELS[phase]}
        </Animated.Text>

        <View style={ss.micWrap}>
          <Animated.View style={[ss.micRing, micRingStyle]} />
          <Animated.View style={micStyle}>
            <TouchableOpacity
              style={[ss.micBtn, { backgroundColor: micBg }]}
              onPress={handleMicPress}
              activeOpacity={0.80}
              hitSlop={12}
            >
              {phase === "thinking" ? (
                <ThinkingDots />
              ) : phase === "speaking" ? (
                <Feather name="volume-2" size={24} color="rgba(255,255,255,0.82)" />
              ) : (
                <Feather name="mic" size={24} color={micIconClr} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {isActive && (
          <Text style={ss.cancelHint}>
            {phase === "listening" ? "Durdurmak için dokunun" : "İptal etmek için dokunun"}
          </Text>
        )}
      </View>

    </View>
  );
}

// ─── Thinking dots ─────────────────────────────────────────────────────────────
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

// ─── Styles ───────────────────────────────────────────────────────────────────
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

  cancelHint: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.22)", letterSpacing: 0.2,
  },

  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.80)",
  },
});
