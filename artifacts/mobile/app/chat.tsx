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
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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

import SideDrawer         from "@/components/SideDrawer";
import type { SideDrawerHandle } from "@/components/SideDrawer";
import MultimodalPanel  from "@/components/MultimodalPanel";
import MessageBubble    from "@/components/MessageBubble";
import ImageGenCard     from "@/components/ImageGenCard";
import ThinkingCard     from "@/components/ThinkingCard";
import EarthOrb         from "@/components/EarthOrb";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useChat, type ChatAttachment } from "@/context/ChatContext";
import { useLanguage }  from "@/context/LanguageContext";
import { useTheme }     from "@/context/ThemeContext";
import { VEIL_COLORS_LIGHT, VEIL_COLORS_DARK, VEIL_STOPS } from "@/constants/translucentBars";
import WeatherExperience from "@/components/WeatherExperience";
import { useWeatherAtmosphere } from "@/hooks/useWeatherAtmosphere";
import { useRainAmbience } from "@/hooks/useRainAmbience";
import { useAuth } from "@/context/AuthContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const SURFACE_LIGHT = "rgba(255,255,255,0.72)";
const SURFACE_DARK = "rgba(66,66,68,0.72)";
const WEATHER_BLUE = { light: "#1976D2", dark: "#64B5F6" } as const;
const HEADER_WEATHER = {
  rain: { icon: "cloud-rain", label: "Yağmurlu" },
  snow: { icon: "cloud-snow", label: "Karlı" },
  sun: { icon: "sun", label: "Açık" },
  clouds: { icon: "cloud", label: "Bulutlu" },
  storm: { icon: "cloud-lightning", label: "Fırtınalı" },
  fog: { icon: "wind", label: "Sisli" },
  "partly-cloudy": { icon: "cloud", label: "Parçalı bulutlu" },
} as const;

const MIN_INPUT_H = 44;   // compact single-line capsule; grows with the draft
const MAX_INPUT_H = 120;  // ~5 lines before scroll kicks in
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 24 * 1024 * 1024;

// Both layers use the same keyboard/inset geometry. Padding inside an inverted
// list is not a viewport boundary: older messages can still scroll through it.
function voiceLayoutBottom(
  composerHeight: number, inset: number, stageHeight: number, keyboardY: number,
  height: number, headerBottom: number, orbDiameter: number, progress: number,
) {
  "worklet";
  const keyboardHeight = Math.max(0, -keyboardY);
  const keyboardReveal = Math.min(1, keyboardHeight / 48);
  const stageBottom = composerHeight + inset * (1 - keyboardReveal) + 10 * keyboardReveal + 8;
  const visibleBottom = height - keyboardHeight - stageBottom;
  const orbCenter = visibleBottom - stageHeight + 8 + orbDiameter / 2;
  const centeredOrb = (headerBottom + visibleBottom) / 2;
  const shift = (centeredOrb - orbCenter) * progress;
  return {
    stageBottom,
    stageTranslateY: -keyboardHeight + shift,
    messageBottom: Math.max(0, stageBottom + stageHeight + keyboardHeight - shift),
  };
}

export default function ChatScreen() {
  const { theme: T }   = useTheme();
  const { t }          = useLanguage();
  const { user } = useAuth();
  const weather = useWeatherAtmosphere(user?.id ?? "guest");
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
  const [moreOpen,         setMoreOpen]     = useState(false);
  const [exitSecretModal,  setExitModal]    = useState(false);
  const [expandedOpen,     setExpandedOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [composerContentHeight, setComposerContentHeight] = useState(72);

  const flatListRef     = useRef<FlatList>(null);
  const nearLatestRef = useRef(true);
  const textInputRef    = useRef<TextInput>(null);
  const inputFocusedRef = useRef(false);
  const inputBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreInputFocusRef = useRef(false);
  const sideMenuRef     = useRef<SideDrawerHandle>(null);
  const menuVisibleRef  = useRef(false);
  const sendingRef      = useRef(false);
  const params          = useLocalSearchParams<{ voice?: string }>();
  const legacyVoiceRef  = useRef(params.voice === "1");
  const legacyConsumedRef = useRef(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const [kbVisible, setKbVisible] = useState(false);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [stageH, setStageH] = useState(0);
  const [voiceView, setVoiceView] = useState<"chat" | "orb">("chat");
  const voiceViewProgress = useSharedValue(0);

  const voice = useVoiceSession({
    injectMessages,
    onDictation: (text) => setInputText((draft) =>
      `${draft.trimEnd()}${draft.trim() ? " " : ""}${text}`.slice(0, 4000)
    ),
    currentConversationId: currentConversation?.id ?? null,
    blocked: menuVisible || secretModal || exitSecretModal || panelOpen || moreOpen || isTyping,
  });
  const voiceExitRef = useRef(voice.exit);
  voiceExitRef.current = voice.exit;
  const exitVoice = useCallback(() => { void voiceExitRef.current(); }, []);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", event => {
      setKbVisible(true);
      setKeyboardTop(event.endCoordinates.screenY);
    });
    const b = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKbVisible(false);
      setKeyboardTop(null);
    });
    return () => { a.remove(); b.remove(); };
  }, []);

  useEffect(() => {
    if (params.voice === "1" && !legacyConsumedRef.current) {
      legacyConsumedRef.current = true;
      legacyVoiceRef.current = true;
      void voice.enter();
      router.setParams({ voice: undefined });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.voice]);

  useEffect(() => {
    if (panelOpen && voice.enabled) exitVoice();
  }, [panelOpen, voice.enabled, exitVoice]);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  const focusComposer = useCallback((delay = Platform.OS === "android" ? 220 : 80) => {
    return setTimeout(() => textInputRef.current?.focus(), delay);
  }, []);

  const openMenu = useCallback(() => {
    Keyboard.dismiss();
    setMenuVisible(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const focusTimer = legacyVoiceRef.current ? null : focusComposer();
      return () => {
        if (focusTimer) clearTimeout(focusTimer);
        exitVoice();
      };
    }, [focusComposer, exitVoice]),
  );

  const beginNewConversation = useCallback(() => {
    exitVoice();
    startNewConversation();
    focusComposer();
  }, [exitVoice, focusComposer, startNewConversation]);

  useEffect(() => {
    menuVisibleRef.current = menuVisible;
  }, [menuVisible]);

  const edgeSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !menuVisibleRef.current &&
        dx > 10 &&
        Math.abs(dx) > Math.abs(dy) * 1.8,
      onPanResponderMove: (_, { dx }) => {
        if (dx > 0) sideMenuRef.current?.updateOpeningGesture(dx);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        sideMenuRef.current?.finishOpeningGesture(dx, vx);
      },
      onPanResponderTerminate: (_, { dx, vx }) => {
        sideMenuRef.current?.finishOpeningGesture(dx, vx);
      },
    }),
  ).current;

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuVisible) { setMenuVisible(false); return true; }
      if (voice.enabled) { exitVoice(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [menuVisible, voice.enabled, exitVoice]);

  const hasText     = inputText.trim().length > 0;
  const hasComposerContent = hasText || pendingAttachments.length > 0;
  const topPad      = insets.top;
  const bottomInset = insets.bottom;

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
  const isSpeaking  = voice.phase === "speaking";
  const rainSound = useRainAmbience({
    data: weather.atmosphereData,
    openingId: weather.openingId,
    active: weather.active && !menuVisible,
    blocked: voice.enabled || voice.phase !== "idle",
    userKey: user?.id ?? "guest",
  });

  // Keep the dock in the root edge-to-edge coordinate space. Its safe-area
  // contribution lives in the outer dock and transitions to a 10dp IME gap,
  // so neither the navigation bar nor the keyboard inset is counted twice.
  const { reanimated: kbReanimated } = useKeyboardContext();
  const kbH = kbReanimated.height;
  const dockKbStyle = useAnimatedStyle(() => {
    const keyboardReveal = Math.min(1, Math.abs(kbH.value) / 48);
    return {
      bottom: 0,
      paddingBottom: bottomInset * (1 - keyboardReveal) + 10 * keyboardReveal,
      transform: [{ translateY: kbH.value }],
    };
  });
  const rootAuraPositionStyle = useAnimatedStyle(() => ({
    // Root background reaches behind the system navigation area. When the IME
    // opens, lift only the visual aura to the keyboard edge.
    bottom: -kbH.value,
  }));

  // ── Send button spring ─────────────────────────────────────────────────────
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const handleSend = async () => {
    if (!hasComposerContent || sendingRef.current) return;
    sendingRef.current = true;
    try {
    const body = inputText.trim();
    const attachmentsNow = pendingAttachments;
    if (voice.enabled) await voice.exit();
    let verifiedAttachments = attachmentsNow;
    try {
      verifiedAttachments = attachmentsNow.map((attachment) => {
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
    sendMessage(body, verifiedAttachments);
    scrollToLatest();
    setInputText("");
    setPendingAttachments([]);
    inputHeightSV.value = withTiming(MIN_INPUT_H, { duration: 160 });
    setScrollEnabled(false);
    } finally {
      sendingRef.current = false;
    }
  };

  useEffect(() => {
    if (currentMessages[0]?.id && nearLatestRef.current) scrollToLatest();
  }, [currentMessages[0]?.id, scrollToLatest]);

  useEffect(() => {
    nearLatestRef.current = true;
    scrollToLatest(false);
  }, [currentConversation?.id, scrollToLatest]);

  // ── Panel — multimodal AI toolbox ──────────────────────────────────────────

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

  // ── Adaptive height ──────────────────────────────────────────────────────────
  const HEIGHT_ANIM = { duration: 160 } as const;
  useEffect(() => {
    if (inputText.length === 0) {
      inputHeightSV.value = withTiming(MIN_INPUT_H, { duration: 160 });
      setScrollEnabled(false);
    }
  }, [inputText, inputHeightSV]);

  const onContentSizeChange = (e: { nativeEvent: { contentSize: { height: number } } }) => {
    // Web may report the previous controlled height after clearing the field.
    const h = inputText.length === 0 ? MIN_INPUT_H : e.nativeEvent.contentSize.height;
    const clamped = Math.min(Math.max(h, MIN_INPUT_H), MAX_INPUT_H);
    inputHeightSV.value = withTiming(clamped, HEIGHT_ANIM);
    setScrollEnabled(h > MAX_INPUT_H);
  };

  const voiceActive = voice.phase === "listening" || voice.phase === "thinking";
  const voiceStageEnabled = voice.enabled && voice.mode === "conversation";
  const voiceOrbOnly = voiceStageEnabled && voiceView === "orb";
  const voiceSwipeEnabled = voiceStageEnabled && !menuVisible && !panelOpen
    && !moreOpen && !secretModal && !exitSecretModal && !expandedOpen;
  const voiceSwipeResponder = useMemo(() => {
    let startProgress = 0;
    let cancelled = false;
    const settle = (view: "chat" | "orb") => {
      setVoiceView(view);
      voiceViewProgress.value = withTiming(view === "orb" ? 1 : 0, {
        duration: 220, easing: Easing.out(Easing.cubic),
      });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy, numberActiveTouches }) =>
        voiceSwipeEnabled && numberActiveTouches === 1
        && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.8,
      onPanResponderGrant: () => {
        cancelled = false;
        startProgress = voiceViewProgress.value;
        voiceViewProgress.value = startProgress;
      },
      onPanResponderMove: (_, { dx, dy, numberActiveTouches }) => {
        if (numberActiveTouches !== 1) cancelled = true;
        if (!cancelled && Math.abs(dy) > Math.abs(dx) * 1.8) {
          voiceViewProgress.value = Math.max(0, Math.min(1, startProgress - dy / 140));
        }
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        if (!cancelled && Math.abs(dy) >= 48 && Math.abs(dy) > Math.abs(dx) * 1.8) {
          settle(dy < 0 ? "orb" : "chat");
        } else {
          settle(voiceView);
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => settle(voiceView),
    });
  }, [voiceSwipeEnabled, voiceView, voiceViewProgress]);
  useEffect(() => {
    if (!voiceStageEnabled) {
      setVoiceView("chat");
      voiceViewProgress.value = 0;
    }
  }, [voiceStageEnabled, voiceViewProgress]);
  const orbSize = Math.max(0, Math.min(
    kbVisible ? 84 : Math.min(winW * 0.52, winH * 0.24, 224),
    winW - 64,
    Math.min(winH, keyboardTop ?? winH) - topPad - 72 - composerContentHeight
      - (kbVisible ? 0 : bottomInset) - 110 - 96,
  ));
  const voiceMessagesStyle = useAnimatedStyle(() => ({
    opacity: 1 - voiceViewProgress.value,
    // Reserve the actual viewport, including while the existing orb moves
    // between layouts. Scroll-content padding alone cannot prevent overlap.
    marginBottom: voiceStageEnabled
      ? voiceLayoutBottom(
        composerContentHeight, bottomInset, stageH, kbH.value,
        winH, topPad + 72, orbSize, voiceViewProgress.value,
      ).messageBottom
      : 0,
  }));
  const phaseLabel: Record<string, string> = {
    idle: voice.paused ? "Durduruldu · yeniden başlatabilirsiniz" : "Dinlemeye hazırlanıyor", listening: "Dinliyorum",
    thinking: "Düşünüyorum", speaking: "Konuşuyor",
  };
  const ink = T.isDark ? "#F2F0EC" : "#111111";
  const onRightAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasComposerContent) { void handleSend(); return; }
    if (!voice.enabled) { Keyboard.dismiss(); void voice.enter(); return; }
    exitVoice();
  };
  const dictating = voice.enabled && voice.mode === "dictation";
  const micDisabled = isTyping || voice.phase === "thinking";
  const rightLabel = hasComposerContent ? "Gönder"
    : !voice.enabled ? "Sesli konuş"
    : "Sesli sohbeti kapat";
  const RATE_OPTS = [0.75, 0.88, 1.0] as const;
  const rateLabel = (r: number) => (r <= 0.75 ? "Yavaş" : r >= 1 ? "Hızlı" : "Normal");
  const stageKbStyle = useAnimatedStyle(() => {
    const { stageBottom, stageTranslateY } = voiceLayoutBottom(
      composerContentHeight, bottomInset, stageH, kbH.value,
      winH, topPad + 72, orbSize, voiceViewProgress.value,
    );
    return {
      bottom: stageBottom,
      transform: [{ translateY: stageTranslateY }],
    };
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const weatherRowData = !voiceStageEnabled && weather.live && weather.atmosphereData &&
    Number.isFinite(weather.atmosphereData.temperature) ? weather.atmosphereData : null;
  return (
    <View
      style={[ss.root, { backgroundColor: T.isDark ? T.bg : "#FAFAFB" }]}
      {...edgeSwipeResponder.panHandlers}
    >
      <WeatherExperience weather={weather} isDark={T.isDark}
        bottomInset={bottomInset}
        enabled={!voiceStageEnabled && !menuVisible} />
      <StatusBar
        style={T.isDark ? "light" : "dark"}
      />
      <Animated.View
        pointerEvents="none"
        style={[ss.composerAura, { display: "none" }, rootAuraPositionStyle, auraStyle]}
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
        style={[ss.sendLightWave, { display: "none" }, rootAuraPositionStyle, sendWaveStyle]}
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
        onLocationPicked={({ latitude, longitude }) => {
          const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
          setInputText((current) => current ? `${current}\n${locationUrl}` : locationUrl);
        }}
        bottomOffset={composerContentHeight + bottomInset}
      />
      <SideDrawer
        ref={sideMenuRef}
        visible={menuVisible}
        onOpen={openMenu}
        onClose={() => setMenuVisible(false)}
      />

      {/* ════ MESSAGES ════ */}
      <Animated.View
        style={[ss.flex, { minHeight: 0, overflow: "hidden", marginTop: weatherRowData ? topPad + 88 : 0 }, voiceMessagesStyle]}
        pointerEvents={voiceOrbOnly ? "none" : "auto"}
        accessibilityElementsHidden={voiceOrbOnly}
        importantForAccessibility={voiceOrbOnly ? "no-hide-descendants" : "auto"}
      >
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
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScroll={(event) => {
            // In an inverted list the newest end is offset zero.
            nearLatestRef.current = event.nativeEvent.contentOffset.y < 80;
          }}
          scrollEventThrottle={32}
          onContentSizeChange={() => {
            if (nearLatestRef.current) scrollToLatest(false);
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            ss.msgList,
            { paddingTop: voiceStageEnabled ? 8 : composerContentHeight + bottomInset + 4 + 8 },
          ]}
          ListFooterComponent={<View style={{ height: weatherRowData ? 8 : topPad + 72 }} />}
          ListHeaderComponent={<>
            {weather.greeting && !voiceStageEnabled && (
              <View style={{ paddingHorizontal: 24, paddingVertical: 10, flexDirection: "row", gap: 8 }}>
                <Text testID="weather-greeting" style={{ flex: 1, color: T.fgSoft, fontSize: 14, lineHeight: 21 }}>
                  {weather.greeting}
                </Text>
                <Pressable onPress={weather.dismissGreeting} hitSlop={10}
                  testID="weather-greeting-dismiss" accessibilityRole="button" accessibilityLabel="Karşılamayı kapat">
                  <Feather name="x" size={15} color={T.fgSoft} />
                </Pressable>
              </View>
            )}
            {isTyping ? (
            imagePending ? (
              <ImageGenCard />
            ) : (
              <ThinkingCard label={
                visionPending ? t("chat.visionPending") : "AkılCEP yazıyor…"
              } />
            )
          ) : null}
          </>}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />


      </KeyboardAvoidingView>
      </Animated.View>

      {/* ════ TOP OVERLAY ════ */}
      <LinearGradient
        pointerEvents="none"
        colors={T.isDark ? VEIL_COLORS_DARK : VEIL_COLORS_LIGHT}
        locations={VEIL_STOPS}
        style={[ss.topVeil, { height: topPad + 86 }]}
      />
      <View pointerEvents="box-none" style={[ss.topOverlay, { paddingTop: topPad + 8 }]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingTop: topPad + 8, alignItems: "center" }]}>
          <View style={{ height: 42, justifyContent: "center" }}>
            <Image source={leafOnly} resizeMode="contain" style={{ width: 27, height: 27, tintColor: T.isDark ? "#FFFFFF" : "#000000" }} />
          </View>
        </View>
        <Pressable accessibilityLabel="Menü" testID="chat-menu-button" accessibilityRole="button" style={[ss.topCircle, { backgroundColor: T.isDark ? SURFACE_DARK : SURFACE_LIGHT }]} onPress={openMenu}>
          <Feather name="menu" size={20} color={T.isDark ? "#EEE" : "#1C1C1E"} />
        </Pressable>
        <View style={[ss.topCapsule, { backgroundColor: T.isDark ? SURFACE_DARK : "rgba(245,245,247,0.94)" }]}>
          <Pressable accessibilityLabel="Yeni sohbet" testID="chat-new-button" accessibilityRole="button" style={ss.topCapBtn} onPress={beginNewConversation}>
            <Feather name="edit" size={20} color={T.isDark ? "#EEE" : "#1C1C1E"} />
          </Pressable>
          <View pointerEvents="none" style={[ss.topCapDivider, { backgroundColor: T.isDark ? "rgba(255,255,255,0.18)" : "#DADADD" }]} />
          <Pressable accessibilityLabel="Daha fazla" testID="chat-more-button" accessibilityRole="button" style={ss.topCapBtn} onPress={() => setMoreOpen((v) => !v)}>
            <Feather name="more-vertical" size={20} color={T.isDark ? "#EEE" : "#1C1C1E"} />
          </Pressable>
        </View>
      </View>
      {weatherRowData && (
        <View testID="chat-weather-indicator" pointerEvents="none" accessible accessibilityRole="text"
          accessibilityLabel={`${weatherRowData.description ?? HEADER_WEATHER[weatherRowData.kind].label}, ${Math.round(weatherRowData.temperature)} derece Celsius`}
          style={[ss.topWeather, { top: topPad + 62 }]}>
          <Feather name={weatherRowData.kind === "sun" && !weatherRowData.isDay ? "moon" : HEADER_WEATHER[weatherRowData.kind].icon}
            size={14} color={T.isDark ? WEATHER_BLUE.dark : WEATHER_BLUE.light} accessible={false} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[ss.topWeatherDegree, { color: T.fgSoft }]}>
            <Text style={{ color: T.isDark ? WEATHER_BLUE.dark : WEATHER_BLUE.light }}>{Math.round(weatherRowData.temperature)}°</Text>
            {" · "}{weatherRowData.description ?? HEADER_WEATHER[weatherRowData.kind].label}
          </Text>
        </View>
      )}
      {moreOpen && (
        <>
          <Pressable accessibilityLabel="Menüyü kapat" style={[StyleSheet.absoluteFill, { zIndex: 180 }]} onPress={() => setMoreOpen(false)} />
          <View style={[ss.morePop, { top: topPad + 60, backgroundColor: T.isDark ? "#2A2A2C" : "#FFFFFF" }]}>
            {([
              ["edit", t("chat.newChat"), "chat-more-new", beginNewConversation],
              ["lock", t("chat.secretModal.title"), "chat-more-secret", () => setSecretModal(true)],
              ["menu", "Menü", "chat-more-drawer", openMenu],
              ["cloud", "Hava atmosferi", "chat-more-weather", weather.openCity],
            ] as const).map(([icon, label, id, fn]) => (
              <Pressable key={id} testID={id} accessibilityLabel={label} accessibilityRole="button" style={ss.moreItem} onPress={() => { setMoreOpen(false); fn(); }}>
                <Feather name={icon} size={17} color={T.isDark ? "#EEE" : "#1C1C1E"} />
                <Text style={{ color: T.isDark ? "#EEE" : "#1C1C1E", fontSize: 15, fontFamily: "Inter_400Regular" }}>{label}</Text>
              </Pressable>
            ))}
            <Pressable testID="chat-rain-sound" accessibilityRole="switch"
              accessibilityState={{ checked: rainSound.enabled }} accessibilityLabel="Yağmur sesi"
              style={ss.moreItem} onPress={rainSound.toggle}>
              <Feather name={rainSound.enabled ? "volume-2" : "volume-x"} size={17} color={T.isDark ? "#EEE" : "#1C1C1E"} />
              <Text style={{ color: T.isDark ? "#EEE" : "#1C1C1E", fontSize: 15, fontFamily: "Inter_400Regular" }}>
                {rainSound.failed ? "Yağmur sesi kullanılamıyor" : `Yağmur sesi: ${rainSound.enabled ? "açık" : "kapalı"}`}
              </Text>
            </Pressable>
            {voice.available && (
              <>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: voice.voiceReplyEnabled }} accessibilityLabel="Sesli yanıt" style={ss.moreItem} onPress={() => voice.setVoiceReplyEnabled(!voice.voiceReplyEnabled)}>
                  <Feather name={voice.voiceReplyEnabled ? "volume-2" : "volume-x"} size={17} color={T.isDark ? "#EEE" : "#1C1C1E"} />
                  <Text style={{ color: T.isDark ? "#EEE" : "#1C1C1E", fontSize: 15, fontFamily: "Inter_400Regular" }}>{voice.voiceReplyEnabled ? "Sesli yanıt: açık" : "Sesli yanıt: kapalı"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Konuşma hızı" style={ss.moreItem} onPress={() => {
                  const k = RATE_OPTS.findIndex((r) => r === voice.speechRate);
                  voice.setSpeechRate(RATE_OPTS[(k + 1) % RATE_OPTS.length]);
                }}>
                  <Feather name="sliders" size={17} color={T.isDark ? "#EEE" : "#1C1C1E"} />
                  <Text style={{ color: T.isDark ? "#EEE" : "#1C1C1E", fontSize: 15, fontFamily: "Inter_400Regular" }}>{`Konuşma hızı: ${rateLabel(voice.speechRate)}`}</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      )}

      {/* Only the non-interactive middle area owns mode gestures. The list,
          header and composer keep their existing responders. */}
      {voiceOrbOnly && (
        <View
          testID="voice-orb-swipe-area"
          style={{ position: "absolute", top: topPad + 72, left: 0, right: 0,
            bottom: composerContentHeight + bottomInset + 8, zIndex: 19 }}
          {...voiceSwipeResponder.panHandlers}
        />
      )}
      {voiceStageEnabled && (
        <Animated.View
          pointerEvents="box-none"
          onLayout={(e) => setStageH(e.nativeEvent.layout.height)}
          testID="voice-orb-stage"
          style={[{ position: "absolute", left: 0, right: 0, alignItems: "center", paddingTop: 8, paddingBottom: 6, paddingHorizontal: 28, minWidth: 0, zIndex: 20, backgroundColor: "transparent" }, stageKbStyle]}
        >
          <View
            testID="voice-orb-gesture"
            {...voiceSwipeResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={voiceOrbOnly ? "Orb görünümü" : "Sesli sohbet görünümü"}
            accessibilityHint="Orb görünümü için yukarı, sohbet görünümü için aşağı kaydırın."
            accessibilityActions={[
              { name: "increment", label: "Orb görünümünü aç" },
              { name: "decrement", label: "Sohbet görünümünü aç" },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              const view = nativeEvent.actionName === "increment" ? "orb" : "chat";
              setVoiceView(view);
              voiceViewProgress.value = withTiming(view === "orb" ? 1 : 0, { duration: 220 });
            }}
          >
            {orbSize > 0 && <EarthOrb size={orbSize} phase={voice.phase} active={isSpeaking && !menuVisible && !panelOpen} />}
          </View>
          <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ alignItems: "center", marginTop: 6, maxWidth: "100%" }}>
            <Text style={{ fontSize: 13, color: T.isDark ? "#A8A8AD" : "#6B7078", fontFamily: "Inter_400Regular", textAlign: "center" }}>{voice.available ? phaseLabel[voice.phase] : "Mikrofonla sesli sohbet yalnızca mobil cihazlarda çalışır."}</Text>
            {!!voice.userText && !kbVisible && <Text accessibilityElementsHidden={voiceOrbOnly} importantForAccessibility={voiceOrbOnly ? "no-hide-descendants" : "auto"} numberOfLines={2} style={{ opacity: voiceOrbOnly ? 0 : 1, marginTop: 4, fontSize: 14, color: ink, fontFamily: "Inter_400Regular", textAlign: "center" }}>{voice.userText}</Text>}
          </View>
        </Animated.View>
      )}

      {/* ════ FLOATING DOCK — absolute, floats over content, tracks keyboard ════ */}
      <Animated.View
        style={[ss.inputOuter, dockKbStyle]}
      >
        <LinearGradient
          testID="chat-composer-veil"
          pointerEvents="none"
          colors={T.isDark ? VEIL_COLORS_DARK : VEIL_COLORS_LIGHT}
          locations={VEIL_STOPS}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={ss.composerVeil}
        />
        <View
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            setComposerContentHeight((currentHeight) =>
              Math.abs(currentHeight - nextHeight) < 0.5 ? currentHeight : nextHeight
            );
          }}
          style={[
            ss.dock,
            { backgroundColor: T.isDark ? "#2C2C2E" : "#FFFFFF" },
            pendingAttachments.length > 0 && ss.dockWithAttachments,
          ]}
        >
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
                    <View style={ss.attachmentMedia}>
                      <Image source={{ uri: attachment.uri }} style={ss.attachmentImage} resizeMode="cover" />
                      <Pressable
                        style={[
                          ss.attachmentImageRemove,
                          {
                            backgroundColor: T.isDark
                              ? "rgba(8,8,10,0.82)"
                              : "rgba(255,255,255,0.92)",
                          },
                        ]}
                        hitSlop={6}
                        onPress={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                      >
                        <Feather name="x" size={12} color={T.fg} />
                      </Pressable>
                    </View>
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
                  {attachment.kind === "file" && (
                    <Pressable
                      style={ss.attachmentRemove}
                      hitSlop={8}
                      onPress={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    >
                      <Feather name="x" size={13} color={T.fgSoft} />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={ss.composerRow}>

          {/* A — attachment action inside the shared composer capsule */}
          <Animated.View style={[ss.dockPlus, plusPressStyle]}>
            <Pressable
              style={[ss.dockPlusInner, { backgroundColor: "transparent" }]}
              accessibilityLabel="Ekle"
              testID="chat-plus-button"
              onPressIn={() => {
                restoreInputFocusRef.current = inputFocusedRef.current;
                plusScaleSV.value = withTiming(1, PRESS_IN);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onPressOut={() => { plusScaleSV.value = withTiming(0, PRESS_OUT); }}
              onPress={() => {
                exitVoice();
                setPanelOpen((current) => !current);
                if (restoreInputFocusRef.current) {
                  setTimeout(() => {
                    textInputRef.current?.focus();
                    restoreInputFocusRef.current = false;
                  }, 80);
                } else {
                  restoreInputFocusRef.current = false;
                }
              }}
              hitSlop={4}
            >
              <Animated.View style={plusRotAnim}>
                <Feather name="plus" size={22} color={ink} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* B — the same editable draft for text and voice modes */}
          <Animated.View style={[ss.underlineInput, inputFieldAnim]}>
            <View style={ss.underlineInputRow}>
              <AnimatedTextInput
                ref={textInputRef}
                accessibilityLabel="Mesaj"
                testID="chat-input"
                autoFocus={!legacyVoiceRef.current}
                style={[
                  ss.dockField,
                  inputFieldAnim,
                  {
                    color: T.isDark ? "#F2F0EC" : "#4A4A4F",
                    opacity: voiceActive ? 0.45 : 1,
                    minWidth: 0,
                  },
                ]}
                placeholder="AkılCEP’e sor"
                placeholderTextColor={T.isDark ? "rgba(255,255,255,0.36)" : "#85858A"}
                underlineColorAndroid="transparent"
                multiline
                scrollEnabled={scrollEnabled}
                value={inputText}
                onContentSizeChange={onContentSizeChange}
                onChangeText={(v) => { if (voice.enabled) exitVoice(); setInputText(v); }}
                maxLength={4000}
                returnKeyType="send"
                onSubmitEditing={() => { if (hasComposerContent) void handleSend(); }}
                editable={!voiceActive}
                onFocus={() => {
                  if (inputBlurTimerRef.current) {
                    clearTimeout(inputBlurTimerRef.current);
                    inputBlurTimerRef.current = null;
                  }
                  inputFocusedRef.current = true;
                  inputFocused.value = withTiming(1, FOCUS_DUR);
                  scrollToLatest();
                }}
                onBlur={() => {
                  inputBlurTimerRef.current = setTimeout(() => {
                    inputFocusedRef.current = false;
                    inputBlurTimerRef.current = null;
                  }, 120);
                  inputFocused.value = withTiming(0, FOCUS_DUR);
                }}
              />

            </View>
          </Animated.View>

          {voiceStageEnabled ? (
            <>
              <Pressable
                testID="voice-stop-button"
                accessibilityRole="button"
                accessibilityLabel={voice.paused ? "Sesli sohbeti yeniden başlat" : "Durdur"}
                hitSlop={4}
                style={ss.voiceCtl}
                onPress={voice.paused ? voice.action : voice.stop}
              >
                {voice.paused
                  ? <Feather name="play" size={18} color="#D93025" />
                  : <View style={ss.voiceStopSquare} />}
              </Pressable>
              <Pressable
                testID="voice-close-button"
                accessibilityRole="button"
                accessibilityLabel="Sesli sohbeti kapat"
                hitSlop={4}
                style={[ss.voiceCtl, { backgroundColor: "#D93025" }]}
                onPress={exitVoice}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
            </>
          ) : (
            <>
          {/* Dictation mic — existing voice.enter/action infrastructure */}
          <Animated.View style={micScaleStyle}>
            <Pressable
              testID="chat-dictation-button"
              accessibilityRole="button"
              accessibilityLabel={dictating ? "Dikteyi bitir" : "Sesle yaz"}
              accessibilityState={{ disabled: micDisabled }}
              disabled={micDisabled}
              hitSlop={4}
              style={[ss.voiceCtl, { backgroundColor: "transparent", opacity: micDisabled ? 0.4 : 1 }]}
              onPressIn={() => { micScaleSV.value = withTiming(0.95, { duration: 120 }); }}
              onPressOut={() => { micScaleSV.value = withTiming(1, { duration: 120 }); }}
              onPress={() => {
                if (dictating) void voice.action();
                else void voice.enter({ mode: "dictation" });
              }}
            >
              <Feather name="mic" size={20} color={ink} />
            </Pressable>
          </Animated.View>
          {/* D — live voice when empty; existing send action when a draft is present */}
          <Animated.View style={[ss.dockAiShell, sendStyle]}>
            <Pressable
              style={ss.dockAiBody}
              accessibilityRole="button"
              accessibilityLabel={rightLabel}
              accessibilityState={{ disabled: isTyping || dictating }}
              disabled={isTyping || dictating}
              testID="chat-send-voice-button"
              onPressIn={() => { sendPressGlow.value = withTiming(1, PRESS_IN); }}
              onPressOut={() => { sendPressGlow.value = withTiming(0, PRESS_OUT); }}
              onPress={onRightAction}
              hitSlop={4}
            >
              <Animated.View
                style={[StyleSheet.absoluteFill, { borderRadius: 28, backgroundColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)" }, sendPressHighlightStyle]}
                pointerEvents="none"
              />
              <View style={ss.iconCenter}>
                {hasComposerContent || (voiceStageEnabled && voice.phase !== "idle") ? (
                  <Feather name={hasComposerContent ? "arrow-up" : "square"} size={20} color="#FFFFFF" />
                ) : (
                  <View style={ss.voiceWave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {[6, 14, 18, 11, 5].map((height, index) => (
                      <View key={index} style={[ss.voiceWaveBar, { height }]} />
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
            </>
          )}

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
                exitVoice();
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
          <View style={ss.expandHeader}>
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
          <View style={[ss.expandFooter, { borderTopColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", paddingBottom: bottomInset }]}>
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
                beginNewConversation();
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root:  { flex: 1, width: "100%" },
  flex:  { flex: 1 },

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

  topOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 160,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 10,
  },
  topVeil: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 159 },
  topWeather: { position: "absolute", left: 24, right: 24, height: 20, zIndex: 160, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  topWeatherDegree: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_500Medium", fontVariant: ["tabular-nums"], includeFontPadding: false },
  topCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  topCapsule: { height: 42, borderRadius: 21, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, overflow: "hidden" },
  topCapBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  topCapDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  morePop: { position: "absolute", right: 14, zIndex: 200, borderRadius: 18, paddingVertical: 6, minWidth: 200, elevation: 6, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  moreItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },

  // Messages
  msgList: { paddingTop: 20, paddingBottom: 8 },

  // Floating dock — absolute, no background, tracks keyboard via dockKbStyle
  inputOuter: {
    position:          "absolute",
    left:              0,
    right:             0,
    zIndex:            170,
    paddingTop:        4,
    alignItems:        "center",
  },
  composerVeil: { position: "absolute", left: 0, right: 0, top: -32, bottom: 0 },
  composerAura: {
    position: "absolute",
    left: "-8%",
    right: "-8%",
    bottom: 0,
    height: 540,
  },
  sendLightWave: {
    position: "absolute",
    left: "-8%",
    right: "-8%",
    bottom: 0,
    height: 560,
  },



  // ── Floating input dock styles ────────────────────────────────────────────

  // One capsule with fixed side margins; the measured height still reserves list space.
  dock: {
    alignSelf:         "stretch",
    marginHorizontal:  12,
    minWidth:          0,
    minHeight:         46,
    paddingVertical:   1,
    paddingHorizontal: 8,
    borderRadius:      23,
    backgroundColor:   "transparent",
    boxShadow:         "0px 2px 8px rgba(0, 0, 0, 0.04)",
  },
  dockWithAttachments: {
    borderRadius:      26,
    paddingHorizontal: 10,
    paddingTop:        8,
    paddingBottom:     6,
  },
  composerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    width:         "100%",
    minWidth:      0,
  },

  // A — Small plus icon with an expanded touch target
  dockPlus: {
    width:  44,
    height: 44,
  },
  dockPlusInner: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "transparent",
    alignItems:      "center",
    justifyContent:  "center",
  },

  voiceCtl: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center",
    justifyContent: "center", backgroundColor: "rgba(0,0,0,0.06)",
  },
  voiceStopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#D93025" },

  // B — Flexible input surface inside the shared composer capsule
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
    gap: 7,
    paddingHorizontal: 0,
    paddingBottom: 4,
    paddingTop: 0,
    paddingRight: 24,
  },
  attachmentScroller: {
    width:    "100%",
    flexGrow: 0,
  },
  attachmentCard: {
    width: 195,
    minHeight: 106,
    borderRadius: 14,
    padding: 7,
    paddingRight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  attachmentMedia: {
    width: 92,
    height: 92,
    position: "relative",
  },
  attachmentImage: {
    width: 92,
    height: 92,
    borderRadius: 14,
  },
  attachmentImageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // TextInput — grows with content; all spacing via parent paddingLeft/Right
  dockField: {
    flex:              1,
    minHeight:         26,
    maxHeight:         MAX_INPUT_H,
    fontSize:          15,
    lineHeight:        20,
    fontFamily:        "Inter_400Regular",
    letterSpacing:     -0.3,
    paddingVertical:   4,
    paddingHorizontal: 0,
    borderWidth:       0,
    backgroundColor:   "transparent",
    textAlignVertical: "center",
    outlineWidth:      0,
    outlineColor:      "transparent",
    paddingLeft: 0,
    paddingRight:      0,
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
  // C — Compact send button; hitSlop expands its touch target to 44×44
  dockAiShell: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  dockAiBody: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: "#000000",
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  voiceWave: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  voiceWaveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
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
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
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
    borderTopWidth:    0,
    borderTopColor:    "transparent",
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
