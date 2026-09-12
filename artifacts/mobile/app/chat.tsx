/**
 * ChatScreen — AkılCEP premium AI chat with inline Voice Mode.
 *
 * Voice flow (expo-audio → Whisper → GPT → expo-speech):
 *   idle → [mic tap] → listening → [tap / silence] → thinking
 *   → injectMessages() → speaking → idle
 *
 * No separate voice screen. Voice lives entirely inside the chat.
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
import { StatusBar } from "expo-status-bar";
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
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView, useKeyboardContext } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
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
import Svg, {
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import SideMenu         from "@/components/SideMenu";
import MultimodalPanel  from "@/components/MultimodalPanel";
import MessageBubble    from "@/components/MessageBubble";
import ImageGenCard     from "@/components/ImageGenCard";
import ThinkingCard     from "@/components/ThinkingCard";
import VoiceOrbPanel    from "@/components/VoiceOrbPanel";
import { AkilMic }      from "@/components/AkilMic";
import { useChat, type ChatAttachment } from "@/context/ChatContext";
import { useLanguage }  from "@/context/LanguageContext";
import { useTheme }     from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Voice phase ────────────────────────────────────────────────────────────────
type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const MIN_INPUT_H = 42;   // single-line underlined input
const MAX_INPUT_H = 120;  // ~5 lines before scroll kicks in
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 24 * 1024 * 1024;

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
  const { t }          = useLanguage();
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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [composerHeight, setComposerHeight] = useState(72);

  const isSecretChat = !!currentConversation?.isPrivate;

  const flatListRef     = useRef<FlatList>(null);
  const voicePhaseRef   = useRef<VoicePhase>("idle");
  const voiceRecorder   = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const sttRecorder     = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingRef    = useRef<AudioRecorder | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const voiceConvIdRef  = useRef<number>(0);
  const permGrantedRef  = useRef<boolean | null>(null); // null = unchecked

  // ── STT — lightweight speech-to-text that fills the input field ─────────────
  const [sttListening,  setSttListening]  = useState(false);
  const sttRecordingRef = useRef<AudioRecorder | null>(null);
  const sttAbortRef     = useRef<AbortController | null>(null);

  const applyVoice = (p: VoicePhase) => {
    voicePhaseRef.current = p;
    setVoicePhase(p);
  };

  const hasText     = inputText.trim().length > 0;
  const hasComposerContent = hasText || pendingAttachments.length > 0;
  const hasMessages = currentMessages.length > 0;
  const topPad      = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad   = Platform.OS === "web" ? 34 : insets.bottom;

  const addPendingAttachments = (incoming: ChatAttachment[]) => {
    setPendingAttachments((current) => {
      const remainingSlots = Math.max(0, MAX_ATTACHMENT_COUNT - current.length);
      const currentBytes = current.reduce((sum, attachment) => sum + (attachment.size ?? 0), 0);
      let nextBytes = currentBytes;
      const accepted: ChatAttachment[] = [];

      for (const attachment of incoming) {
        if (accepted.length >= remainingSlots) break;
        const size = attachment.size ?? 0;
        if (size > MAX_ATTACHMENT_BYTES || nextBytes + size > MAX_TOTAL_ATTACHMENT_BYTES) continue;
        accepted.push(attachment);
        nextBytes += size;
      }

      if (accepted.length !== incoming.length) {
        setTimeout(() => {
          Alert.alert(t("chat.attachmentLimit.title"), t("chat.attachmentLimit.message"));
        }, 0);
      }
      return [...current, ...accepted];
    });
  };
  const isSpeaking  = voicePhase === "speaking";

  // Keyboard height tracking — dock floats above keyboard
  const { reanimated: kbReanimated } = useKeyboardContext();
  const kbH = kbReanimated.height;
  const dockKbStyle = useAnimatedStyle(() => {
    // Some Android keyboards stop progress just below 1, which leaves part of
    // the safe-area inset above the IME. Derive the fade from the actual
    // animated keyboard height instead so an open keyboard always gets 0 inset.
    const keyboardReveal = Math.min(1, Math.abs(kbH.value) / 48);
    return {
      bottom:
        (bottomPad + 8) * (1 - keyboardReveal)
        - kbH.value,
    };
  });
  const auraBottomInsetStyle = useAnimatedStyle(() => {
    const keyboardReveal = Math.min(1, Math.abs(kbH.value) / 48);
    const insetExtension = bottomPad * (1 - keyboardReveal);
    return {
      bottom: -34 - insetExtension,
      height: 540 + insetExtension,
    };
  });
  const sendWaveBottomInsetStyle = useAnimatedStyle(() => {
    const keyboardReveal = Math.min(1, Math.abs(kbH.value) / 48);
    const insetExtension = bottomPad * (1 - keyboardReveal);
    return {
      bottom: -28 - insetExtension,
      height: 560 + insetExtension,
    };
  });

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

  const handleSend = async () => {
    if (!hasComposerContent) return;
    let verifiedAttachments = pendingAttachments;
    try {
      verifiedAttachments = pendingAttachments.map((attachment) => {
        const file = new FileSystem.File(attachment.uri);
        if (!file.exists) throw new Error("attachment_unreadable");
        const actualSize = file.size;
        if (actualSize > MAX_ATTACHMENT_BYTES) throw new Error("attachment_size");
        return { ...attachment, size: actualSize };
      });
      const totalBytes = verifiedAttachments.reduce((sum, attachment) => sum + (attachment.size ?? 0), 0);
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error("attachment_total_size");
    } catch {
      Alert.alert(t("chat.attachmentError.title"), t("chat.attachmentError.message"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.80, { duration: 70 }, () => {
      sendScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    sendWave.value = 0;
    sendWave.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
    sendMessage(inputText.trim(), verifiedAttachments);
    setInputText("");
    setPendingAttachments([]);
    inputHeightSV.value = withTiming(MIN_INPUT_H, { duration: 160 });
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
  const keyboardVisibleRef = useRef(false);
  const openPanelAfterKeyboardRef = useRef(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
      openPanelAfterKeyboardRef.current = false;
      setPanelOpen(false);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      if (openPanelAfterKeyboardRef.current) {
        openPanelAfterKeyboardRef.current = false;
        setPanelOpen(true);
      }
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // + button rotation: 0° at rest → 45° (becomes ✕) when panel open
  const plusRotSV = useSharedValue(0);
  useEffect(() => {
    plusRotSV.value = withTiming(panelOpen ? 1 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
  }, [panelOpen]);
  const plusRotAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(plusRotSV.value, [0, 1], [0, 45])}deg` }],
  }));

  // ── Shared values — smart arrow button (send ↔ dark voice orb) ─────────────
  const voiceModeSV    = useSharedValue(0);  // 0 = send, 1 = voice-orb
  const arrowGlowPulse = useSharedValue(0);  // ambient pulse 0→1 in voice mode
  const inputHeightSV  = useSharedValue(MIN_INPUT_H);  // animated input height
  const inputFocused   = useSharedValue(0);             // 0 = rest, 1 = focused
  const auraLevel      = useSharedValue(0.12);
  const auraBreath     = useSharedValue(0);
  const auraDrift      = useSharedValue(0);
  const aiAuraPulse    = useSharedValue(0);
  const sendWave       = useSharedValue(0);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FOCUS_DUR = { duration: 250, easing: Easing.out(Easing.ease) } as const;
  const focusLineStyle = useAnimatedStyle(() => ({
    opacity: inputFocused.value,
    transform: [{ scaleX: interpolate(inputFocused.value, [0, 1], [0.78, 1]) }],
  }));

  // Adaptive multiline: scrolls once past MAX_INPUT_H
  const [scrollEnabled, setScrollEnabled] = useState(false);

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
  // Minimal press feedback for mic and action button.
  const sendPressGlow = useSharedValue(0);
  const PRESS_IN  = { duration: 80 } as const;
  const PRESS_OUT = { duration: 220, easing: Easing.out(Easing.ease) } as const;
  const sendPressHighlightStyle = useAnimatedStyle(() => ({
    opacity: sendPressGlow.value,
  }));
  // Mic scale press — 0.95 in 120ms
  const micScaleSV    = useSharedValue(1);
  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScaleSV.value }],
  }));

  // + button press — scale 1.0 → 0.97
  const plusScaleSV = useSharedValue(0);
  const plusPressStyle = useAnimatedStyle(() => ({
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

  // Soft composer aura. All continuous motion stays on Reanimated's UI thread.
  useEffect(() => {
    auraBreath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    auraDrift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);

    if (inputText.length > 0) {
      auraLevel.value = withTiming(0.92, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      });
      typingIdleTimerRef.current = setTimeout(() => {
        auraLevel.value = withTiming(0.30, {
          duration: 950,
          easing: Easing.out(Easing.ease),
        });
      }, 720);
    } else if (!isTyping) {
      auraLevel.value = withTiming(0.12, {
        duration: 900,
        easing: Easing.out(Easing.ease),
      });
    }

    return () => {
      if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    };
  }, [inputText, isTyping]);

  useEffect(() => {
    if (isTyping) {
      auraLevel.value = withTiming(0.38, {
        duration: 700,
        easing: Easing.out(Easing.ease),
      });
      aiAuraPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      aiAuraPulse.value = withTiming(0, { duration: 650 });
      if (inputText.length === 0) {
        auraLevel.value = withTiming(0.12, {
          duration: 850,
          easing: Easing.out(Easing.ease),
        });
      }
    }
  }, [isTyping]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity:
      0.17
      + auraLevel.value * 0.56
      + aiAuraPulse.value * 0.12
      + inputFocused.value * 0.10,
    transform: [
      { translateX: interpolate(auraDrift.value, [0, 1], [-10, 10]) },
      {
        scaleX:
          1
          + auraBreath.value * (0.025 + auraLevel.value * 0.025)
          + inputFocused.value * 0.018,
      },
      { scaleY: 1 + auraBreath.value * 0.035 },
    ],
  }));

  const sendWaveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sendWave.value,
      [0, 0.16, 0.58, 1],
      [0, 0.58, 0.22, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateY: interpolate(sendWave.value, [0, 1], [28, -42]) },
      { scaleX: interpolate(sendWave.value, [0, 1], [0.74, 1.10]) },
      { scaleY: interpolate(sendWave.value, [0, 1], [0.82, 1.08]) },
    ],
  }));

  // ── Arrow morphs: text present → send / empty → dark voice orb ─────────────
  useEffect(() => {
    voiceModeSV.value = withTiming(hasComposerContent ? 0 : 1, {
      duration: 340,
      easing:   Easing.out(Easing.ease),
    });
    if (!hasComposerContent) {
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
  }, [hasComposerContent]);

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
      const { granted } = await requestRecordingPermissionsAsync();
      permGrantedRef.current = granted;
      if (!granted) {
        Alert.alert(
          t("chat.alert.micPerm"),
          t("chat.alert.micPermMsg"),
          [{ text: t("common.ok") }]
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
    try { await rec.stop(); } catch {}
  };

  // ── Mic button handler ─────────────────────────────────────────────────────
  const handleMicPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const p = voicePhaseRef.current;

    if (Platform.OS === "web") {
      Alert.alert(t("chat.alert.voiceMode"), t("chat.alert.voiceModeMsg"));
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
        await setAudioModeAsync({
          allowsRecording:   true,
          playsInSilentMode: true,
        });
      } catch {}
      applyVoice("idle");
    }
  };

  // ── Adaptive height ──────────────────────────────────────────────────────────
  const HEIGHT_ANIM = { duration: 160 } as const;
  const onContentSizeChange = (e: { nativeEvent: { contentSize: { height: number } } }) => {
    const h = e.nativeEvent.contentSize.height;
    const clamped = Math.min(Math.max(h, MIN_INPUT_H), MAX_INPUT_H);
    inputHeightSV.value = withTiming(clamped, HEIGHT_ANIM);
    setScrollEnabled(h > MAX_INPUT_H);
  };

  // ── STT helpers — mic icon fills input field (no navigation) ────────────────
  const handleSttPress = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("chat.alert.voiceInput"), t("chat.alert.voiceInputMsg"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sttListening) { await stopStt(); } else { await startStt(); }
  };

  const startStt = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await sttRecorder.prepareToRecordAsync();
      sttRecorder.record();
      sttRecordingRef.current = sttRecorder;
      setSttListening(true);
    } catch {
      Alert.alert(t("chat.alert.voiceInput"), t("chat.alert.micStartFail"));
    }
  };

  const stopStt = async () => {
    const rec = sttRecordingRef.current;
    sttRecordingRef.current = null;
    setSttListening(false);
    if (!rec) return;
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = rec.uri;
      if (!uri) return;
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
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
      await setAudioModeAsync({
        allowsRecording:   true,
        playsInSilentMode: true,
      });

      await voiceRecorder.prepareToRecordAsync();
      voiceRecorder.record();
      recordingRef.current = voiceRecorder;
      applyVoice("listening");
    } catch (err) {
      console.warn("[voice] startListening:", err);
      Alert.alert(t("chat.alert.recError"), t("chat.alert.recErrorMsg"));
    }
  };

  // ── Stop → encode → send ───────────────────────────────────────────────────
  const stopAndProcess = async () => {
    applyVoice("thinking");
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) { applyVoice("idle"); return; }

    try {
      await rec.stop();

      await setAudioModeAsync({
        allowsRecording:   false,
        playsInSilentMode: true,
      });

      const uri = rec.uri;
      if (!uri) { applyVoice("idle"); return; }

      // Read as base64 — reliable on Expo Go native
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
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
        Alert.alert(t("chat.alert.voiceMode"), t("chat.alert.serverError"));
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
      await setAudioModeAsync({
        allowsRecording:   true,
        playsInSilentMode: true,
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

  const logoTint     = T.isDark ? "#888888"                 : "#5A5A5A";

  const voiceActive = voicePhase !== "idle";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>
      <StatusBar
        style={T.isDark ? "light" : "dark"}
      />
      <MultimodalPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onImagesPicked={(assets) => {
          addPendingAttachments(
            assets.map((asset, index) => ({
              id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
              kind: "image" as const,
              uri: asset.uri,
              name: asset.fileName ?? undefined,
              mimeType: asset.mimeType || "image/jpeg",
              size: asset.fileSize,
              width: asset.width,
              height: asset.height,
            })),
          );
        }}
        onFilesPicked={(files) => {
          addPendingAttachments(
            files.map((file, index) => ({
              id: `${file.uri}-${Date.now()}-${index}`,
              kind: "file" as const,
              uri: file.uri,
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
            })),
          );
        }}
        onNote={() => setExpandedOpen(true)}
        onLocationPicked={({ latitude, longitude }) => {
          const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
          setInputText((current) => current ? `${current}\n${locationUrl}` : locationUrl);
        }}
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
          <Text style={[ss.secretBadgeText, { color: T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)" }]}>{t("chat.secretBadge")}</Text>
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
      <KeyboardAvoidingView
        style={ss.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
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
           contentContainerStyle={[ss.msgList, { paddingTop: bottomPad + composerHeight }]}
          ListHeaderComponent={isTyping ? (
            imagePending ? (
              <ImageGenCard />
            ) : (
              <ThinkingCard label={
                visionPending ? t("chat.visionPending") : undefined
              } />
            )
          ) : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: topPad + 46 }} />}
        />

        {/* ════ VOICE ORB PANEL — slides in above input ════ */}
        <VoiceOrbPanel phase={voicePhase} isDark={T.isDark} />

      </KeyboardAvoidingView>

      {/* ════ FLOATING DOCK — absolute, floats over content, tracks keyboard ════ */}
      <Animated.View
        style={[ss.inputOuter, dockKbStyle]}
        onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
      >
        <Animated.View
          pointerEvents="none"
          style={[ss.composerAura, auraBottomInsetStyle, auraStyle]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 400 540">
            <Defs>
              <RadialGradient id="composerAura" cx="50%" cy="98%" rx="68%" ry="100%">
                <Stop offset="0%" stopColor={T.isDark ? "#76AEEA" : "#5B9AD9"} stopOpacity="0.80" />
                <Stop offset="18%" stopColor={T.isDark ? "#68A7E4" : "#69A9E5"} stopOpacity="0.54" />
                <Stop offset="44%" stopColor={T.isDark ? "#5B9AD9" : "#8AC0EF"} stopOpacity="0.25" />
                <Stop offset="72%" stopColor={T.isDark ? "#5B9AD9" : "#B9DAF6"} stopOpacity="0.085" />
                <Stop offset="100%" stopColor="#5B9AD9" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="400" height="540" fill="url(#composerAura)" />
          </Svg>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[ss.sendLightWave, sendWaveBottomInsetStyle, sendWaveStyle]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 400 560">
            <Defs>
              <RadialGradient id="sendWave" cx="50%" cy="102%" rx="62%" ry="104%">
                <Stop offset="0%" stopColor={T.isDark ? "#8FC5F4" : "#5B9AD9"} stopOpacity="0.84" />
                <Stop offset="24%" stopColor="#78B4ED" stopOpacity="0.46" />
                <Stop offset="58%" stopColor="#9CCBF2" stopOpacity="0.15" />
                <Stop offset="82%" stopColor="#CBE3F8" stopOpacity="0.045" />
                <Stop offset="100%" stopColor="#5B9AD9" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="400" height="560" fill="url(#sendWave)" />
          </Svg>
        </Animated.View>
        <View style={ss.dock}>
          {pendingAttachments.length > 0 && (
            <ScrollView
              horizontal
              style={ss.attachmentScroller}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={ss.attachmentStrip}
              keyboardShouldPersistTaps="handled"
            >
              {pendingAttachments.map((attachment) => (
                <View key={attachment.id} style={[ss.attachmentCard, { backgroundColor: T.isDark ? "#242424" : "#F1F2F4" }]}>
                  {attachment.kind === "image" ? (
                    <Image source={{ uri: attachment.uri }} style={ss.attachmentImage} />
                  ) : (
                    <View style={[ss.fileIcon, { backgroundColor: T.isDark ? "#353535" : "#E2E4E8" }]}>
                      <Feather name="file" size={16} color={T.fgSoft} />
                    </View>
                  )}
                  <View style={ss.attachmentInfo}>
                    <Text style={[ss.attachmentName, { color: T.fg }]} numberOfLines={1} ellipsizeMode="middle">
                      {attachment.name || (attachment.kind === "image" ? "Görsel" : "Dosya")}
                    </Text>
                    <Text style={[ss.attachmentMeta, { color: T.muted }]} numberOfLines={1}>
                      {attachment.mimeType || attachment.kind}
                      {attachment.size ? ` · ${attachment.size >= 1048576
                        ? `${(attachment.size / 1048576).toFixed(1)} MB`
                        : `${Math.ceil(attachment.size / 1024)} KB`}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    style={ss.attachmentRemove}
                    hitSlop={8}
                    onPress={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  >
                    <Feather name="x" size={13} color={T.fgSoft} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={ss.composerRow}>

          {/* A — minimal plus action, no card or capsule */}
          <Animated.View style={[ss.dockPlus, plusPressStyle]}>
            <Pressable
              style={ss.dockPlusInner}
              onPressIn={() => {
                plusScaleSV.value = withTiming(1, PRESS_IN);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onPressOut={() => { plusScaleSV.value = withTiming(0, PRESS_OUT); }}
              onPress={() => {
                if (keyboardVisibleRef.current) {
                  openPanelAfterKeyboardRef.current = true;
                  Keyboard.dismiss();
                  return;
                }
                setPanelOpen((current) => !current);
              }}
              hitSlop={4}
            >
              <Animated.View style={plusRotAnim}>
                <Feather name="plus" size={21} color={T.isDark ? "#EDEBE7" : "#222222"} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* B — open input surface with a single underline */}
          <Animated.View style={[ss.underlineInput, inputFieldAnim]}>
            <View style={ss.underlineInputRow}>
              <TextInput
                style={[
                  ss.dockField,
                  {
                    color: T.isDark ? "#F2F0EC" : "#111111",
                    opacity: voiceActive ? 0.45 : 1,
                  },
                ]}
                placeholder={sttListening ? t("chat.listening") : t("chat.placeholder")}
                placeholderTextColor={sttListening
                  ? (T.isDark ? "#76AEEA" : "#5B9AD9")
                  : (T.isDark ? "rgba(255,255,255,0.36)" : "#A7ABB2")}
                multiline
                scrollEnabled={scrollEnabled}
                value={inputText}
                onContentSizeChange={onContentSizeChange}
                onChangeText={setInputText}
                maxLength={4000}
                returnKeyType="send"
                onSubmitEditing={() => { if (hasComposerContent) void handleSend(); }}
                editable={!voiceActive && !sttListening}
                onFocus={() => {
                  openPanelAfterKeyboardRef.current = false;
                  setPanelOpen(false);
                  inputFocused.value = withTiming(1, FOCUS_DUR);
                }}
                onBlur={() => {
                  inputFocused.value = withTiming(0, FOCUS_DUR);
                }}
              />

              {/* Mic */}
              <Animated.View style={[ss.dockMicWrap, micScaleStyle]}>
                <AkilMic
                  listening={sttListening}
                  size={20}
                  color={sttListening
                    ? (T.isDark ? "#76AEEA" : "#5B9AD9")
                    : (T.isDark ? "rgba(255,255,255,0.60)" : "#2E2E2E")}
                  onPressIn={() => {
                    micScaleSV.value   = withTiming(0.95, { duration: 120 });
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  onPressOut={() => {
                    micScaleSV.value   = withTiming(1.0, { duration: 120 });
                  }}
                  onPress={handleSttPress}
                  hitSlop={8}
                />
              </Animated.View>
            </View>
            <View
              style={[
                ss.inputUnderline,
                { backgroundColor: T.isDark ? "rgba(255,255,255,0.16)" : "#E5E7EB" },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                ss.inputFocusLine,
                { backgroundColor: T.isDark ? "#76AEEA" : "#5B9AD9" },
                focusLineStyle,
              ]}
              pointerEvents="none"
            />
          </Animated.View>

          {/* C — black AI voice button */}
          <Animated.View style={[ss.dockAiShell, aiCombinedStyle]}>
            <Pressable
              style={ss.dockAiBody}
              onPressIn={() => {
                sendPressGlow.value = withTiming(1, PRESS_IN);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              onPressOut={() => { sendPressGlow.value = withTiming(0, PRESS_OUT); }}
              onPress={hasComposerContent ? () => { void handleSend(); } : () => {
                if (Platform.OS === "web") {
                  Alert.alert(t("chat.alert.voiceMode"), t("chat.alert.voiceMobileOnly"));
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/voice");
              }}
              hitSlop={4}
            >
              <Animated.View
                style={[StyleSheet.absoluteFill, { borderRadius: 28, backgroundColor: "rgba(255,255,255,0.14)" }, sendPressHighlightStyle]}
                pointerEvents="none"
              />
              <Animated.View style={[ss.iconCenter, arrowSendIconAnim]}>
                <Feather name="arrow-up" size={20} color="#FFFFFF" />
              </Animated.View>
              <Animated.View style={[ss.iconCenter, arrowVoiceIconAnim]}>
                <WaveformBars active={voiceActive || sttListening} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          </View>
        </View>
      </Animated.View>

      {/* ════ SECRET CHAT — START MODAL ════ */}
      <Modal visible={secretModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSecretModal(false)}>
        <View style={ss.modalOverlay}>
          <View style={[ss.modalCard, { backgroundColor: T.isDark ? "#111111" : "#F7F7F5", borderColor: T.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)" }]}>
            <View style={[ss.modalIconCircle, { backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
              <Feather name="lock" size={20} color={T.isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.50)"} />
            </View>
            <Text style={[ss.modalTitle, { color: T.fg }]}>{t("chat.secretModal.title")}</Text>
            <Text style={[ss.modalDesc,  { color: T.fgSoft }]}>{t("chat.secretModal.desc")}</Text>
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
              <Text style={[ss.modalBtnText, { color: T.isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)" }]}>{t("chat.secretModal.start")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.modalBtnGhost} activeOpacity={0.55} onPress={() => setSecretModal(false)}>
              <Text style={[ss.modalBtnGhostText, { color: T.muted }]}>{t("common.cancel")}</Text>
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
            <Text style={[ss.expandTitle, { color: T.fgSoft }]}>{t("chat.expandTitle")}</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Large text area */}
          <TextInput
            style={[ss.expandInput, { color: T.fg }]}
            placeholder={t("chat.expandPlaceholder")}
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
               style={[ss.expandSendBtn, { backgroundColor: T.primary, opacity: hasComposerContent ? 1 : 0.38 }]}
               disabled={!hasComposerContent}
              activeOpacity={0.75}
              onPress={() => {
                setExpandedOpen(false);
                setTimeout(() => { void handleSend(); }, 80);
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
            <Text style={[ss.modalTitle, { color: T.fg }]}>{t("chat.exitModal.title")}</Text>
            <Text style={[ss.modalDesc,  { color: T.fgSoft }]}>{t("chat.exitModal.desc")}</Text>
            <TouchableOpacity
              style={[ss.modalBtn, { backgroundColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)" }]}
              activeOpacity={0.70}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setExitModal(false);
                startNewConversation();
              }}
            >
              <Text style={[ss.modalBtnText, { color: T.isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)" }]}>{t("chat.exitModal.end")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.modalBtnGhost} activeOpacity={0.55} onPress={() => setExitModal(false)}>
              <Text style={[ss.modalBtnGhostText, { color: T.muted }]}>{t("chat.exitModal.continue")}</Text>
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
    ...StyleSheet.absoluteFill,
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

  // Floating dock — absolute, no background, tracks keyboard via dockKbStyle
  inputOuter: {
    position:          "absolute",
    left:              0,
    right:             0,
    paddingTop:        4,
    alignItems:        "center",
  },
  composerAura: {
    position: "absolute",
    left: "-8%",
    right: "-8%",
    bottom: -34,
    height: 540,
  },
  sendLightWave: {
    position: "absolute",
    left: "-8%",
    right: "-8%",
    bottom: -28,
    height: 560,
  },



  // ── Floating input dock styles ────────────────────────────────────────────

  // Row container — 92% of screen width, centred by inputOuter
  dock: {
    width:             "92%",
    minWidth:          0,
    paddingVertical:   4,
  },
  composerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    width:         "100%",
    minWidth:      0,
  },

  // A — Plus icon with a generous touch target, no visual container
  dockPlus: {
    width:  44,
    height: 44,
  },
  dockPlusInner: {
    width:           44,
    height:          44,
    backgroundColor: "transparent",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // B — Spacious input with a single understated underline
  underlineInput: {
    flex:       1,
    minWidth:   0,
    minHeight:  42,
  },
  underlineInputRow: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    minHeight:       40,
  },
  attachmentStrip: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 10,
    paddingTop: 4,
  },
  attachmentScroller: {
    width:    "100%",
    flexGrow: 0,
  },
  attachmentCard: {
    width: 150,
    minHeight: 64,
    borderRadius: 12,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attachmentImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  fileIcon: {
    width: 34,
    height: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentInfo: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  attachmentMeta: {
    fontSize: 9,
    marginTop: 3,
  },
  attachmentRemove: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // TextInput — grows with content; all spacing via parent paddingLeft/Right
  dockField: {
    flex:              1,
    minHeight:         26,
    maxHeight:         104,
    fontSize:          16,
    fontFamily:        "Inter_400Regular",
    letterSpacing:     -0.3,
    paddingVertical:   0,
    paddingHorizontal: 0,
    textAlignVertical: "center",
    paddingLeft: 0,
    paddingRight:      8,
  },
  inputUnderline: {
    position: "absolute",
    left:     0,
    right:    0,
    bottom:   0,
    height:   StyleSheet.hairlineWidth,
  },
  inputFocusLine: {
    position: "absolute",
    left:     0,
    right:    0,
    bottom:   0,
    height:   1,
  },
  // Mic touch target — 44×44 (minimum Apple HIG)
dockMicWrap: {
    width:          40,
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },

  // C — AI voice button 46×46, radius 23
  dockAiShell: {
    width:          46,
    height:         46,
    borderRadius:   23,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.15,
    shadowRadius:   5,
    elevation:      3,
  },
  dockAiBody: {
    width:           46,
    height:          46,
    borderRadius:    23,
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
