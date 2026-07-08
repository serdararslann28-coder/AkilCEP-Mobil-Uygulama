/**
 * ChatScreen — AkılCEP premium AI chat with inline Voice Mode.
 *
 * Voice flow (expo-av → Whisper → GPT → expo-speech):
 *   idle → [mic tap] → listening → [tap / silence] → thinking
 *   → injectMessages() → speaking → idle
 *
 * No separate voice screen. Voice lives entirely inside the chat.
 */
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
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
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SideMenu         from "@/components/SideMenu";
import MultimodalPanel  from "@/components/MultimodalPanel";
import MessageBubble    from "@/components/MessageBubble";
import ImageGenCard     from "@/components/ImageGenCard";
import ThinkingCard     from "@/components/ThinkingCard";
import VoiceOrbPanel    from "@/components/VoiceOrbPanel";
import { AkilMic }      from "@/components/AkilMic";
import { useChat }      from "@/context/ChatContext";
import { useTheme }     from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Voice phase ────────────────────────────────────────────────────────────────
type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const MIN_INPUT_H = 62;   // large floating pill
const MAX_INPUT_H = 140;  // ~4 lines before scroll kicks in

// ── Waveform bars — animated 4-bar equaliser inside the AI button ─────────────
// Runs entirely on UI thread via Reanimated — zero JS-thread involvement at 60 FPS.
function WaveformBars({ active }: { active: boolean }) {
  const h1 = useSharedValue(0.35);
  const h2 = useSharedValue(0.65);
  const h3 = useSharedValue(0.45);
  const h4 = useSharedValue(0.55);

  useEffect(() => {
    const cfg = (ms: number) => ({ duration: ms, easing: Easing.inOut(Easing.ease) });
    if (active) {
      // Active: each bar has a distinct period — no two bars feel in sync
      h1.value = withRepeat(withSequence(withTiming(1.00, cfg(260)), withTiming(0.20, cfg(260))), -1, false);
      h2.value = withRepeat(withSequence(withTiming(0.25, cfg(200)), withTiming(0.92, cfg(200))), -1, false);
      h3.value = withRepeat(withSequence(withTiming(0.88, cfg(320)), withTiming(0.18, cfg(320))), -1, false);
      h4.value = withRepeat(withSequence(withTiming(0.40, cfg(240)), withTiming(0.95, cfg(240))), -1, false);
    } else {
      // Idle: very slow, almost imperceptible breathing — calm, not dead
      h1.value = withRepeat(withSequence(withTiming(0.45, cfg(1700)), withTiming(0.25, cfg(1700))), -1, false);
      h2.value = withRepeat(withSequence(withTiming(0.82, cfg(2100)), withTiming(0.52, cfg(2100))), -1, false);
      h3.value = withRepeat(withSequence(withTiming(0.52, cfg(1900)), withTiming(0.30, cfg(1900))), -1, false);
      h4.value = withRepeat(withSequence(withTiming(0.68, cfg(1500)), withTiming(0.42, cfg(1500))), -1, false);
    }
  }, [active]);

  const s1 = useAnimatedStyle(() => ({ height: 4 + h1.value * 14 }));
  const s2 = useAnimatedStyle(() => ({ height: 4 + h2.value * 14 }));
  const s3 = useAnimatedStyle(() => ({ height: 4 + h3.value * 14 }));
  const s4 = useAnimatedStyle(() => ({ height: 4 + h4.value * 14 }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5 }}>
      {([s1, s2, s3, s4] as const).map((s, i) => (
        <Animated.View key={i} style={[{ width: 2.5, borderRadius: 2, backgroundColor: "#FFFFFF" }, s]} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { theme: T }   = useTheme();
  const insets          = useSafeAreaInsets();
  const {
    currentMessages,
    currentConversation,
    isTyping,
    visionPending,
    imagePending,
    imagePendingLabel,
    editImage,
    sendMessage,
    injectMessages,
    startNewConversation,
    startSecretConversation,
  } = useChat();

  const [inputText,    setInputText]    = useState("");
  const [menuVisible,      setMenuVisible]  = useState(false);
  const [secretModal,      setSecretModal]  = useState(false);
  const [exitSecretModal,  setExitModal]    = useState(false);
  const [expandedOpen,     setExpandedOpen] = useState(false);
  const [voicePhase,       setVoicePhase]   = useState<VoicePhase>("idle");

  const isSecretChat = !!currentConversation?.isPrivate;

  const flatListRef     = useRef<FlatList>(null);
  const voicePhaseRef   = useRef<VoicePhase>("idle");
  const recordingRef    = useRef<Audio.Recording | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const voiceConvIdRef  = useRef<number>(0);
  const permGrantedRef  = useRef<boolean | null>(null); // null = unchecked

  // ── STT — lightweight speech-to-text that fills the input field ─────────────
  const [sttListening,  setSttListening]  = useState(false);
  const sttRecordingRef = useRef<Audio.Recording | null>(null);
  const sttAbortRef     = useRef<AbortController | null>(null);

  const applyVoice = (p: VoicePhase) => {
    voicePhaseRef.current = p;
    setVoicePhase(p);
  };

  const hasText     = inputText.trim().length > 0;
  const hasMessages = currentMessages.length > 0;
  const topPad      = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad   = Platform.OS === "web" ? 34 : insets.bottom;
  const isSpeaking  = voicePhase === "speaking";

  // ── Right icon crossfade: 0 = Secret Chat (lock), 1 = New Chat (edit-3) ─────
  const rightIconAnim = useSharedValue(hasMessages ? 1 : 0);
  useEffect(() => {
    // Show edit-3 only when messages exist AND not in secret mode
    rightIconAnim.value = withTiming((hasMessages && !isSecretChat) ? 1 : 0, { duration: 200 });
  }, [hasMessages, isSecretChat]);
  const lockStyle = useAnimatedStyle(() => ({ opacity: 1 - rightIconAnim.value, position: "absolute" }));
  const editStyle = useAnimatedStyle(() => ({ opacity: rightIconAnim.value,     position: "absolute" }));

  // ── Secret active badge: fades in when isSecretChat = true ──────────────────
  const badgeAnim = useSharedValue(0);
  useEffect(() => {
    badgeAnim.value = withTiming(isSecretChat ? 1 : 0, { duration: 280 });
  }, [isSecretChat]);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity:   badgeAnim.value,
    transform: [{ scale: 0.82 + badgeAnim.value * 0.18 }],
  }));

  const isListening= voicePhase === "listening";

  // ── Send button spring ─────────────────────────────────────────────────────
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const handleSend = () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.80, { duration: 70 }, () => {
      sendScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    sendMessage(inputText.trim());
    setInputText("");
    inputHeightSV.value = withSpring(MIN_INPUT_H, { damping: 20, stiffness: 180, mass: 0.8 });
    setScrollEnabled(false);
  };

  // ── Watermark logo — breathing + speaking boost ────────────────────────────
  const loScale = useSharedValue(1);
  const loOp    = useSharedValue(T.isDark ? 0.05 : 0.07);

  useEffect(() => {
    // Base breathing loop
    loScale.value = withRepeat(
      withSequence(
        withTiming(1.055, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    loOp.value = withRepeat(
      withSequence(
        withTiming(T.isDark ? 0.075 : 0.10, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
        withTiming(T.isDark ? 0.045 : 0.065,{ duration: 4600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, [T.isDark]);

  // Boost watermark opacity when AI is speaking — feels alive
  useEffect(() => {
    if (isSpeaking) {
      loOp.value = withTiming(T.isDark ? 0.18 : 0.22, { duration: 600 });
    } else {
      loOp.value = withTiming(T.isDark ? 0.05 : 0.07, { duration: 800 });
    }
  }, [isSpeaking, T.isDark]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loScale.value }],
    opacity:   loOp.value,
  }));

  // ── Panel — multimodal AI toolbox ──────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);

  // + button rotation: 0° at rest → 45° (becomes ✕) when panel open
  const plusRotSV = useSharedValue(0);
  useEffect(() => {
    plusRotSV.value = withSpring(panelOpen ? 1 : 0, { damping: 18, stiffness: 280, mass: 0.8 });
  }, [panelOpen]);
  const plusRotAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(plusRotSV.value, [0, 1], [0, 45])}deg` }],
  }));

  // ── Shared values — smart arrow button (send ↔ dark voice orb) ─────────────
  const voiceModeSV    = useSharedValue(0);  // 0 = send, 1 = voice-orb
  const arrowGlowPulse = useSharedValue(0);  // ambient pulse 0→1 in voice mode
  const sttPulse       = useSharedValue(0);  // 0→1 during STT listening
  const inputHeightSV  = useSharedValue(MIN_INPUT_H);  // animated input height
  const inputFocused   = useSharedValue(0);             // 0 = rest, 1 = focused

  // Soft white glow on focus — luxurious, no bounce
  const FOCUS_DUR = { duration: 250, easing: Easing.out(Easing.ease) } as const;
  // Pill shadow — 20% reduced from previous; gentle focus glow
  const inputGlowStyle = useAnimatedStyle(() => ({
    shadowColor:   T.isDark ? "#FFFFFF" : "#000000",
    shadowOpacity: interpolate(inputFocused.value, [0, 1],
      T.isDark ? [0.06, 0.14] : [0.04, 0.08]),
    shadowRadius:  interpolate(inputFocused.value, [0, 1],
      T.isDark ? [11,   21]   : [8,    14]),
    shadowOffset:  { width: 0, height: T.isDark ? 0 : 2 },
    elevation:     5,
  }));
  // Glass overlay darkens pill surface; brightens subtly on focus
  const inputOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(inputFocused.value, [0, 1],
      T.isDark ? [0.56, 0.64] : [0.62, 0.76]),
  }));

  // Flowing knowledge shimmer — thin light beam sweeps left→right while typing.
  // Almost invisible by design: 8% peak opacity, 2.4s per pass, linear.
  const BEAM_W    = 88;   // beam width in px
  const SCREEN_W  = Dimensions.get("window").width;
  const shimmerX  = useSharedValue(-BEAM_W);
  const shimmerOp = useSharedValue(0);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
    opacity:   shimmerOp.value,
  }));
  useEffect(() => {
    if (hasText) {
      // Fade beam in, then loop sweep continuously
      shimmerOp.value = withTiming(1, { duration: 600 });
      shimmerX.value  = -BEAM_W;
      shimmerX.value  = withRepeat(
        withTiming(SCREEN_W + BEAM_W, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      // Stop sweep, fade out
      shimmerOp.value = withTiming(0, { duration: 500 });
      cancelAnimation(shimmerX);
    }
  }, [hasText]);

  // Adaptive multiline: scrolls once past MAX_INPUT_H
  const [scrollEnabled, setScrollEnabled] = useState(false);

  // Mic button glow pulse during listening
  const micGlow = useSharedValue(0);
  const micGlowStyle = useAnimatedStyle(() => ({
    opacity:   micGlow.value,
    transform: [{ scale: 1 + micGlow.value * 0.35 }],
  }));

  // Arrow animated styles
  // Gentle scale pulse — only active in voice mode, no rings
  const voicePulseAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + voiceModeSV.value * arrowGlowPulse.value * 0.038 }],
  }));
  const arrowVoiceBgAnim = useAnimatedStyle(() => ({
    opacity: voiceModeSV.value,
  }));
  const arrowSendBgAnim = useAnimatedStyle(() => ({
    opacity: interpolate(voiceModeSV.value, [0, 1], [1, 0]),
  }));
  const arrowSendIconAnim = useAnimatedStyle(() => ({
    opacity: interpolate(voiceModeSV.value, [0, 1], [1, 0]),
  }));
  const arrowVoiceIconAnim = useAnimatedStyle(() => ({
    opacity: interpolate(voiceModeSV.value, [0, 1], [0, 1]),
  }));

  // STT mic — soft radial pulse ring while recording
  const sttPulseStyle = useAnimatedStyle(() => ({
    opacity:   sttPulse.value * 0.42,
    transform: [{ scale: 1 + sttPulse.value * 0.55 }],
  }));

  // Monochrome press glow — scale-down + inner highlight bloom (works inside overflow:hidden)
  const sendPressGlow = useSharedValue(0);
  const micPressGlow  = useSharedValue(0);
  const PRESS_IN  = { duration: 80 } as const;
  const PRESS_OUT = { duration: 220, easing: Easing.out(Easing.ease) } as const;
  const sendBtnScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(sendPressGlow.value, [0, 1], [1.0, 0.91]) }],
  }));
  const sendPressHighlightStyle = useAnimatedStyle(() => ({
    opacity: sendPressGlow.value,
  }));
  const micPressHighlightStyle = useAnimatedStyle(() => ({
    opacity: micPressGlow.value,
  }));

  // + button press — scale 1.0 → 0.97
  const plusScaleSV = useSharedValue(0);
  const plusCircleScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(plusScaleSV.value, [0, 1], [1.0, 0.97]) }],
  }));

  // AI button idle breath — very subtle ±1.8 %, 4.8 s cycle, always on
  const aiBreathe = useSharedValue(0);
  useEffect(() => {
    aiBreathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  // AI button — idle breath × voice pulse × send spring × press scale, one transform
  const aiCombinedStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: (1 + aiBreathe.value * 0.018)
             * (1 + voiceModeSV.value * arrowGlowPulse.value * 0.015)
             * sendScale.value
             * interpolate(sendPressGlow.value, [0, 1], [1.0, 0.93]),
    }],
  }));

  // Adaptive input wrapper — springs up/down as content grows
  const inputFieldAnim = useAnimatedStyle(() => ({
    height: inputHeightSV.value,
  }));

  useEffect(() => {
    if (isListening) {
      micGlow.value = withRepeat(
        withSequence(
          withTiming(0.60, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.20, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true
      );
    } else {
      micGlow.value = withTiming(0, { duration: 350 });
    }
  }, [isListening]);

  // ── Arrow morphs: text present → send / empty → dark voice orb ─────────────
  useEffect(() => {
    voiceModeSV.value = withTiming(hasText ? 0 : 1, {
      duration: 340,
      easing:   Easing.out(Easing.ease),
    });
    if (!hasText) {
      arrowGlowPulse.value = withDelay(
        180,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, false
        )
      );
    } else {
      arrowGlowPulse.value = withTiming(0, { duration: 200 });
    }
  }, [hasText]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      sttAbortRef.current?.abort();
      safeStopRecording();
      try { Speech.stop(); } catch {}
    };
  }, []);

  // ── Permission helper ──────────────────────────────────────────────────────
  const ensurePermission = async (): Promise<boolean> => {
    if (permGrantedRef.current === true) return true;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      permGrantedRef.current = granted;
      if (!granted) {
        Alert.alert(
          "Mikrofon İzni",
          "Sesli mod için mikrofon izni gereklidir.",
          [{ text: "Tamam" }]
        );
      }
      return granted;
    } catch {
      return false;
    }
  };

  // ── Lazy-create voice conversation on backend ──────────────────────────────
  const ensureVoiceConv = async (): Promise<number> => {
    if (voiceConvIdRef.current > 0) return voiceConvIdRef.current;
    try {
      const res = await fetch(`${API_BASE}/openai/conversations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: "Sesli Sohbet" }),
      });
      if (res.ok) {
        const data = await res.json() as { id: number };
        voiceConvIdRef.current = data.id;
        return data.id;
      }
    } catch {}
    return 0;
  };

  // ── Recording helpers ──────────────────────────────────────────────────────
  const safeStopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try { await rec.stopAndUnloadAsync(); } catch {}
  };

  // ── Mic button handler ─────────────────────────────────────────────────────
  const handleMicPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const p = voicePhaseRef.current;

    if (Platform.OS === "web") {
      Alert.alert("Sesli Mod", "Sesli mod mobil cihazlarda çalışır.");
      return;
    }

    if (p === "idle") {
      const ok = await ensurePermission();
      if (!ok) return;
      await startListening();

    } else if (p === "listening") {
      await stopAndProcess();

    } else {
      // thinking or speaking — cancel
      abortRef.current?.abort();
      try { Speech.stop(); } catch {}
      await safeStopRecording();
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS:   true,
          playsInSilentModeIOS: true,
        });
      } catch {}
      applyVoice("idle");
    }
  };

  // ── Adaptive height ──────────────────────────────────────────────────────────
  const onContentSizeChange = (e: { nativeEvent: { contentSize: { height: number } } }) => {
    const h = e.nativeEvent.contentSize.height;
    const clamped = Math.min(Math.max(h, MIN_INPUT_H), MAX_INPUT_H);
    inputHeightSV.value = withSpring(clamped, { damping: 20, stiffness: 180, mass: 0.8 });
    setScrollEnabled(h > MAX_INPUT_H);
  };

  // ── STT helpers — mic icon fills input field (no navigation) ────────────────
  const handleSttPress = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Ses Girişi", "Sesli giriş yalnızca mobil cihazlarda çalışır.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sttListening) { await stopStt(); } else { await startStt(); }
  };

  const startStt = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      sttRecordingRef.current = recording;
      setSttListening(true);
      sttPulse.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 650, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.28, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      );
    } catch {
      Alert.alert("Ses Girişi", "Mikrofon başlatılamadı.");
    }
  };

  const stopStt = async () => {
    const rec = sttRecordingRef.current;
    sttRecordingRef.current = null;
    setSttListening(false);
    sttPulse.value = withTiming(0, { duration: 280 });
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = rec.getURI();
      if (!uri) return;
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      } catch {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        base64 = await blobToBase64(blob);
      }
      const abort = new AbortController();
      sttAbortRef.current = abort;
      const res = await fetch(`${API_BASE}/openai/transcribe`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abort.signal,
        body:    JSON.stringify({ audio: base64 }),
      });
      if (abort.signal.aborted || !res.ok) return;
      const data = await res.json() as { text?: string };
      const t = data.text?.trim() ?? "";
      if (t) setInputText((prev) => (prev ? `${prev} ${t}` : t));
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") return;
    }
  };

  // ── Start recording ────────────────────────────────────────────────────────
  const startListening = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        100,
      );
      recordingRef.current = recording;
      applyVoice("listening");
    } catch (err) {
      console.warn("[voice] startListening:", err);
      Alert.alert("Kayıt Hatası", "Mikrofon başlatılamadı. Tekrar deneyin.");
    }
  };

  // ── Stop → encode → send ───────────────────────────────────────────────────
  const stopAndProcess = async () => {
    applyVoice("thinking");
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) { applyVoice("idle"); return; }

    try {
      await rec.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: true,
      });

      const uri = rec.getURI();
      if (!uri) { applyVoice("idle"); return; }

      // Read as base64 — reliable on Expo Go native
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        // Fallback blob path
        const resp = await fetch(uri);
        const blob = await resp.blob();
        base64 = await blobToBase64(blob);
      }

      const convId = await ensureVoiceConv();
      await sendToBackend(base64, convId);
    } catch (err) {
      console.warn("[voice] stopAndProcess:", err);
      applyVoice("idle");
    }
  };

  // ── Backend: Whisper STT + GPT reply ──────────────────────────────────────
  const sendToBackend = async (audioBase64: string, convId: number) => {
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
        Alert.alert("Ses Modu", "Sunucu yanıt vermedi. Tekrar deneyin.");
        applyVoice("idle");
        return;
      }

      const data = await res.json() as {
        userText?:      string;
        assistantText?: string;
        error?:         string;
      };

      if (abort.signal.aborted) return;

      const userText = data.userText?.trim()      ?? "";
      const aiText   = data.assistantText?.trim() ?? "";

      if (!aiText) {
        // Nothing transcribed or empty reply — silent reset
        applyVoice("idle");
        return;
      }

      // Add both messages to chat
      injectMessages(userText, aiText);

      // Speak the reply
      await speakReply(aiText, abort);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") return;
      console.warn("[voice] sendToBackend:", err);
      applyVoice("idle");
    }
  };

  // ── expo-speech TTS ────────────────────────────────────────────────────────
  const restoreRecordingMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   true,
        playsInSilentModeIOS: true,
      });
    } catch {}
  };

  const speakReply = async (text: string, abort: AbortController) => {
    if (abort.signal.aborted) return;
    applyVoice("speaking");

    try {
      Speech.speak(text, {
        language: "tr-TR",
        rate:     0.88,
        pitch:    1.0,
        onDone: () => {
          void restoreRecordingMode().then(() => {
            if (!abort.signal.aborted) applyVoice("idle");
          });
        },
        onStopped: () => { void restoreRecordingMode(); },
        onError:   () => {
          void restoreRecordingMode().then(() => {
            if (!abort.signal.aborted) applyVoice("idle");
          });
        },
      });
    } catch (err) {
      console.warn("[voice] speakReply:", err);
      await restoreRecordingMode();
      applyVoice("idle");
    }
  };

  // ── Colour tokens ──────────────────────────────────────────────────────────

  const inputBg      = T.isDark ? "rgba(255,255,255,0.055)" : "#F1F1EE";
  const sendBtnBg    = T.isDark ? "rgba(255,255,255,0.12)"  : "#E5E5E1";
  const inputTextClr = T.isDark ? T.fg                      : "#5C5C5C";
  const inputPlhClr  = T.isDark ? T.muted                   : "#9A9A9A";
  const attachClr    = T.isDark ? "rgba(255,255,255,0.55)"  : "#222222";
  const logoTint     = T.isDark ? "#888888"                 : "#5A5A5A";

  // Mic button colors per phase
  const micBg = useCallback((): string => {
    if (voicePhase === "listening") return T.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
    if (voicePhase === "speaking")  return T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
    return "transparent";
  }, [voicePhase, T.isDark]);

  const micIconColor = (): string => {
    if (voicePhase === "listening") return T.isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.70)";
    if (voicePhase === "speaking")  return T.isDark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.50)";
    if (voicePhase === "thinking")  return T.isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.35)";
    return attachClr;
  };

  const micIconName = (): React.ComponentProps<typeof Feather>["name"] => {
    if (voicePhase === "listening") return "square";
    if (voicePhase === "speaking")  return "volume-2";
    return "mic";
  };

  const voiceActive = voicePhase !== "idle";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>
      <MultimodalPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        bottomOffset={bottomPad + 80}
      />
      <SideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      {/* ════ WATERMARK LOGO ════ */}
      <View style={ss.logoFrame} pointerEvents="none">
        <Animated.Image
          source={leafOnly}
          style={[ss.logoImg, { tintColor: logoTint }, logoStyle]}
          resizeMode="contain"
        />
      </View>

      {/* ════ FLOATING ICONS — sit directly on the screen surface ════ */}

      {/* Left: Menu */}
      <TouchableOpacity
        style={[ss.floatBtn, { top: topPad + 10, left: 18 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenuVisible(true); }}
        hitSlop={14} activeOpacity={0.55}
      >
        <Feather name="menu" size={18} color={T.fgSoft} />
      </TouchableOpacity>

      {/* Center: leaf logo + secret active badge — non-interactive */}
      <View style={[ss.floatCenter, { top: topPad + 6 }]} pointerEvents="none">
        <Image
          source={leafOnly}
          style={[ss.floatLogo, { tintColor: T.isDark ? "#FFFFFF" : "#111111" }]}
          resizeMode="contain"
        />
        {/* "Gizli" badge — slides in below logo when secret mode is active */}
        <Animated.View style={[ss.secretBadge, { backgroundColor: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.055)", borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)" }, badgeStyle]}>
          <Feather name="lock" size={7} color={T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"} />
          <Text style={[ss.secretBadgeText, { color: T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }]}>Gizli</Text>
        </Animated.View>
      </View>

      {/* Right: message-circle (secret/empty) ↔ edit-3 (new chat) */}
      <TouchableOpacity
        style={[ss.floatBtn, { top: topPad + 10, right: 18 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (isSecretChat)              { setExitModal(true); }
          else if (!hasMessages)         { setSecretModal(true); }
          else                           { startNewConversation(); }
        }}
        hitSlop={14} activeOpacity={0.55}
      >
        <Animated.View style={lockStyle}>
          <Feather
            name="message-circle"
            size={18}
            color={isSecretChat
              ? (T.isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.66)")
              : T.fgSoft}
          />
        </Animated.View>
        <Animated.View style={editStyle}>
          <Feather name="edit-3" size={18} color={T.fgSoft} />
        </Animated.View>
      </TouchableOpacity>

      {/* ════ MESSAGES ════ */}
      <KeyboardAvoidingView style={ss.flex} behavior="padding">
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isLatest={index === 0 && item.role === "assistant"}
              onEditImage={(imageData, instruction) => editImage(imageData, instruction)}
            />
          )}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ss.msgList}
          ListHeaderComponent={isTyping ? (
            imagePending ? (
              <ImageGenCard />
            ) : (
              <ThinkingCard label={
                visionPending ? "Fotoğraf analiz ediliyor…" : undefined
              } />
            )
          ) : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: topPad + 46 }} />}
        />

        {/* ════ VOICE ORB PANEL — slides in above input ════ */}
        <VoiceOrbPanel phase={voicePhase} isDark={T.isDark} />

        {/* ════ INPUT AREA ════ */}
        <View style={[ss.inputOuter, { paddingBottom: bottomPad + 10 }]}>

          {/* Quick actions — visible only on empty (new) chat */}
          {!hasMessages && (
            <Animated.View
              entering={FadeIn.duration(320)}
              exiting={FadeOut.duration(180)}
              style={ss.quickActions}
            >
              {[
                { emoji: "🖼️", label: "Görüntü Oluştur", onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setInputText("Bir görsel oluştur: ");
                }},
                { emoji: "✏️", label: "Yaz veya Düzenle", onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedOpen(true);
                }},
                { emoji: "🌐", label: "Web Ara", onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setInputText("Web'de ara: ");
                }},
              ].map(({ emoji, label, onPress }) => (
                <TouchableOpacity
                  key={label}
                  onPress={onPress}
                  activeOpacity={0.55}
                  hitSlop={8}
                  style={ss.quickActionItem}
                >
                  <Text style={ss.quickActionEmoji}>{emoji}</Text>
                  <Text style={[ss.quickActionLabel, { color: T.muted }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* ── Input dock — white + button left, pill right ── */}
          <View style={ss.inputDock}>

            {/* Standalone + button — white circle, black icon, soft drop shadow */}
            <Animated.View style={[ss.plusCircleWrap, plusCircleScaleStyle]}>
              <Pressable
                style={ss.plusCircleInner}
                onPressIn={() => {
                  plusScaleSV.value = withTiming(1, PRESS_IN);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                onPressOut={() => { plusScaleSV.value = withTiming(0, PRESS_OUT); }}
                onPress={() => { setPanelOpen(p => !p); }}
                hitSlop={4}
              >
                <Animated.View style={plusRotAnim}>
                  <Feather name="plus" size={18} color="#000000" />
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Input pill — text + mic only; AI button is a dock sibling */}
            <Animated.View style={[ss.inputRowShadow, inputGlowStyle]}>
              {/* Inner — clips content to pill radius */}
              <View style={[ss.inputRowGlass, {
                backgroundColor: T.isDark ? "#1C1C1E" : "#FFFFFF",
                borderColor:     T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
              }]}>

                {/* Shimmer beam — sweeps while typing */}
                <Animated.View style={[ss.shimmerBeam, shimmerStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={["transparent", T.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.025)", "transparent"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                {/* Text field — flex:1 fills remaining pill width; height:58 + textAlignVertical centers text */}
                <TextInput
                  style={[
                    ss.textInput,
                    { color: T.isDark ? "rgba(255,255,255,0.92)" : "#1A1A1A", opacity: voiceActive ? 0.45 : 1 },
                  ]}
                  placeholder={voiceActive ? "" : "AkılCEP'e bir şey sor..."}
                  placeholderTextColor={T.isDark ? "rgba(255,255,255,0.48)" : "#9A9A9A"}
                  value={inputText}
                  onChangeText={setInputText}
                  maxLength={2000}
                  returnKeyType="send"
                  onSubmitEditing={() => { if (hasText) handleSend(); }}
                  editable={!voiceActive}
                  onFocus={() => { inputFocused.value = withTiming(1, FOCUS_DUR); }}
                  onBlur={() => {  inputFocused.value = withTiming(0, FOCUS_DUR); }}
                />

                {/* Mic — sits at right edge of pill; paddingRight + dock gap = 16px to AI */}
                <View style={ss.micArea}>
                  <Animated.View
                    style={[StyleSheet.absoluteFill, { borderRadius: 18, backgroundColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)" }, micPressHighlightStyle]}
                    pointerEvents="none"
                  />
                  <AkilMic
                    listening={sttListening}
                    size={24}
                    color={sttListening
                      ? (T.isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.80)")
                      : (T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.60)")}
                    onPressIn={() => {
                      micPressGlow.value = withTiming(1, PRESS_IN);
                      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onPressOut={() => { micPressGlow.value = withTiming(0, PRESS_OUT); }}
                    onPress={handleSttPress}
                    hitSlop={8}
                  />
                </View>

              </View>{/* inputRowGlass */}
            </Animated.View>{/* inputRowShadow */}

            {/* AI voice button — standalone dock sibling; dock gap:8 separates it from pill */}
            <Animated.View style={[ss.aiCircleWrap, aiCombinedStyle]}>
              <Pressable
                style={ss.aiCirclePressable}
                onPressIn={() => {
                  sendPressGlow.value = withTiming(1, PRESS_IN);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                onPressOut={() => { sendPressGlow.value = withTiming(0, PRESS_OUT); }}
                onPress={hasText ? handleSend : () => {
                  if (Platform.OS === "web") {
                    Alert.alert("Sesli Mod", "Sesli mod yalnızca mobil cihazlarda çalışır.");
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/voice");
                }}
                hitSlop={4}
              >
                <Animated.View
                  style={[StyleSheet.absoluteFill, { borderRadius: 25, backgroundColor: "rgba(255,255,255,0.14)" }, sendPressHighlightStyle]}
                  pointerEvents="none"
                />
                <Animated.View style={[ss.iconCenter, arrowSendIconAnim]}>
                  <Feather name="arrow-up" size={18} color="#FFFFFF" />
                </Animated.View>
                <Animated.View style={[ss.iconCenter, arrowVoiceIconAnim]}>
                  <WaveformBars active={voiceActive || sttListening} />
                </Animated.View>
              </Pressable>
            </Animated.View>

          </View>{/* inputDock */}
        </View>
      </KeyboardAvoidingView>

      {/* ════ SECRET CHAT — START MODAL ════ */}
      <Modal visible={secretModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSecretModal(false)}>
        <View style={ss.modalOverlay}>
          <View style={[ss.modalCard, { backgroundColor: T.isDark ? "#111111" : "#F7F7F5", borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)" }]}>
            <View style={[ss.modalIconCircle, { backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
              <Feather name="lock" size={20} color={T.isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.50)"} />
            </View>
            <Text style={[ss.modalTitle, { color: T.fg }]}>Gizli Sohbet</Text>
            <Text style={[ss.modalDesc,  { color: T.fgSoft }]}>Bu sohbet geçmişe kaydedilmez.</Text>
            <TouchableOpacity
              style={[ss.modalBtn, { backgroundColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)" }]}
              activeOpacity={0.70}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSecretModal(false);
                startSecretConversation();
              }}
            >
              <Feather name="lock" size={13} color={T.isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)"} />
              <Text style={[ss.modalBtnText, { color: T.isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)" }]}>Gizli Sohbet Başlat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.modalBtnGhost} activeOpacity={0.55} onPress={() => setSecretModal(false)}>
              <Text style={[ss.modalBtnGhostText, { color: T.muted }]}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════ SECRET CHAT — EXIT MODAL ════ */}
      {/* ════ EXPANDED WRITING MODE ════ */}
      <Modal
        visible={expandedOpen}
        transparent={false}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setExpandedOpen(false)}
      >
        <View style={[ss.expandModal, { backgroundColor: T.bg }]}>
          {/* Header */}
          <View style={[ss.expandHeader, { borderBottomColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }]}>
            <TouchableOpacity
              style={ss.expandClose}
              onPress={() => setExpandedOpen(false)}
              hitSlop={12}
              activeOpacity={0.60}
            >
              <Feather name="x" size={20} color={T.fg} />
            </TouchableOpacity>
            <Text style={[ss.expandTitle, { color: T.fgSoft }]}>Uzun Mesaj</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Large text area */}
          <TextInput
            style={[ss.expandInput, { color: T.fg }]}
            placeholder="AkılCEP'e yaz…"
            placeholderTextColor={T.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            autoFocus
            maxLength={4000}
            textAlignVertical="top"
          />

          {/* Bottom action bar */}
          <View style={[ss.expandFooter, { borderTopColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", paddingBottom: bottomPad + 10 }]}>
            <Text style={[ss.expandCounter, { color: T.muted }]}>
              {inputText.length} / 4000
            </Text>
            <TouchableOpacity
              style={[ss.expandSendBtn, { backgroundColor: T.primary, opacity: hasText ? 1 : 0.38 }]}
              disabled={!hasText}
              activeOpacity={0.75}
              onPress={() => {
                setExpandedOpen(false);
                setTimeout(() => handleSend(), 80);
              }}
            >
              <Feather name="arrow-up" size={16} color={T.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={exitSecretModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExitModal(false)}>
        <View style={ss.modalOverlay}>
          <View style={[ss.modalCard, { backgroundColor: T.isDark ? "#111111" : "#F7F7F5", borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)" }]}>
            <View style={[ss.modalIconCircle, { backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
              <Feather name="shield-off" size={20} color={T.isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.50)"} />
            </View>
            <Text style={[ss.modalTitle, { color: T.fg }]}>Gizli sohbet sonlandırılsın mı?</Text>
            <Text style={[ss.modalDesc,  { color: T.fgSoft }]}>Tüm mesajlar silinecek ve sohbet geçmişe kaydedilmeyecek.</Text>
            <TouchableOpacity
              style={[ss.modalBtn, { backgroundColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)" }]}
              activeOpacity={0.70}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setExitModal(false);
                startNewConversation();
              }}
            >
              <Text style={[ss.modalBtnText, { color: T.isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)" }]}>Sonlandır</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.modalBtnGhost} activeOpacity={0.55} onPress={() => setExitModal(false)}>
              <Text style={[ss.modalBtnGhostText, { color: T.muted }]}>Devam Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ── Thinking dots (inline) ─────────────────────────────────────────────────────
function ThinkingDots({ color, size = 4 }: { color: string; size?: number }) {
  const d0 = useSharedValue(0.25);
  const d1 = useSharedValue(0.25);
  const d2 = useSharedValue(0.25);

  useEffect(() => {
    const loop = (sv: typeof d0, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 340 }),
          withTiming(0.20, { duration: 340 }),
        ),
        -1, false
      );
      // Start with delay offset
      sv.value = delay === 0
        ? sv.value
        : withTiming(0.25, { duration: delay });

      setTimeout(() => {
        sv.value = withRepeat(
          withSequence(
            withTiming(1,    { duration: 340, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.20, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, false
        );
      }, delay);
    };
    loop(d0, 0);
    loop(d1, 220);
    loop(d2, 440);
  }, []);

  const s0 = useAnimatedStyle(() => ({ opacity: d0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const dotStyle = {
    width: size, height: size, borderRadius: size / 2, backgroundColor: color,
  };

  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      <Animated.View style={[dotStyle, s0]} />
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
    </View>
  );
}

// ── Blob → base64 fallback ─────────────────────────────────────────────────────
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result as string;
      resolve(r.split(",")[1] ?? r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root:  { flex: 1 },
  flex:  { flex: 1 },

  // Watermark
  logoFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    pointerEvents:  "none",
  },
  logoImg: { width: 300, height: 300 },

  // Floating icon buttons — absolutely placed on the screen surface
  floatBtn: {
    position:       "absolute",
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         10,
  },
  // Center leaf logo — horizontally centered, non-interactive
  floatCenter: {
    position:       "absolute",
    left:           0,
    right:          0,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         9,
  },
  floatLogo: {
    width:  20,
    height: 20,
  },
  // Secret active badge — shown below center logo
  secretBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    marginTop:         4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      99,
    borderWidth:       1,
  },
  secretBadgeText: {
    fontSize:      9,
    fontFamily:    "Inter_500Medium",
    letterSpacing: 0.3,
  },

  // Modals
  modalOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width:         "100%",
    borderRadius:  22,
    borderWidth:   1,
    padding:       28,
    alignItems:    "center",
    gap:           10,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 20 },
    shadowOpacity: 0.28,
    shadowRadius:  40,
    elevation:     24,
  },
  modalIconCircle: {
    width:          52,
    height:         52,
    borderRadius:   26,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   2,
  },
  modalTitle: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
    textAlign:     "center",
  },
  modalDesc: {
    fontSize:    13,
    fontFamily:  "Inter_400Regular",
    lineHeight:  19,
    textAlign:   "center",
    marginBottom: 4,
  },
  modalBtn: {
    width:          "100%",
    height:         48,
    borderRadius:   14,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            7,
  },
  modalBtnText: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  modalBtnGhost: {
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBtnGhostText: {
    fontSize:   13.5,
    fontFamily: "Inter_400Regular",
  },

  // Messages
  msgList: { paddingTop: 20, paddingBottom: 8 },

  // Input area
  inputOuter: {
    paddingHorizontal: 0,
    paddingTop:        4,
    alignItems:        "center",
  },

  // Quick action row — above input, new chat only
  quickActions: {
    paddingHorizontal: 4,
    paddingBottom:     18,
    gap:               14,
  },
  quickActionItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    paddingVertical: 3,
  },
  quickActionEmoji: {
    fontSize: 15,
    lineHeight: 20,
  },
  quickActionLabel: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },

  // ── Input dock — 92 % width, centred inside inputOuter ─────────────────────
  inputDock: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    width:         "92%",
  },

  // Shimmer beam — faint light sweep while typing
  shimmerBeam: {
    position: "absolute",
    top:      0,
    bottom:   0,
    width:    88,
    left:     0,
  },

  // Circular + button — shadow carrier (no overflow:hidden so shadow renders on iOS)
  plusCircleWrap: {
    width:         46,
    height:        46,
    borderRadius:  23,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius:  4,
    elevation:     2,
  },
  // White fill circle — overflow:hidden clips the Pressable ripple
  plusCircleInner: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },

  // Pill outer — shadow carrier; overflow:hidden is on inputRowGlass, not here
  inputRowShadow: {
    flex:          1,
    borderRadius:  30,
    minHeight:     58,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  12,
    elevation:     4,
  },
  // Pill inner — solid white fill, no border, clips content to pill radius
  inputRowGlass: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      30,
    overflow:          "hidden",
    minHeight:         58,
    paddingLeft:       18,
    paddingRight:      8,
    borderWidth:       0,
  },

  // TextInput — flex:1 fills remaining pill width; row's alignItems:center handles vertical
  textInput: {
    flex:              1,
    fontSize:          17,
    fontFamily:        "Inter_500Medium",
    paddingVertical:   0,
    paddingHorizontal: 0,
    textAlignVertical: "center",
  },

  // Right controls row
  rightRow: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             0,
    paddingVertical: 0,
    paddingRight:    6,
  },

  // Mic hit area — no marginRight; spacing to AI button comes from pill paddingRight + dock gap
  micArea: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
  },

  // AI voice button — solid black circle
  sendWrap: {
    alignItems:     "center",
    justifyContent: "center",
  },
  // AI button outer — shadow carrier; dimensions match aiCirclePressable
  aiCircleWrap: {
    width:          50,
    height:         50,
    borderRadius:   25,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.18,
    shadowRadius:   6,
    elevation:      4,
  },
  aiCirclePressable: {
    width:           50,
    height:          50,
    borderRadius:    25,
    backgroundColor: "#0A0A0A",
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },

  // Icon layers stacked absolutely inside the AI circle
  iconCenter: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Expanded writing mode modal ───────────────────────────────────────────
  expandModal: {
    flex: 1,
  },
  expandHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingTop:        56,
    paddingBottom:     14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expandClose: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  expandTitle: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  expandInput: {
    flex:              1,
    fontSize:          16,
    fontFamily:        "Inter_400Regular",
    lineHeight:        24,
    paddingHorizontal: 22,
    paddingTop:        20,
    paddingBottom:     16,
  },
  expandFooter: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingTop:        12,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  expandCounter: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
  },
  expandSendBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
  },
});
