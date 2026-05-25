/**
 * ChatScreen — AKILCEP premium AI chat with inline Voice Mode.
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

import FullscreenMenu   from "@/components/FullscreenMenu";
import MessageBubble    from "@/components/MessageBubble";
import TypingIndicator  from "@/components/TypingIndicator";
import VoiceOrbPanel    from "@/components/VoiceOrbPanel";
import { useChat }      from "@/context/ChatContext";
import { useTheme }     from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Voice phase ────────────────────────────────────────────────────────────────
type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

export default function ChatScreen() {
  const { theme: T }   = useTheme();
  const insets          = useSafeAreaInsets();
  const {
    currentMessages,
    isTyping,
    sendMessage,
    injectMessages,
    startNewConversation,
  } = useChat();

  const [inputText,    setInputText]    = useState("");
  const [menuVisible,  setMenuVisible]  = useState(false);
  const [voicePhase,   setVoicePhase]   = useState<VoicePhase>("idle");

  const flatListRef     = useRef<FlatList>(null);
  const voicePhaseRef   = useRef<VoicePhase>("idle");
  const recordingRef    = useRef<Audio.Recording | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const voiceConvIdRef  = useRef<number>(0);
  const permGrantedRef  = useRef<boolean | null>(null); // null = unchecked

  const applyVoice = (p: VoicePhase) => {
    voicePhaseRef.current = p;
    setVoicePhase(p);
  };

  const hasText    = inputText.trim().length > 0;
  const topPad     = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad  = Platform.OS === "web" ? 34 : insets.bottom;
  const isSpeaking = voicePhase === "speaking";
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

  // ── Shared values — smart arrow button (send ↔ dark voice orb) ─────────────
  const voiceModeSV    = useSharedValue(0);  // 0 = send, 1 = voice-orb
  const arrowGlowPulse = useSharedValue(0);  // ambient pulse 0→1 in voice mode

  // Mic button glow pulse during listening
  const micGlow = useSharedValue(0);
  const micGlowStyle = useAnimatedStyle(() => ({
    opacity:   micGlow.value,
    transform: [{ scale: 1 + micGlow.value * 0.35 }],
  }));

  // Arrow animated styles — identical logic to home screen
  const arrowGlowOuterAnim = useAnimatedStyle(() => ({
    opacity: voiceModeSV.value * (0.13 + arrowGlowPulse.value * 0.20),
  }));
  const arrowGlowInnerAnim = useAnimatedStyle(() => ({
    opacity: voiceModeSV.value * (0.22 + arrowGlowPulse.value * 0.32),
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
  const headerBg     = T.isDark ? "rgba(5,5,5,0.82)"       : "rgba(246,246,243,0.82)";
  const inputBg      = T.isDark ? "rgba(255,255,255,0.055)" : "#F1F1EE";
  const sendBtnBg    = T.isDark ? "rgba(255,255,255,0.12)"  : "#E5E5E1";
  const inputTextClr = T.isDark ? T.fg                      : "#5C5C5C";
  const inputPlhClr  = T.isDark ? T.muted                   : "#9A9A9A";
  const attachClr    = T.isDark ? "rgba(255,255,255,0.32)"  : "#9A9A9A";
  const btnBg        = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.045)";
  const btnBorder    = T.isDark ? StyleSheet.hairlineWidth  : 0;
  const btnBorderClr = T.isDark ? "rgba(255,255,255,0.09)"  : "transparent";
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
      <FullscreenMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      {/* ════ WATERMARK LOGO ════ */}
      <View style={ss.logoFrame} pointerEvents="none">
        <Animated.Image
          source={leafOnly}
          style={[ss.logoImg, { tintColor: logoTint }, logoStyle]}
          resizeMode="contain"
        />
      </View>

      {/* ════ HEADER ════ */}
      <View style={[ss.header, { paddingTop: topPad + 10, backgroundColor: headerBg }]}>
        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: btnBg, borderColor: btnBorderClr, borderWidth: btnBorder }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenuVisible(true); }}
          hitSlop={12} activeOpacity={0.62}
        >
          <Feather name="menu" size={16} color={T.fgSoft} />
        </TouchableOpacity>

        <Text style={[ss.headerTitle, { color: T.fgSoft }]}>
          C E B İ N D E K İ {"  "} A K I L
        </Text>

        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: btnBg, borderColor: btnBorderClr, borderWidth: btnBorder }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); startNewConversation(); }}
          hitSlop={12} activeOpacity={0.62}
        >
          <Feather name="edit-3" size={16} color={T.fgSoft} />
        </TouchableOpacity>
      </View>

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
            />
          )}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ss.msgList}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: 12 }} />}
        />

        {/* ════ VOICE ORB PANEL — slides in above input ════ */}
        <VoiceOrbPanel phase={voicePhase} isDark={T.isDark} />

        {/* ════ INPUT AREA ════ */}
        <View style={[ss.inputOuter, { paddingBottom: bottomPad + 10 }]}>

          {/* Input row */}
          <View style={[ss.inputRow, { backgroundColor: inputBg }]}>

            {/* Attachment */}
            <TouchableOpacity style={ss.attachBtn} hitSlop={8} activeOpacity={0.60}>
              <Feather name="plus" size={18} color={attachClr} />
            </TouchableOpacity>

            {/* Text field — dims slightly during voice */}
            <TextInput
              style={[
                ss.textInput,
                { color: inputTextClr, opacity: voiceActive ? 0.45 : 1 },
              ]}
              placeholder={voiceActive ? "" : "AkılCEP'e yazın…"}
              placeholderTextColor={inputPlhClr}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!voiceActive}
            />

            {/* Right controls */}
            <View style={ss.rightRow}>

              {/* Mic — always visible; dims while typing, transforms per voice phase */}
              <View style={[ss.micWrap, { opacity: hasText ? 0.38 : 0.82 }]}>
                <Animated.View
                  style={[
                    ss.micHalo,
                    {
                      backgroundColor: T.isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.05)",
                    },
                    micGlowStyle,
                  ]}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  style={[ss.micBtn, { backgroundColor: micBg() }]}
                  onPress={handleMicPress}
                  activeOpacity={0.65}
                  hitSlop={8}
                >
                  {voicePhase === "thinking" ? (
                    <ThinkingDots
                      color={T.isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.35)"}
                      size={3.5}
                    />
                  ) : (
                    <Feather name={micIconName()} size={15} color={micIconColor()} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Smart arrow — send when typing, dark voice-orb trigger when empty */}
              <Animated.View style={[ss.sendWrap, sendStyle]}>
                {/* Outer warm amber bloom — pulses in voice mode */}
                <Animated.View style={[ss.arrowGlowOuter, arrowGlowOuterAnim]} />
                {/* Inner glow ring */}
                <Animated.View style={[ss.arrowGlowInner, arrowGlowInnerAnim]} />
                {/* Dark graphite bg — voice mode */}
                <Animated.View style={[ss.sendBtnBg, { backgroundColor: "#1A1A1A" }, arrowVoiceBgAnim]} />
                {/* Primary-color bg — send mode */}
                <Animated.View style={[ss.sendBtnBg, { backgroundColor: T.primary }, arrowSendBgAnim]} />

                <TouchableOpacity
                  style={ss.sendBtnTouch}
                  onPress={hasText ? handleSend : handleMicPress}
                  hitSlop={12} activeOpacity={0.75}
                >
                  <Animated.View style={[ss.iconCenter, arrowSendIconAnim]}>
                    <Feather name="arrow-up" size={16} color={T.primaryForeground} />
                  </Animated.View>
                  <Animated.View style={[ss.iconCenter, arrowVoiceIconAnim]}>
                    <Feather name="arrow-up" size={16} color="rgba(255,255,255,0.55)" />
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
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

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 18,
    paddingBottom:     14,
  },
  hBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.06,
    shadowRadius:   8,
  },
  headerTitle: {
    flex:              1,
    textAlign:         "center",
    fontSize:          11,
    fontFamily:        "Inter_400Regular",
    letterSpacing:     1.8,
    paddingHorizontal: 6,
  },

  // Messages
  msgList: { paddingTop: 20, paddingBottom: 8 },

  // Input area
  inputOuter: {
    paddingHorizontal: 14,
    paddingTop:        6,
  },

  // Input row
  inputRow: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    borderRadius:      28,
    paddingHorizontal: 8,
    paddingVertical:   7,
    gap:               4,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.04,
    shadowRadius:      8,
    elevation:         2,
  },
  attachBtn: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   1,
  },
  textInput: {
    flex:              1,
    fontSize:          15,
    fontFamily:        "Inter_400Regular",
    maxHeight:         130,
    paddingVertical:   8,
    paddingHorizontal: 2,
    lineHeight:        22,
  },

  // Right controls
  rightRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginBottom:  1,
  },

  // Mic
  micWrap: {
    width:          34,
    height:         34,
    alignItems:     "center",
    justifyContent: "center",
  },
  micHalo: {
    position:     "absolute",
    width:        34,
    height:       34,
    borderRadius: 17,
  },
  micBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Smart send/voice-orb button — same system as home screen
  sendWrap: {
    width: 38, height: 38,
    alignItems:     "center",
    justifyContent: "center",
  },
  arrowGlowOuter: {
    position:        "absolute",
    width:           66, height: 66, borderRadius: 33,
    backgroundColor: "rgba(200, 160, 80, 1)",
  },
  arrowGlowInner: {
    position:        "absolute",
    width:           50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(220, 175, 100, 1)",
  },
  sendBtnBg: {
    position:     "absolute",
    width:        38, height: 38, borderRadius: 19,
  },
  sendBtnTouch: {
    width: 38, height: 38, borderRadius: 19,
    alignItems:     "center",
    justifyContent: "center",
  },
  iconCenter: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
  },
});
