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
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
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
import TypingIndicator  from "@/components/TypingIndicator";
import VoiceOrbPanel    from "@/components/VoiceOrbPanel";
import { useChat }      from "@/context/ChatContext";
import { useTheme }     from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Voice phase ────────────────────────────────────────────────────────────────
type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const MIN_INPUT_H = 40;   // compact single-line height
const MAX_INPUT_H = 138;  // ~5-6 lines at 15px font

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
  const attachClr    = T.isDark ? "rgba(255,255,255,0.32)"  : "#9A9A9A";
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
        bottomOffset={bottomPad + 68}
        T={T}
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
            <TypingIndicator label={
              imagePending  ? imagePendingLabel            :
              visionPending ? "Fotoğraf analiz ediliyor…"  :
              undefined
            } />
          ) : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: topPad + 46 }} />}
        />

        {/* ════ VOICE ORB PANEL — slides in above input ════ */}
        <VoiceOrbPanel phase={voicePhase} isDark={T.isDark} />

        {/* ════ INPUT AREA ════ */}
        <View style={[ss.inputOuter, { paddingBottom: bottomPad + 10 }]}>

          {/* Input row */}
          <View style={[ss.inputRow, { backgroundColor: inputBg }]}>

            {/* Attachment — opens multimodal panel */}
            <TouchableOpacity
              style={ss.attachBtn}
              hitSlop={8}
              activeOpacity={0.60}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPanelOpen(p => !p);
              }}
            >
              <Animated.View style={plusRotAnim}>
                <Feather name="plus" size={18} color={attachClr} />
              </Animated.View>
            </TouchableOpacity>

            {/* Text field — dims slightly during voice */}
            <View style={ss.textInputWrap}>
              <TextInput
                style={[
                  ss.textInput,
                  { color: inputTextClr, opacity: voiceActive ? 0.45 : 1 },
                ]}
                placeholder={voiceActive ? "" : "AkılCEP'e yaz…"}
                placeholderTextColor={inputPlhClr}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={2000}
                scrollEnabled={scrollEnabled}
                onContentSizeChange={onContentSizeChange}
                blurOnSubmit={false}
                editable={!voiceActive}
              />
            </View>

            {/* Right controls */}
            <View style={ss.rightRow}>

              {/* Mic — bare icon, no circle background */}
              <View style={ss.micWrap}>
                <Animated.View
                  style={[ss.micHalo, { backgroundColor: T.fg }, sttPulseStyle]}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  style={{ opacity: sttListening ? 1 : (hasText ? 0.32 : 0.52) }}
                  onPress={handleSttPress}
                  activeOpacity={0.65}
                  hitSlop={10}
                >
                  <Feather
                    name={sttListening ? "square" : "mic"}
                    size={16}
                    color={sttListening ? T.fg : attachClr}
                  />
                </TouchableOpacity>
              </View>

              {/* Smart arrow — send when typing, dark AkılCEP-branded voice orb when empty */}
              <Animated.View style={[ss.sendWrap, sendStyle, voicePulseAnim]}>
                {/* Deep black bg — voice mode */}
                <Animated.View style={[ss.sendBtnBg, { backgroundColor: "#0A0A0A" }, arrowVoiceBgAnim]} />
                {/* Primary-color bg — send mode */}
                <Animated.View style={[ss.sendBtnBg, { backgroundColor: T.primary }, arrowSendBgAnim]} />

                <TouchableOpacity
                  style={ss.sendBtnTouch}
                  onPress={hasText ? handleSend : () => {
                    if (Platform.OS === "web") {
                      Alert.alert("Sesli Mod", "Sesli mod yalnızca mobil cihazlarda çalışır.");
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push("/voice");
                  }}
                  hitSlop={12} activeOpacity={0.75}
                >
                  {/* Send arrow — visible when text exists */}
                  <Animated.View style={[ss.iconCenter, arrowSendIconAnim]}>
                    <Feather name="arrow-up" size={16} color={T.primaryForeground} />
                  </Animated.View>
                  {/* AkılCEP leaf logo — visible when input is empty (voice mode) */}
                  <Animated.View style={[ss.iconCenter, arrowVoiceIconAnim]}>
                    <Image
                      source={leafOnly}
                      style={ss.orbLeaf}
                      tintColor="rgba(255,255,255,0.90)"
                      resizeMode="contain"
                    />
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>

          </View>
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
    paddingHorizontal: 14,
    paddingTop:        4,
  },

  // Input row — 56 px pill
  inputRow: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      999,
    height:            56,
    paddingHorizontal: 10,
    gap:               2,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.05,
    shadowRadius:      10,
    elevation:         3,
  },
  attachBtn: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
  },
  // Plain flex wrapper for TextInput
  textInputWrap: {
    flex:           1,
    justifyContent: "center",
  },
  textInput: {
    flex:              1,
    fontSize:          15,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 6,
    paddingVertical:   0,
    lineHeight:        22,
  },

  // Right controls
  rightRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },

  // Mic — bare icon, halo for STT feedback
  micWrap: {
    width:          32,
    height:         32,
    alignItems:     "center",
    justifyContent: "center",
  },
  micHalo: {
    position:     "absolute",
    width:        32,
    height:       32,
    borderRadius: 16,
  },
  micBtn: {
    width:          32,
    height:         32,
    alignItems:     "center",
    justifyContent: "center",
  },

  // AkılCEP button — 40 px single circle (~17% smaller than previous 48px)
  sendWrap: {
    width: 40, height: 40,
    alignItems:     "center",
    justifyContent: "center",
  },
  sendBtnBg: {
    position:      "absolute",
    width:         40, height: 40, borderRadius: 20,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius:  7,
    elevation:     4,
  },
  sendBtnTouch: {
    width: 40, height: 40, borderRadius: 20,
    alignItems:     "center",
    justifyContent: "center",
  },
  iconCenter: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
  },
  orbLeaf: {
    width:  17,
    height: 17,
  },
});
