/**
 * Home — the Globe IS the AI.
 * Full-screen cinematic Earth with minimal glassmorphic chrome overlay.
 * Apple-level premium: strong type hierarchy, clean spacing, no excess glow.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CinematicEarth from "@/components/CinematicEarth";
import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";

type VoiceState = "idle" | "listening" | "speaking";

export default function HomeScreen() {
  const insets        = useSafeAreaInsets();
  const { startNewConversation } = useChat();
  const [voice, setVoice]       = useState<VoiceState>("idle");
  const [sidebar, setSidebar]   = useState(false);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 36 : insets.bottom;

  // ── Live indicator (header right) ──────────────────────────────────────────
  const dotScale   = useSharedValue(1);
  const dotOpacity = useSharedValue(0.30);

  // ── 7 waveform bar heights (0‥1) — must be declared at top level ───────────
  const b0 = useSharedValue(0.10);
  const b1 = useSharedValue(0.10);
  const b2 = useSharedValue(0.10);
  const b3 = useSharedValue(0.10);
  const b4 = useSharedValue(0.10);
  const b5 = useSharedValue(0.10);
  const b6 = useSharedValue(0.10);

  // Animated styles for bars — all declared unconditionally at top level
  const s0 = useAnimatedStyle(() => ({ height: Math.max(2, b0.value * 12) }));
  const s1 = useAnimatedStyle(() => ({ height: Math.max(2, b1.value * 17) }));
  const s2 = useAnimatedStyle(() => ({ height: Math.max(2, b2.value * 22) }));
  const s3 = useAnimatedStyle(() => ({ height: Math.max(2, b3.value * 26) }));
  const s4 = useAnimatedStyle(() => ({ height: Math.max(2, b4.value * 22) }));
  const s5 = useAnimatedStyle(() => ({ height: Math.max(2, b5.value * 17) }));
  const s6 = useAnimatedStyle(() => ({ height: Math.max(2, b6.value * 12) }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity:   dotOpacity.value,
  }));

  // ── Drive all animations from voice state ───────────────────────────────────
  useEffect(() => {
    // Indicator dot
    if (voice === "listening") {
      dotScale.value   = withRepeat(withSequence(withTiming(1.65,{duration:760}), withTiming(1,{duration:760})), -1, true);
      dotOpacity.value = withRepeat(withSequence(withTiming(0.95,{duration:760}), withTiming(0.25,{duration:760})), -1, true);
    } else if (voice === "speaking") {
      dotScale.value   = withRepeat(withSequence(withTiming(1.35,{duration:360}), withTiming(0.88,{duration:360})), -1, true);
      dotOpacity.value = withTiming(0.88, { duration: 300 });
    } else {
      dotScale.value   = withTiming(1,    { duration: 500 });
      dotOpacity.value = withTiming(0.30, { duration: 500 });
    }

    // Waveform bars
    const vals = [b0, b1, b2, b3, b4, b5, b6];
    const dur  = voice === "speaking"  ? [265, 215, 175, 150, 175, 215, 265]
               : voice === "listening" ? [500, 420, 365, 325, 365, 420, 500]
               : [2000, 1750, 1550, 1350, 1550, 1750, 2000];
    const peak = voice === "speaking"  ? [0.50, 0.70, 0.88, 1.00, 0.88, 0.70, 0.50]
               : voice === "listening" ? [0.36, 0.54, 0.72, 0.90, 0.72, 0.54, 0.36]
               : [0.16, 0.22, 0.28, 0.34, 0.28, 0.22, 0.16];
    vals.forEach((v, i) => {
      v.value = withRepeat(
        withSequence(withTiming(peak[i], { duration: dur[i] }), withTiming(0.05, { duration: dur[i] })),
        -1, true
      );
    });
  }, [voice]);

  const cycleVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoice(s => s === "idle" ? "listening" : s === "listening" ? "speaking" : "idle");
  };

  const statusText =
    voice === "listening" ? "SENİ DİNLİYORUM" :
    voice === "speaking"  ? "YANIT VERİYORUM"  :
    "KONUŞMAK İÇİN DOKUN";

  const dotColor =
    voice === "listening" ? "#4DB6FF" :
    voice === "speaking"  ? "#FFAD50" :
    "rgba(255,255,255,0.35)";

  const micBg =
    voice === "listening" ? "rgba(42,108,235,0.92)" :
    voice === "speaking"  ? "rgba(225,120,40,0.88)"  :
    "rgba(24,72,195,0.85)";

  return (
    <View style={styles.root}>

      {/* ── Globe fills the entire screen ──────────────────────────────────── */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={cycleVoice}>
        <CinematicEarth voiceState={voice} />
      </Pressable>

      {/* ── Top header (glassmorphic overlay) ──────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 4 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.glassBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSidebar(true); }}
          hitSlop={14}
        >
          <Feather name="menu" size={16} color="rgba(255,255,255,0.58)" />
        </TouchableOpacity>

        <View style={styles.brandBlock} pointerEvents="none">
          <Text style={styles.wordmark}>A K I L C E P</Text>
          <Text style={styles.tagline}>Y A P A Y   Z E K A   A S İ S T A N I N</Text>
        </View>

        <TouchableOpacity
          style={styles.glassBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/chat"); }}
          hitSlop={14}
        >
          <Animated.View style={[styles.liveDot, { backgroundColor: dotColor }, dotStyle]} />
        </TouchableOpacity>
      </View>

      {/* ── Bottom panel ───────────────────────────────────────────────────── */}
      <View style={[styles.bottomPanel, { paddingBottom: btmPad + 10 }]} pointerEvents="box-none">

        {/* Status label */}
        <Text style={[styles.statusLabel, voice !== "idle" && styles.statusActive]}>
          {statusText}
        </Text>

        {/* Waveform visualiser */}
        <View style={styles.waveRow}>
          {/* Left side dots */}
          {Array.from({ length: 14 }, (_, i) => <View key={`ld${i}`} style={styles.waveDot} />)}
          {/* Center animated bars */}
          <Animated.View style={[styles.waveBar, s0]} />
          <Animated.View style={[styles.waveBar, s1]} />
          <Animated.View style={[styles.waveBar, s2]} />
          <Animated.View style={[styles.waveBar, s3]} />
          <Animated.View style={[styles.waveBar, s4]} />
          <Animated.View style={[styles.waveBar, s5]} />
          <Animated.View style={[styles.waveBar, s6]} />
          {/* Right side dots */}
          {Array.from({ length: 14 }, (_, i) => <View key={`rd${i}`} style={styles.waveDot} />)}
        </View>

        {/* Navigation row */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startNewConversation();
              router.push("/chat");
            }}
            hitSlop={14}
          >
            <Feather name="zap" size={18} color="rgba(255,255,255,0.40)" />
            <Text style={styles.tabLabel}>Öneriler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.micBtn, { backgroundColor: micBg }]}
            onPress={cycleVoice}
            activeOpacity={0.80}
          >
            <Feather
              name={voice === "speaking" ? "volume-2" : "mic"}
              size={20}
              color="rgba(255,255,255,0.92)"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/chat"); }}
            hitSlop={14}
          >
            <Feather name="message-circle" size={18} color="rgba(255,255,255,0.40)" />
            <Text style={styles.tabLabel}>Geçmiş</Text>
          </TouchableOpacity>
        </View>

      </View>

      <Sidebar visible={sidebar} onClose={() => setSidebar(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#00000c",
  },

  // ── Header
  header: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 18,
    paddingBottom:   10,
    zIndex:          20,
  },
  glassBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.09)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  brandBlock: {
    flex:       1,
    alignItems: "center",
    gap:        3,
  },
  wordmark: {
    fontSize:    12.5,
    fontFamily:  "Inter_700Bold",
    color:       "rgba(255,255,255,0.86)",
    letterSpacing: 4.8,
  },
  tagline: {
    fontSize:    7,
    fontFamily:  "Inter_400Regular",
    color:       "rgba(255,255,255,0.30)",
    letterSpacing: 2.0,
  },
  liveDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },

  // ── Bottom
  bottomPanel: {
    position:         "absolute",
    bottom:           0,
    left:             0,
    right:            0,
    alignItems:       "center",
    paddingHorizontal: 24,
    zIndex:           20,
  },
  statusLabel: {
    fontSize:      9.5,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.24)",
    letterSpacing: 3.8,
    textTransform: "uppercase",
    marginBottom:  12,
  },
  statusActive: {
    color: "rgba(90,178,255,0.70)",
  },

  // Waveform
  waveRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
    marginBottom:  22,
    height:        28,
  },
  waveDot: {
    width:           1.5,
    height:          1.5,
    borderRadius:    1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  waveBar: {
    width:           2.5,
    borderRadius:    1.5,
    backgroundColor: "rgba(155,208,255,0.64)",
  },

  // Tabs
  tabRow: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    width:           "100%",
    paddingHorizontal: 12,
  },
  tabItem: {
    alignItems: "center",
    gap:        5,
    minWidth:   68,
  },
  tabLabel: {
    fontSize:    9,
    fontFamily:  "Inter_400Regular",
    color:       "rgba(255,255,255,0.34)",
    letterSpacing: 0.5,
  },
  micBtn: {
    width:        56,
    height:       56,
    borderRadius: 28,
    alignItems:   "center",
    justifyContent: "center",
    shadowColor:    "#1a50cc",
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.50,
    shadowRadius:   18,
    elevation:      10,
    borderWidth:    StyleSheet.hairlineWidth,
    borderColor:    "rgba(100,165,255,0.28)",
  },
});
