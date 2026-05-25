/**
 * HomeScreen — premium AKILCEP AI home with integrated ambient Voice Mode.
 *
 * Voice flow (fully inline — no separate page):
 *   idle → [mic tap] → listening → [tap] → thinking
 *   → injectMessages() + Speech.speak() + router.push("/chat")
 *
 * The large floating logo is NEVER inside a container.
 * The voice waveform appears around a small secondary orb below center text.
 */
import { Feather } from "@expo/vector-icons";
import { Audio }   from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics  from "expo-haptics";
import { router }   from "expo-router";
import * as Speech  from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
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

import FullscreenMenu from "@/components/FullscreenMenu";
import ProfileMenu   from "@/components/ProfileMenu";
import { useChat }   from "@/context/ChatContext";
import { useTheme }  from "@/context/ThemeContext";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`;

// ── Waveform bar geometry (home orb — 6 bars per side, more ambient than chat) ─
const L_MAX = [4,  8, 14, 19, 15,  9];
const R_MAX = [9, 15, 19, 14,  8,  4];
const L_DEL = [0,  70, 140, 60, 120, 200];
const R_DEL = [120, 60,  0, 140, 70, 200];
const L_DUR = [380, 320, 360, 300, 340, 380];
const R_DUR = [340, 380, 300, 360, 320, 340];

type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const HOME_ORB_D = 82;  // smaller than VoiceOrbPanel's 88 — ambient feel
const BAR_W      = 1.8;
const BAR_GAP    = 3;
const VOICE_LAYER_H = 108; // collapsed height for the animated voice section

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { startNewConversation, injectMessages, sendMessage } = useChat();
  const { theme: T } = useTheme();

  const [inputText,    setInputText]    = useState("");
  const [sidebar,      setSidebar]      = useState(false);
  const [profileMenu,  setProfileMenu]  = useState(false);
  const [voicePhase,   setVoicePhase]   = useState<VoicePhase>("idle");

  const voicePhaseRef   = useRef<VoicePhase>("idle");
  const recordingRef    = useRef<Audio.Recording | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const voiceConvIdRef  = useRef<number>(0);
  const permGrantedRef  = useRef<boolean | null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 36 : insets.bottom;
  const hasText = inputText.trim().length > 0;

  const applyVoice = (p: VoicePhase) => {
    voicePhaseRef.current = p;
    setVoicePhase(p);
  };

  // ── Shared values — logo ────────────────────────────────────────────────────
  const logoScale      = useSharedValue(1);
  const logoOp         = useSharedValue(T.isDark ? 0.62 : 0.68);
  const logoGlowBoost  = useSharedValue(0);   // 0 = base, 1 = fully boosted

  // ── Shared values — mini voice orb ─────────────────────────────────────────
  const orbScale   = useSharedValue(1);
  const orbGlowOp  = useSharedValue(0);

  // ── Shared values — voice layer entry/exit ─────────────────────────────────
  const voiceLayerOp = useSharedValue(0);
  const voiceLayerH  = useSharedValue(0);

  // ── Shared values — waveform bars (6 left + 6 right) ───────────────────────
  const lH0 = useSharedValue(2);
  const lH1 = useSharedValue(2);
  const lH2 = useSharedValue(2);
  const lH3 = useSharedValue(2);
  const lH4 = useSharedValue(2);
  const lH5 = useSharedValue(2);
  const leftBars = [lH0, lH1, lH2, lH3, lH4, lH5] as const;

  const rH0 = useSharedValue(2);
  const rH1 = useSharedValue(2);
  const rH2 = useSharedValue(2);
  const rH3 = useSharedValue(2);
  const rH4 = useSharedValue(2);
  const rH5 = useSharedValue(2);
  const rightBars = [rH0, rH1, rH2, rH3, rH4, rH5] as const;

  // ── Logo breathing — always on ──────────────────────────────────────────────
  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
    logoOp.value = withRepeat(
      withSequence(
        withTiming(T.isDark ? 0.72 : 0.78, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(T.isDark ? 0.55 : 0.60, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, [T.isDark]);

  // ── Voice layer + waveform animation ───────────────────────────────────────
  useEffect(() => {
    const active = voicePhase !== "idle";

    // Logo glow boost when voice is active
    logoGlowBoost.value = withTiming(active ? 1 : 0, { duration: 700 });

    // Voice layer slide-in / collapse
    voiceLayerOp.value = withTiming(active ? 1 : 0, {
      duration: active ? 420 : 300,
      easing:   Easing.out(Easing.ease),
    });
    voiceLayerH.value = withTiming(active ? VOICE_LAYER_H : 0, {
      duration: active ? 400 : 280,
      easing:   Easing.out(Easing.ease),
    });

    if (!active) {
      [...leftBars, ...rightBars].forEach((v) => {
        v.value = withTiming(2, { duration: 280 });
      });
      orbScale.value  = withTiming(1,   { duration: 280 });
      orbGlowOp.value = withTiming(0,   { duration: 280 });
      return;
    }

    // Mini orb breathing
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.022, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );

    // Orb glow per phase
    orbGlowOp.value = withTiming(
      voicePhase === "speaking"  ? 0.24 :
      voicePhase === "listening" ? 0.15 :
      0.08,  // thinking
      { duration: 600 }
    );

    // Waveform bars per phase
    const scaleFactor =
      voicePhase === "thinking"  ? 0.18 :
      voicePhase === "listening" ? 0.62 :
      0.85;  // speaking

    const minFraction =
      voicePhase === "thinking"  ? 0.20 :
      voicePhase === "listening" ? 0.25 :
      0.12;

    const animBar = (
      bars: readonly typeof lH0[],
      maxH: number[],
      delays: number[],
      durs: number[],
    ) => {
      bars.forEach((bar, i) => {
        const max = (maxH[i]!) * scaleFactor;
        const min = Math.max(2, max * minFraction);
        bar.value = withDelay(
          delays[i]!,
          withRepeat(
            withSequence(
              withTiming(max, { duration: durs[i]!, easing: Easing.inOut(Easing.sin) }),
              withTiming(min, { duration: durs[i]!, easing: Easing.inOut(Easing.sin) }),
            ),
            -1, true
          )
        );
      });
    };

    animBar(leftBars,  L_MAX, L_DEL, L_DUR);
    animBar(rightBars, R_MAX, R_DEL, R_DUR);
  }, [voicePhase]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      safeStop();
      try { Speech.stop(); } catch {}
    };
  }, []);

  // ── Voice helpers ───────────────────────────────────────────────────────────
  const ensurePermission = async (): Promise<boolean> => {
    if (permGrantedRef.current === true) return true;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      permGrantedRef.current = granted;
      if (!granted) Alert.alert("Mikrofon İzni", "Sesli mod için mikrofon izni gereklidir.", [{ text: "Tamam" }]);
      return granted;
    } catch { return false; }
  };

  const ensureVoiceConv = async (): Promise<number> => {
    if (voiceConvIdRef.current > 0) return voiceConvIdRef.current;
    try {
      const res = await fetch(`${API_BASE}/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sesli Sohbet" }),
      });
      if (res.ok) {
        const d = await res.json() as { id: number };
        voiceConvIdRef.current = d.id;
        return d.id;
      }
    } catch {}
    return 0;
  };

  const safeStop = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try { await rec.stopAndUnloadAsync(); } catch {}
  };

  const handleMicPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const p = voicePhaseRef.current;

    if (Platform.OS === "web") {
      Alert.alert("Sesli Mod", "Sesli mod yalnızca mobil cihazlarda çalışır.");
      return;
    }

    if (p === "idle") {
      const ok = await ensurePermission();
      if (!ok) return;
      await startListening();
    } else if (p === "listening") {
      await stopAndProcess();
    } else {
      // Cancel
      abortRef.current?.abort();
      try { Speech.stop(); } catch {}
      await safeStop();
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }); } catch {}
      applyVoice("idle");
    }
  };

  const startListening = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY, undefined, 100
      );
      recordingRef.current = recording;
      applyVoice("listening");
    } catch (err) {
      console.warn("[home voice] startListening:", err);
      Alert.alert("Kayıt Hatası", "Mikrofon başlatılamadı.");
    }
  };

  const stopAndProcess = async () => {
    applyVoice("thinking");
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) { applyVoice("idle"); return; }

    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      const uri = rec.getURI();
      if (!uri) { applyVoice("idle"); return; }

      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      } catch {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        base64 = await blobToBase64(blob);
      }

      const convId = await ensureVoiceConv();
      if (convId === 0) { applyVoice("idle"); return; }

      const abort = new AbortController();
      abortRef.current = abort;

      const res = await fetch(`${API_BASE}/openai/conversations/${convId}/voice-messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abort.signal,
        body:    JSON.stringify({ audio: base64 }),
      });

      if (abort.signal.aborted) return;

      if (!res.ok) { applyVoice("idle"); return; }

      const data = await res.json() as { userText?: string; assistantText?: string };
      if (abort.signal.aborted) return;

      const userText = data.userText?.trim()      ?? "";
      const aiText   = data.assistantText?.trim() ?? "";

      if (!aiText) { applyVoice("idle"); return; }

      // Add messages to chat context and navigate immediately
      startNewConversation();
      injectMessages(userText, aiText);

      // Start speaking — plays while user lands on chat screen
      applyVoice("speaking");
      Speech.speak(aiText, {
        language: "tr-TR",
        rate:     0.88,
        onDone:    () => { void restoreAudio().then(() => router.push("/chat")); },
        onStopped: () => { void restoreAudio(); },
        onError:   () => { void restoreAudio().then(() => applyVoice("idle")); },
      });
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") return;
      console.warn("[home voice] stopAndProcess:", err);
      applyVoice("idle");
    }
  };

  const restoreAudio = async () => {
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }); } catch {}
  };

  // ── Text send ───────────────────────────────────────────────────────────────
  const handleSend = () => {
    const msg = inputText.trim();
    if (!msg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    sendMessage(msg);
    setInputText("");
    router.push("/chat");
  };

  // ── Animated styles ─────────────────────────────────────────────────────────
  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity:   logoOp.value,
  }));

  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + logoGlowBoost.value * 0.35,
    transform: [{ scale: 1 + logoGlowBoost.value * 0.08 }],
  }));

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const orbGlowStyle = useAnimatedStyle(() => ({
    opacity: orbGlowOp.value,
  }));

  const voiceLayerStyle = useAnimatedStyle(() => ({
    opacity:  voiceLayerOp.value,
    height:   voiceLayerH.value,
    overflow: "hidden",
  }));

  // Per-bar animated styles
  const lS0 = useAnimatedStyle(() => ({ height: lH0.value }));
  const lS1 = useAnimatedStyle(() => ({ height: lH1.value }));
  const lS2 = useAnimatedStyle(() => ({ height: lH2.value }));
  const lS3 = useAnimatedStyle(() => ({ height: lH3.value }));
  const lS4 = useAnimatedStyle(() => ({ height: lH4.value }));
  const lS5 = useAnimatedStyle(() => ({ height: lH5.value }));
  const lStyles = [lS0, lS1, lS2, lS3, lS4, lS5];

  const rS0 = useAnimatedStyle(() => ({ height: rH0.value }));
  const rS1 = useAnimatedStyle(() => ({ height: rH1.value }));
  const rS2 = useAnimatedStyle(() => ({ height: rH2.value }));
  const rS3 = useAnimatedStyle(() => ({ height: rH3.value }));
  const rS4 = useAnimatedStyle(() => ({ height: rH4.value }));
  const rS5 = useAnimatedStyle(() => ({ height: rH5.value }));
  const rStyles = [rS0, rS1, rS2, rS3, rS4, rS5];

  // ── Colour tokens ───────────────────────────────────────────────────────────
  const barColor    = T.isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.14)";
  const orbBg       = T.isDark ? "rgba(38,38,38,0.97)"   : "rgba(244,244,241,0.98)";
  const orbGlowClr  = T.isDark ? "rgba(255,255,255,1)"   : "rgba(210,210,205,1)";
  const logoTint    = T.isDark ? "rgba(200,200,200,0.70)" : "rgba(100,100,96,0.72)";
  const logoGlowBg  = T.isDark ? "rgba(255,255,255,0.03)" : "rgba(248,244,236,0.80)";
  const pillBg      = T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const pillText    = T.isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.38)";
  const inputBg     = T.isDark ? "rgba(255,255,255,0.06)" : T.card;
  const inputBorder = T.isDark ? StyleSheet.hairlineWidth  : 0;
  const inputBorderC= T.isDark ? "rgba(255,255,255,0.09)"  : "transparent";
  const attachClr   = T.isDark ? "rgba(255,255,255,0.35)"  : T.fg;

  // Mic icon color changes per phase
  const micColor =
    voicePhase === "listening" ? (T.isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.75)") :
    voicePhase === "speaking"  ? (T.isDark ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.50)") :
    voicePhase === "thinking"  ? (T.isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.32)") :
    attachClr;

  const micIcon: React.ComponentProps<typeof Feather>["name"] =
    voicePhase === "listening" ? "square" :
    voicePhase === "speaking"  ? "volume-2" :
    "mic";

  const statusText =
    voicePhase === "listening" ? "d i n l i y o r u m" :
    voicePhase === "thinking"  ? "d ü ş ü n ü y o r …" :
    voicePhase === "speaking"  ? "y a n ı t l ı y o r …" :
    "";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>

      {/* ════ HEADER ════ */}
      <View style={[ss.header, { paddingTop: topPad + 10 }]}>

        <TouchableOpacity
          style={[ss.iconBtn, { backgroundColor: T.card, shadowColor: T.isDark ? "transparent" : "#9A9A9A" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSidebar(true); }}
          hitSlop={14} activeOpacity={0.65}
        >
          <Feather name="menu" size={16} color={T.fg} />
        </TouchableOpacity>

        {/* Two-line brand center */}
        <View style={ss.brandCenter}>
          <Text style={[ss.brandName, { color: T.fg }]}>A K I L C E P</Text>
          <Text style={[ss.brandSub,  { color: T.zinc }]}>C E B İ N D E K İ  A K I L</Text>
        </View>

        <TouchableOpacity
          style={ss.avatarWrap}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setProfileMenu(true); }}
          hitSlop={14} activeOpacity={0.80}
        >
          <Image source={avatar} style={[ss.avatarImg, { borderColor: T.card }]} />
          <View style={[ss.onlineDot, { backgroundColor: T.onlineDot, borderColor: T.bg }]} />
        </TouchableOpacity>

      </View>

      {/* ════ CENTER CONTENT ════ */}
      <View style={ss.center}>

        {/* Logo + ambient glow cloud — wrapped so glow centers behind logo */}
        <Animated.View style={[ss.logoWrap, logoAnimStyle]}>
          {/* Soft glow cloud — wide diffuse circle, NOT a card/tile */}
          <Animated.View
            pointerEvents="none"
            style={[ss.logoGlowCloud, { backgroundColor: logoGlowBg }, logoGlowStyle]}
          />
          {/* The logo itself — free-floating, no container shape */}
          <Image
            source={leafLogo}
            style={ss.logoImage}
            tintColor={logoTint}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand wordmark */}
        <Text style={[ss.wordmark, { color: T.fg }]}>A K I L C E P</Text>

        {/* Subtitle — fades slightly when voice active */}
        <Text
          style={[
            ss.subtitle,
            { color: T.zinc, opacity: voicePhase !== "idle" ? 0.40 : 1 },
          ]}
        >
          size nasıl yardımcı olabilirim?
        </Text>

        {/* ════ INLINE VOICE LAYER ════ */}
        <Animated.View style={[ss.voiceLayer, voiceLayerStyle]} pointerEvents="none">

          {/* Status pill badge */}
          <View style={[ss.statusPill, { backgroundColor: pillBg }]}>
            <Text style={[ss.statusText, { color: pillText }]}>{statusText}</Text>
          </View>

          {/* Mini orb + waveforms */}
          <View style={ss.orbRow}>

            {/* Left bars */}
            <View style={ss.barWing}>
              {lStyles.map((style, i) => (
                <Animated.View
                  key={`l${i}`}
                  style={[ss.bar, { backgroundColor: barColor }, style]}
                />
              ))}
            </View>

            {/* Mini orb — pure circle, logo inside, no square */}
            <Animated.View style={[ss.orbWrap, orbAnimStyle]}>
              <Animated.View style={[ss.orbGlow, { backgroundColor: orbGlowClr }, orbGlowStyle]} />
              <View style={[ss.orbMid, { backgroundColor: orbBg }]} />
              <View style={[ss.orb, { backgroundColor: orbBg }]}>
                <Image
                  source={leafLogo}
                  style={[ss.orbLogo, { tintColor: T.isDark ? "#BBBBBB" : "#9A9A94" }]}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Right bars */}
            <View style={[ss.barWing, ss.barWingRight]}>
              {rStyles.map((style, i) => (
                <Animated.View
                  key={`r${i}`}
                  style={[ss.bar, { backgroundColor: barColor }, style]}
                />
              ))}
            </View>

          </View>

          {/* Tiny vertical indicator below orb */}
          <View style={[ss.vBar, { backgroundColor: barColor }]} />

        </Animated.View>

      </View>

      {/* ════ INPUT BAR ════ */}
      <View style={[ss.inputWrap, { paddingBottom: btmPad + 16 }]}>
        <View style={[
          ss.inputBar,
          {
            backgroundColor: inputBg,
            borderColor:      inputBorderC,
            borderWidth:      inputBorder,
            shadowOpacity:    T.isDark ? 0 : 0.07,
          },
        ]}>

          <TouchableOpacity
            style={ss.inputIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startNewConversation();
              router.push("/chat");
            }}
            hitSlop={10} activeOpacity={0.65}
          >
            <Feather name="plus" size={18} color={attachClr} />
          </TouchableOpacity>

          <TextInput
            style={[ss.textInput, { color: T.fg }]}
            placeholder="AkılCEP'e bir şey sor…"
            placeholderTextColor={T.zinc}
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={voicePhase === "idle"}
          />

          {/* Mic — always visible, transforms per phase */}
          <TouchableOpacity
            style={[ss.inputIconBtn, { opacity: hasText ? 0 : 1 }]}
            onPress={handleMicPress}
            hitSlop={10} activeOpacity={0.65}
          >
            <Feather name={micIcon} size={17} color={micColor} />
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[
              ss.sendBtn,
              { backgroundColor: hasText ? T.primary : T.accent, opacity: hasText ? 1 : 0.42 },
            ]}
            onPress={handleSend}
            disabled={!hasText}
            hitSlop={10} activeOpacity={0.75}
          >
            <Feather name="arrow-up" size={16} color={hasText ? T.primaryForeground : T.muted} />
          </TouchableOpacity>

        </View>
      </View>

      <FullscreenMenu visible={sidebar}     onClose={() => setSidebar(false)} />
      <ProfileMenu   visible={profileMenu}  onClose={() => setProfileMenu(false)} />
    </View>
  );
}

// ── Blob → base64 fallback ────────────────────────────────────────────────────
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

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingBottom:     14,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation:    4,
  },
  brandCenter: { flex: 1, alignItems: "center", gap: 2 },
  brandName: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    letterSpacing: 5,
  },
  brandSub: {
    fontSize:      9,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 2.4,
  },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 4,
  },
  avatarImg: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
  },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6, borderWidth: 2,
  },

  // Center section
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            14,
  },

  // Wrapper centers the glow behind the logo — no visible border or shape
  logoWrap: {
    width:          200,
    height:         200,
    alignItems:     "center",
    justifyContent: "center",
  },
  // Ambient glow — large diffuse blob, NOT a card or container
  logoGlowCloud: {
    position:     "absolute",
    width:        270,
    height:       270,
    borderRadius: 135,
  },
  // Large floating logo — free, no background, no border
  logoImage: {
    width:  148,
    height: 148,
  },

  wordmark: {
    fontSize:      18,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 8,
  },
  subtitle: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.4,
    textAlign:     "center",
  },

  // Inline voice layer — animates height from 0 to VOICE_LAYER_H
  voiceLayer: {
    width:          "100%",
    alignItems:     "center",
    gap:            10,
    paddingTop:     2,
  },

  // Status pill badge
  statusPill: {
    paddingHorizontal: 18,
    paddingVertical:   7,
    borderRadius:      20,
  },
  statusText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      11,
    letterSpacing: 1.4,
  },

  // Mini orb row
  orbRow: {
    flexDirection:     "row",
    alignItems:        "center",
    width:             "100%",
    paddingHorizontal: 24,
  },

  barWing: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "flex-end",
    gap:            BAR_GAP,
    paddingRight:   10,
  },
  barWingRight: {
    justifyContent: "flex-start",
    paddingRight:   0,
    paddingLeft:    10,
  },
  bar: {
    width:        BAR_W,
    borderRadius: BAR_W / 2,
    alignSelf:    "center",
    minHeight:    2,
  },

  // Mini orb — strictly circular, three nested rings
  orbWrap: {
    width:          HOME_ORB_D + 26,
    height:         HOME_ORB_D + 26,
    alignItems:     "center",
    justifyContent: "center",
  },
  orbGlow: {
    position:     "absolute",
    width:        HOME_ORB_D + 26,
    height:       HOME_ORB_D + 26,
    borderRadius: (HOME_ORB_D + 26) / 2,
  },
  orbMid: {
    position:     "absolute",
    width:        HOME_ORB_D + 8,
    height:       HOME_ORB_D + 8,
    borderRadius: (HOME_ORB_D + 8) / 2,
    opacity:      0.38,
  },
  orb: {
    width:          HOME_ORB_D,
    height:         HOME_ORB_D,
    borderRadius:   HOME_ORB_D / 2,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.055,
    shadowRadius:   12,
    elevation:      5,
  },
  orbLogo: { width: 38, height: 38 },

  // Thin vertical indicator
  vBar: {
    width:        1,
    height:       18,
    borderRadius: 1,
    opacity:      0.30,
  },

  // Input bar
  inputWrap:    { paddingHorizontal: 18 },
  inputBar: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      60,
    paddingVertical:   8,
    paddingHorizontal: 8,
    gap:               2,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 5 },
    shadowRadius:      20,
    elevation:         7,
  },
  inputIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  textInput: {
    flex:              1,
    fontSize:          15,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 4,
    paddingVertical:   6,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
});
