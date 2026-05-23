/**
 * Voice Mode — cinematic AI operating system experience.
 * Living Earth core, no microphone button, ambient interaction only.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
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
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CinematicEarth from "@/components/CinematicEarth";

const { width: W, height: H } = Dimensions.get("window");

type VoiceState = "idle" | "listening" | "speaking";

// ─── Static star positions (stable across renders) ────────────────────────────
function makeStars(n: number) {
  const stars = [];
  // Simple LCG so positions are deterministic
  let seed = 0xdeadbeef;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < n; i++) {
    stars.push({
      key: i,
      top:    rng() * H,
      left:   rng() * W,
      size:   rng() * 1.6 + 0.4,
      opacity: rng() * 0.35 + 0.06,
    });
  }
  return stars;
}

// ─── Glassmorphism control button ─────────────────────────────────────────────
function GlassBtn({
  icon, label, onPress, size = 18, danger = false,
}: {
  icon: string; label: string; onPress: () => void; size?: number; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.ctrlBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.ctrlIcon, danger && styles.ctrlIconDanger]}>
        <Feather name={icon as any} size={size} color={danger ? "#FF453A" : "rgba(255,255,255,0.82)"} />
      </View>
      <Text style={[styles.ctrlLabel, danger && { color: "rgba(255,80,70,0.85)" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 20 : insets.top;
  const btmPad   = Platform.OS === "web" ? 40 : insets.bottom;

  const [state, setState] = useState<VoiceState>("listening");
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const stars = useMemo(() => makeStars(55), []);

  // ── Ambient glow ring (around globe, RN-side) ──
  const glowScale   = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const glowScale2  = useSharedValue(1);
  const glowOpacity2= useSharedValue(0);

  // ── Status text fade ──
  const statusOpacity = useSharedValue(1);

  // ── AI card subtle float ──
  const cardY = useSharedValue(0);

  useEffect(() => {
    // Card float
    cardY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming( 0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true
    );
  }, []);

  useEffect(() => {
    // Cycle pulse rings
    if (state === "listening") {
      glowScale.value   = withRepeat(withSequence(withTiming(1,{duration:0}), withTiming(1.55,{duration:1800,easing:Easing.out(Easing.ease)})), -1, false);
      glowOpacity.value = withRepeat(withSequence(withTiming(0.18,{duration:0}), withTiming(0,{duration:1800})), -1, false);
      glowScale2.value  = withRepeat(withSequence(withTiming(1,{duration:0}), withTiming(1.90,{duration:2400,easing:Easing.out(Easing.ease)})), -1, false);
      glowOpacity2.value= withRepeat(withSequence(withTiming(0.09,{duration:800}), withTiming(0,{duration:1600})), -1, false);
    } else if (state === "speaking") {
      glowScale.value   = withRepeat(withSequence(withTiming(1,{duration:0}), withTiming(1.35,{duration:900,easing:Easing.out(Easing.ease)})), -1, false);
      glowOpacity.value = withRepeat(withSequence(withTiming(0.28,{duration:0}), withTiming(0,{duration:900})), -1, false);
      glowScale2.value  = withRepeat(withSequence(withTiming(1,{duration:0}), withTiming(1.65,{duration:1400,easing:Easing.out(Easing.ease)})), -1, false);
      glowOpacity2.value= withRepeat(withSequence(withTiming(0.14,{duration:400}), withTiming(0,{duration:1000})), -1, false);
    } else {
      glowOpacity.value  = withTiming(0, { duration: 600 });
      glowOpacity2.value = withTiming(0, { duration: 600 });
    }
  }, [state]);

  const glowRing1Style = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity:   glowOpacity.value,
  }));
  const glowRing2Style = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale2.value }],
    opacity:   glowOpacity2.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
  }));

  // ── State labels ──
  const statusLabel =
    state === "listening" ? "Dinliyorum..." :
    state === "speaking"  ? "Yanıt veriyorum..." :
    "Konuşmaya hazır";

  const statusSub =
    state === "listening" ? "Net ve anlaşılır konuşabilirsin." :
    state === "speaking"  ? "AkılCEP sana yanıt üretiyor." :
    "Ekrana dokun ve başla.";

  const statusColor =
    state === "listening" ? "rgba(255,255,255,0.88)" :
    state === "speaking"  ? "rgba(255,255,255,0.95)" :
    "rgba(255,255,255,0.38)";

  const dotColor =
    state === "listening" ? "rgba(90,190,255,0.90)" :
    state === "speaking"  ? "rgba(80,255,160,0.90)"  :
    "rgba(255,255,255,0.28)";

  const handleEarthTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState(s =>
      s === "idle"      ? "listening" :
      s === "listening" ? "speaking"  : "idle"
    );
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // ─── Globe ring diameter (matches CinematicEarth positioning) ──
  const GLOBE_D = H * 0.40;

  return (
    <View style={styles.root}>

      {/* ── Static star field ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map(s => (
          <View
            key={s.key}
            style={[styles.star, {
              top:     s.top,
              left:    s.left,
              width:   s.size,
              height:  s.size,
              opacity: s.opacity,
            }]}
          />
        ))}
      </View>

      {/* ── Earth (full-screen, tap to interact) ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleEarthTap}>
        <CinematicEarth voiceState={state} />
      </Pressable>

      {/* ── RN-side glow rings around globe center ── */}
      <View
        style={[styles.glowWrap, {
          top:  H * 0.44 - GLOBE_D / 2,
          left: W / 2 - GLOBE_D / 2,
          width: GLOBE_D, height: GLOBE_D,
        }]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.glowRing, { width: GLOBE_D, height: GLOBE_D, borderRadius: GLOBE_D / 2, borderColor: dotColor }, glowRing2Style]} />
        <Animated.View style={[styles.glowRing, { width: GLOBE_D, height: GLOBE_D, borderRadius: GLOBE_D / 2, borderColor: dotColor }, glowRing1Style]} />
      </View>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 10 }]} pointerEvents="box-none">

        {/* Back */}
        <TouchableOpacity style={styles.topBtn} onPress={handleClose} hitSlop={14} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.70)" />
        </TouchableOpacity>

        {/* Center titles */}
        <View style={styles.topCenter} pointerEvents="none">
          <Text style={styles.topLabel}>VOICE MODE</Text>
          <Text style={styles.topSub}>AKILCEP</Text>
        </View>

        {/* Settings */}
        <TouchableOpacity style={styles.topBtn} hitSlop={14} activeOpacity={0.7}>
          <Feather name="sliders" size={15} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>

      </View>

      {/* ── Bottom overlay ── */}
      <View
        style={[styles.bottomOverlay, { paddingBottom: btmPad + 20 }]}
        pointerEvents="box-none"
      >

        {/* Status text */}
        <View style={styles.statusBlock} pointerEvents="none">
          {/* Tiny status dot */}
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.statusSub}>{statusSub}</Text>
        </View>

        {/* Controls row */}
        <View style={styles.ctrlRow} pointerEvents="box-none">
          <GlassBtn icon="volume-2" label="Ses Çıkışı" onPress={() => Haptics.selectionAsync()} />
          <GlassBtn icon="x"        label="Çıkış"      onPress={handleClose} danger />
        </View>

        {/* AI status card */}
        <Animated.View style={[styles.aiCard, cardStyle]} pointerEvents="none">
          <View style={styles.aiCardLeft}>
            <View style={styles.aiIconWrap}>
              <View style={styles.aiIconGlow} />
              <Feather name="cpu" size={13} color="rgba(255,255,255,0.90)" />
            </View>
            <View style={styles.aiCardText}>
              <Text style={styles.aiCardTitle}>AkılCEP seninle konuşuyor.</Text>
              <Text style={styles.aiCardSub}>Yapay zeka destekli kişisel asistanın.</Text>
            </View>
          </View>
          <View style={styles.onlineDot} />
        </Animated.View>

      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#020208",
  },

  // ── Stars
  star: {
    position:     "absolute",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  // ── Glow rings
  glowWrap: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
    pointerEvents:  "none",
  } as any,
  glowRing: {
    position:    "absolute",
    borderWidth: 1,
    borderColor: "rgba(100,180,255,0.22)",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    zIndex:            20,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 22,
  },
  topBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.10)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  topCenter: {
    alignItems: "center",
    gap:        3,
  },
  topLabel: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 3.5,
    color:         "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
  },
  topSub: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 5,
    color:         "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
  },

  // ── Bottom overlay
  bottomOverlay: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    zIndex:   20,
    gap:      20,
    paddingHorizontal: 24,
  },

  // ── Status
  statusBlock: {
    alignItems: "center",
    gap:        7,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginBottom: 2,
  },
  statusLabel: {
    fontSize:      20,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.5,
    color:         "rgba(255,255,255,0.88)",
  },
  statusSub: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.32)",
    letterSpacing: 0.1,
  },

  // ── Controls row
  ctrlRow: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            16,
  },
  ctrlBtn: {
    alignItems:      "center",
    gap:             8,
    paddingVertical: 4,
    minWidth:        80,
  },
  ctrlIcon: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     "rgba(255,255,255,0.12)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  ctrlIconDanger: {
    backgroundColor: "rgba(255,69,58,0.10)",
    borderColor:     "rgba(255,69,58,0.20)",
  },
  ctrlLabel: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.3,
    color:         "rgba(255,255,255,0.40)",
  },

  // ── AI card
  aiCard: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "rgba(255,255,255,0.045)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.10)",
    borderRadius:      20,
    paddingVertical:   14,
    paddingHorizontal: 16,
    gap:               12,
  },
  aiCardLeft: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           11,
  },
  aiIconWrap: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  aiIconGlow: {
    position:        "absolute",
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: "rgba(90,190,255,0.12)",
  },
  aiCardText: {
    flex: 1,
    gap:  2,
  },
  aiCardTitle: {
    fontSize:      13,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.80)",
    letterSpacing: -0.1,
  },
  aiCardSub: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
    color:      "rgba(255,255,255,0.32)",
  },
  onlineDot: {
    width:           9,
    height:          9,
    borderRadius:    5,
    backgroundColor: "#34C759",
    shadowColor:     "#34C759",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    4,
    elevation:       2,
  },

});
