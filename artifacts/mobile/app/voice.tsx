/**
 * Voice Mode — Conversational AI presence.
 *
 * Flow:  idle → [tap] → listening (expo-audio record)
 *        → [tap / auto-stop] → thinking (Whisper + GPT via backend)
 *        → speaking (expo-speech TTS)
 *        → idle
 *
 * Stack: expo-audio (recording) · expo-file-system (base64) · expo-speech (TTS)
 * No native SpeechRecognizer. No WebSockets. Fully Expo Go compatible.
 * Always dark #010108 — never adapts to global theme.
 */
import { Feather } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
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

import VoiceCanvas   from "@/components/VoiceCanvas";
import { useChat }    from "@/context/ChatContext";
import { useLanguage } from "@/context/LanguageContext";

const { width: W, height: H } = Dimensions.get("window");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Phase machine ──────────────────────────────────────────────────────────────
type Phase = "init" | "idle" | "listening" | "thinking" | "speaking" | "unavailable";


const canvasState = (p: Phase): "idle" | "listening" | "speaking" =>
  p === "listening" ? "listening" : p === "speaking" ? "speaking" : "idle";

// ── Component ──────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 20 : insets.bottom;

  const { t } = useLanguage();
  const STATUS: Record<Phase, string> = {
    init:        t("voice.status.init"),
    idle:        t("voice.status.idle"),
    listening:   t("voice.status.listening"),
    thinking:    t("voice.status.thinking"),
    speaking:    t("voice.status.speaking"),
    unavailable: t("voice.status.unavailable"),
  };

  const { injectMessages, startNewConversation } = useChat();

  const [phase, setPhase]           = useState<Phase>("init");
  const [userText, setUserText]     = useState("");
  const [aiText, setAiText]         = useState("");
  const [convId, setConvId]         = useState<number>(0);

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recordingRef = useRef<AudioRecorder | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const phaseRef     = useRef<Phase>("init");

  // Keep phaseRef in sync so callbacks don't close over stale phase
  const applyPhase = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // ── Shared animation values ────────────────────────────────────────────────
  const topOp    = useSharedValue(0);
  const logoOp   = useSharedValue(0);
  const logoSc   = useSharedValue(0.84);
  const breathSc = useSharedValue(1);
  const glowOp   = useSharedValue(0.10);
  const glowSc   = useSharedValue(1.0);
  const btnSc    = useSharedValue(1);
  const statusOp = useSharedValue(0);
  const transOp  = useSharedValue(0);

  // 7 waveform bars
  const bars = [
    useSharedValue(0.12), useSharedValue(0.12), useSharedValue(0.12),
    useSharedValue(0.12), useSharedValue(0.12), useSharedValue(0.12),
    useSharedValue(0.12),
  ] as const;

  // Thinking dots
  const d0 = useSharedValue(0.25);
  const d1 = useSharedValue(0.25);
  const d2 = useSharedValue(0.25);

  // ── Entrance ───────────────────────────────────────────────────────────────
  useEffect(() => {
    topOp.value    = withDelay(200, withTiming(1, { duration: 700 }));
    statusOp.value = withDelay(900, withTiming(1, { duration: 600 }));
    breathSc.value = withRepeat(
      withSequence(
        withTiming(1.036, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.000, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true
    );
  }, []);

  const handleFormationDone = useCallback(() => {
    logoOp.value = withSpring(1,   { damping: 24, stiffness: 58 });
    logoSc.value = withSpring(1.0, { damping: 20, stiffness: 52 });
  }, []);

  // ── Phase-driven animations ────────────────────────────────────────────────
  useEffect(() => {
    const isActive = phase === "listening" || phase === "speaking";
    glowOp.value   = withTiming(isActive ? 0.52 : 0.10, { duration: 700 });
    glowSc.value   = withTiming(isActive ? 1.18 : 1.00, { duration: 700 });

    // Waveform
    if (phase === "listening" || phase === "speaking") {
      const peaks = phase === "listening"
        ? [0.45, 0.80, 0.60, 1.00, 0.55, 0.85, 0.40]
        : [0.30, 0.70, 0.50, 0.90, 0.45, 0.75, 0.35];
      bars.forEach((b, i) => {
        b.value = withDelay(i * 55, withRepeat(
          withSequence(
            withTiming(peaks[i]!, { duration: 360 + i * 28, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.10,       { duration: 360 + i * 28, easing: Easing.inOut(Easing.sin) }),
          ),
          -1, true
        ));
      });
    } else {
      bars.forEach((b) => {
        b.value = withTiming(0.12, { duration: 600, easing: Easing.out(Easing.ease) });
      });
    }

    // Thinking dots
    if (phase === "thinking") {
      [[d0, 0], [d1, 200], [d2, 400]].forEach(([sv, delay]) => {
        (sv as typeof d0).value = withDelay(delay as number, withRepeat(
          withSequence(
            withTiming(1,    { duration: 380, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.20, { duration: 380, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, false
        ));
      });
    } else {
      d0.value = withTiming(0.25, { duration: 300 });
      d1.value = withTiming(0.25, { duration: 300 });
      d2.value = withTiming(0.25, { duration: 300 });
    }

    // Transcript fade
    const hasText = !!userText || !!aiText;
    transOp.value = withTiming(hasText && phase !== "init" ? 1 : 0, { duration: 400 });
  }, [phase]);

  useEffect(() => {
    const hasText = !!userText || !!aiText;
    transOp.value = withTiming(hasText ? 1 : 0, { duration: 400 });
  }, [userText, aiText]);

  // ── Mount: permissions + conversation ─────────────────────────────────────
  useEffect(() => {
    initVoice();
    return () => {
      abortRef.current?.abort();
      safeStopRecording();
      try { Speech.stop(); } catch {}
    };
  }, []);

  const initVoice = async () => {
    if (Platform.OS === "web") {
      applyPhase("unavailable");
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        applyPhase("unavailable");
        return;
      }
      await setAudioModeAsync({
        allowsRecording:   true,
        playsInSilentMode: true,
      });
      // Create or reuse a conversation
      const id = await createConversation();
      setConvId(id);
      applyPhase("idle");
    } catch (err) {
      console.warn("[voice] init error:", err);
      applyPhase("unavailable");
    }
  };

  const createConversation = async (): Promise<number> => {
    try {
      const res = await fetch(`${API_BASE}/openai/conversations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: "Sesli Sohbet" }),
      });
      if (res.ok) {
        const data = await res.json() as { id: number };
        return data.id;
      }
    } catch (err) {
      console.warn("[voice] createConversation:", err);
    }
    return 0;
  };

  // ── Safe recording cleanup ─────────────────────────────────────────────────
  const safeStopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try { await rec.stop(); } catch {}
  };

  // ── Button handler ─────────────────────────────────────────────────────────
  const handleBtn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnSc.value = withSequence(
      withSpring(0.86, { duration: 75 }),
      withSpring(1.00, { damping: 14, stiffness: 220 }),
    );

    const p = phaseRef.current;

    if (p === "idle") {
      await startListening();
    } else if (p === "listening") {
      await stopAndProcess();
    } else if (p === "thinking" || p === "speaking") {
      // Cancel current turn
      abortRef.current?.abort();
      try { Speech.stop(); } catch {}
      await safeStopRecording();
      setUserText("");
      setAiText("");
      applyPhase("idle");
    }
  };

  // ── Start recording ────────────────────────────────────────────────────────
  const startListening = async () => {
    try {
      setUserText("");
      setAiText("");

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordingRef.current = audioRecorder;
      applyPhase("listening");
    } catch (err) {
      console.warn("[voice] startListening:", err);
      Alert.alert(
        t("voice.alert.recFail"),
        t("voice.alert.recFailMsg"),
        [{ text: t("common.ok") }]
      );
      applyPhase("idle");
    }
  };

  // ── Stop recording → send to backend ──────────────────────────────────────
  const stopAndProcess = async () => {
    applyPhase("thinking");

    const rec = recordingRef.current;
    recordingRef.current = null;

    if (!rec) { applyPhase("idle"); return; }

    try {
      await rec.stop();

      // Restore audio mode for playback
      await setAudioModeAsync({
        allowsRecording:   false,
        playsInSilentMode: true,
      });

      const uri = rec.uri;
      if (!uri) { applyPhase("idle"); return; }

      // Read as base64 — most reliable on Expo Go native
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch {
        // Fallback: fetch blob → FileReader
        const resp = await fetch(uri);
        const blob = await resp.blob();
        base64 = await blobToBase64(blob);
      }

      await sendToBackend(base64);
    } catch (err) {
      console.warn("[voice] stopAndProcess:", err);
      applyPhase("idle");
    }
  };

  // ── Send to backend (Whisper + GPT) ───────────────────────────────────────
  const sendToBackend = async (audioBase64: string) => {
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(
        `${API_BASE}/openai/conversations/${convId}/voice-messages`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          signal:  abort.signal,
          body:    JSON.stringify({ audio: audioBase64 }),
        }
      );

      if (abort.signal.aborted) return;

      if (!res.ok) {
        showErrorAlert(t("voice.alert.serverError"));
        applyPhase("idle");
        return;
      }

      const data = await res.json() as {
        userText?: string;
        assistantText?: string;
        error?: string;
      };

      if (abort.signal.aborted) return;

      if (data.error || !data.assistantText) {
        // Empty transcription → silently go back to idle
        applyPhase("idle");
        return;
      }

      setUserText(data.userText ?? "");
      setAiText(data.assistantText ?? "");
      await speakReply(data.userText ?? "", data.assistantText, abort);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") return;
      console.warn("[voice] sendToBackend:", err);
      applyPhase("idle");
    }
  };

  // ── Speak the AI reply, then inject into chat and navigate ────────────────
  const speakReply = async (userMsg: string, text: string, abort: AbortController) => {
    if (abort.signal.aborted) return;

    applyPhase("speaking");

    const restoreRecordingMode = async () => {
      try {
        await setAudioModeAsync({
          allowsRecording:   true,
          playsInSilentMode: true,
        });
      } catch {}
    };

    // Inject conversation into chat context and navigate after speaking
    const finishAndNavigate = () => {
      if (abort.signal.aborted) return;
      startNewConversation();
      injectMessages(userMsg, text);
      router.replace("/chat");
    };

    try {
      Speech.speak(text, {
        language:  "tr-TR",
        rate:      0.88,
        pitch:     1.0,
        onDone:    () => {
          void restoreRecordingMode().then(finishAndNavigate);
        },
        onStopped: () => {
          void restoreRecordingMode();
        },
        onError:   () => {
          void restoreRecordingMode().then(() => {
            if (!abort.signal.aborted) applyPhase("idle");
          });
        },
      });
    } catch (err) {
      console.warn("[voice] speakReply:", err);
      await restoreRecordingMode();
      applyPhase("idle");
    }
  };

  const showErrorAlert = (msg: string) => {
    Alert.alert(t("voice.alertTitle"), msg, [{ text: t("common.ok") }]);
  };

  // ── Animated styles ────────────────────────────────────────────────────────
  const topStyle  = useAnimatedStyle(() => ({ opacity: topOp.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity:   logoOp.value,
    transform: [{ scale: logoSc.value * breathSc.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity:   glowOp.value,
    transform: [{ scale: glowSc.value }],
  }));
  const btnAnim   = useAnimatedStyle(() => ({ transform: [{ scale: btnSc.value }] }));
  const stOp      = useAnimatedStyle(() => ({ opacity: statusOp.value }));
  const trOp      = useAnimatedStyle(() => ({ opacity: transOp.value }));

  const barStyles = bars.map((b) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({ transform: [{ scaleY: b.value }] }))
  );
  const dot0 = useAnimatedStyle(() => ({ opacity: d0.value }));
  const dot1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const dot2 = useAnimatedStyle(() => ({ opacity: d2.value }));

  // Button appearance per phase
  const btnIcon: string =
    phase === "listening" ? "square"    :
    phase === "thinking"  ? "more-horizontal" :
    phase === "speaking"  ? "volume-2"  : "mic";

  const btnBg =
    phase === "listening" ? "rgba(255,255,255,0.13)" :
    phase === "speaking"  ? "rgba(255,255,255,0.10)" :
    "rgba(255,255,255,0.065)";

  const btnColor =
    phase === "listening" ? "rgba(255,255,255,0.95)" :
    phase === "speaking"  ? "rgba(255,255,255,0.90)" :
    phase === "unavailable" ? "rgba(255,255,255,0.20)" :
    "rgba(255,255,255,0.60)";

  const isInteractive = phase !== "init" && phase !== "unavailable";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>

      {/* Particle canvas */}
      <VoiceCanvas voiceState={canvasState(phase)} onFormationDone={handleFormationDone} />

      {/* Top bar */}
      <Animated.View style={[ss.topBar, { paddingTop: topPad + 14 }, topStyle]} pointerEvents="box-none">
        <TouchableOpacity
          style={ss.backBtn}
          onPress={() => {
            abortRef.current?.abort();
            try { Speech.stop(); } catch {}
            safeStopRecording();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={20}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={17} color="rgba(255,255,255,0.48)" />
        </TouchableOpacity>

        <View style={ss.topCenter} pointerEvents="none">
          <Text style={ss.topLabel}>SES MODU</Text>
        </View>
      </Animated.View>

      {/* Logo + glow */}
      <View style={ss.logoArea} pointerEvents="none">
        <Animated.View style={[ss.glow, glowStyle]} />
        <Animated.View style={logoStyle}>
          <Image
            source={require("@/assets/images/leaf-only-transparent.png")}
            style={ss.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Transcript */}
      <Animated.View style={[ss.transcript, trOp]} pointerEvents="none">
        {!!userText && (
          <Text style={ss.userLine} numberOfLines={2}>{userText}</Text>
        )}
        {!!aiText && (
          <Text style={ss.aiLine} numberOfLines={5}>{aiText}</Text>
        )}
      </Animated.View>

      {/* Unavailable message */}
      {phase === "unavailable" && (
        <View style={ss.unavailBox} pointerEvents="none">
          <Feather name="mic-off" size={20} color="rgba(255,255,255,0.22)" />
          <Text style={ss.unavailTitle}>Mikrofon Kullanılamıyor</Text>
          <Text style={ss.unavailBody}>
            {Platform.OS === "web"
              ? "Ses modu yalnızca mobil cihazlarda çalışır."
              : "Mikrofon izni verilmedi. Lütfen ayarlardan izin verin."}
          </Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[ss.bottom, { paddingBottom: btmPad + 30 }]}>

        {/* Status label */}
        <Animated.Text style={[ss.status, stOp]}>
          {STATUS[phase]}
        </Animated.Text>

        {/* Waveform + button row */}
        <View style={ss.controlRow}>

          {/* Left waveform */}
          <View style={ss.wave}>
            {barStyles.map((anim, i) => (
              <Animated.View key={i} style={[ss.bar, anim]} />
            ))}
          </View>

          {/* Central button */}
          <Animated.View style={btnAnim}>
            <TouchableOpacity
              style={[ss.btn, { backgroundColor: btnBg }]}
              onPress={handleBtn}
              disabled={!isInteractive}
              activeOpacity={0.80}
              hitSlop={12}
            >
              {phase === "thinking" ? (
                <View style={ss.dotsRow}>
                  <Animated.View style={[ss.dot, dot0]} />
                  <Animated.View style={[ss.dot, dot1]} />
                  <Animated.View style={[ss.dot, dot2]} />
                </View>
              ) : (
                <Feather name={btnIcon as any} size={22} color={btnColor} />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Right waveform (mirrored) */}
          <View style={[ss.wave, ss.waveMirror]}>
            {barStyles.map((anim, i) => (
              <Animated.View key={i} style={[ss.bar, anim]} />
            ))}
          </View>

        </View>

        {/* Hint */}
        {(phase === "listening" || phase === "thinking" || phase === "speaking") && (
          <Text style={ss.hint}>
            {phase === "listening"
              ? "Durdurmak için dokunun"
              : "İptal etmek için dokunun"}
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
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const LOGO  = Math.round(Math.min(W, H) * 0.34);
const GLOW  = LOGO * 2.9;
const BTN   = 70;
const BAR_H = 44;
const BAR_W = 3;

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#010108" },

  // Top
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 22,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  topCenter: { flex: 1, alignItems: "center", paddingRight: 36 },
  topLabel:  {
    fontFamily: "Inter_400Regular", fontSize: 10,
    color: "rgba(255,255,255,0.22)", letterSpacing: 2.8,
  },

  // Logo
  logoArea: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    paddingBottom: H * 0.28,
  },
  glow: {
    position: "absolute",
    width: GLOW, height: GLOW, borderRadius: GLOW / 2,
    backgroundColor: "rgba(210,222,245,0.022)",
    shadowColor: "#C8D4EE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: LOGO * 0.75,
  },
  logo: { width: LOGO, height: LOGO, tintColor: "#FFFFFF" },

  // Transcript
  transcript: {
    position: "absolute", bottom: H * 0.31, left: 34, right: 34,
    alignItems: "center", gap: 8,
  },
  userLine: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.34)", textAlign: "center",
    letterSpacing: -0.1,
  },
  aiLine: {
    fontFamily: "Inter_400Regular", fontSize: 16,
    color: "rgba(255,255,255,0.78)", textAlign: "center",
    lineHeight: 25, letterSpacing: -0.25,
  },

  // Unavailable
  unavailBox: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: H * 0.30,
    alignItems: "center", justifyContent: "center",
    gap: 10, paddingHorizontal: 44,
  },
  unavailTitle: {
    fontFamily: "Inter_500Medium", fontSize: 15,
    color: "rgba(255,255,255,0.40)", textAlign: "center",
  },
  unavailBody: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.22)", textAlign: "center", lineHeight: 20,
  },

  // Bottom
  bottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", gap: 16,
  },
  status: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: "rgba(255,255,255,0.28)", letterSpacing: 1.8, textTransform: "uppercase",
  },

  // Controls
  controlRow: { flexDirection: "row", alignItems: "center", gap: 18 },

  // Waveform
  wave: {
    flexDirection: "row", alignItems: "center", gap: 4, height: BAR_H,
  },
  waveMirror: { transform: [{ scaleX: -1 }] },
  bar: {
    width: BAR_W, height: BAR_H, borderRadius: BAR_W / 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  // Button
  btn: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center", justifyContent: "center",
  },

  // Thinking dots
  dotsRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.82)",
  },

  hint: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.20)", letterSpacing: 0.2,
  },
});
