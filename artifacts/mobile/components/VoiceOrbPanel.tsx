/**
 * VoiceOrbPanel — refined ambient voice layer.
 *
 * Design intent: 70% conversation / 30% AI ambience.
 * The orb and waveforms support the chat — they don't dominate it.
 *
 * Layout (slides in between FlatList and input bar):
 *
 *   [←bars] [ orb ] [bars→]
 *       "AkılCEP yanıtlıyor…"
 *         · · ||||||||| · ·
 */
import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  phase:  VoicePhase;
  isDark: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────
const ORB_D   = 88;    // ~24% smaller than before (was 116)
const PANEL_H = 152;   // tighter total height (was 194)
const BAR_W   = 2.0;   // thinner bars (was 2.5)
const BAR_GAP = 3;     // tighter gap (was 4)

// Left bars max heights — outer→inner, scaled down ~28% from original
// (closer to orb = tallest)
const L_MAX = [4,  7, 13, 20, 26, 22, 16, 11];
const L_DEL = [200,160,120, 80, 40,  0, 60,140];
const L_DUR = [430,370,410,350,390,330,410,370]; // slower = more cinematic

// Right bars — mirror
const R_MAX = [11, 16, 22, 26, 20, 13,  7,  4];
const R_DEL = [140, 60,  0, 40, 80,120,160,200];
const R_DUR = [370,410,330,390,350,410,370,430];

// Bottom cluster — bell-curve, scaled down ~28%
const B_MAX = [3,  6, 10, 16, 23, 27, 23, 16, 10,  6,  3];
const B_DEL = [0, 60,120, 40, 80, 20, 80, 40,120, 60,  0];
const B_DUR = [390,330,410,350,370,410,350,410,330,390,370];

export default function VoiceOrbPanel({ phase, isDark }: Props) {
  // ── Left bar heights ───────────────────────────────────────────────────────
  const lH0 = useSharedValue(2);
  const lH1 = useSharedValue(2);
  const lH2 = useSharedValue(2);
  const lH3 = useSharedValue(2);
  const lH4 = useSharedValue(2);
  const lH5 = useSharedValue(2);
  const lH6 = useSharedValue(2);
  const lH7 = useSharedValue(2);
  const leftBars = [lH0, lH1, lH2, lH3, lH4, lH5, lH6, lH7] as const;

  // ── Right bar heights ──────────────────────────────────────────────────────
  const rH0 = useSharedValue(2);
  const rH1 = useSharedValue(2);
  const rH2 = useSharedValue(2);
  const rH3 = useSharedValue(2);
  const rH4 = useSharedValue(2);
  const rH5 = useSharedValue(2);
  const rH6 = useSharedValue(2);
  const rH7 = useSharedValue(2);
  const rightBars = [rH0, rH1, rH2, rH3, rH4, rH5, rH6, rH7] as const;

  // ── Bottom cluster heights ─────────────────────────────────────────────────
  const bH0  = useSharedValue(2);
  const bH1  = useSharedValue(2);
  const bH2  = useSharedValue(2);
  const bH3  = useSharedValue(2);
  const bH4  = useSharedValue(2);
  const bH5  = useSharedValue(2);
  const bH6  = useSharedValue(2);
  const bH7  = useSharedValue(2);
  const bH8  = useSharedValue(2);
  const bH9  = useSharedValue(2);
  const bH10 = useSharedValue(2);
  const botBars = [bH0, bH1, bH2, bH3, bH4, bH5, bH6, bH7, bH8, bH9, bH10] as const;

  // ── Orb ───────────────────────────────────────────────────────────────────
  const orbScale  = useSharedValue(1);
  const orbGlowOp = useSharedValue(0.10);

  // ── Panel entry/exit ───────────────────────────────────────────────────────
  const panelOp = useSharedValue(0);
  const panelTY = useSharedValue(16);
  const panelH  = useSharedValue(0);

  // ── Drive all animations from phase ───────────────────────────────────────
  useEffect(() => {
    const active = phase !== "idle";

    // Panel expand/collapse
    panelOp.value = withTiming(active ? 1 : 0, {
      duration: active ? 440 : 300,
      easing:   Easing.out(Easing.ease),
    });
    panelTY.value = withTiming(active ? 0 : 16, {
      duration: active ? 440 : 300,
      easing:   Easing.out(Easing.ease),
    });
    panelH.value = withTiming(active ? PANEL_H : 0, {
      duration: active ? 400 : 280,
      easing:   Easing.out(Easing.ease),
    });

    if (!active) {
      [...leftBars, ...rightBars, ...botBars].forEach((v) => {
        v.value = withTiming(2, { duration: 280 });
      });
      orbScale.value  = withTiming(1,    { duration: 280 });
      orbGlowOp.value = withTiming(0.10, { duration: 280 });
      return;
    }

    // Orb breathing — very subtle (was 1.028, now 1.016)
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.016, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );

    // Glow intensity — reduced across all phases (was 0.38/0.24/0.14)
    orbGlowOp.value = withTiming(
      phase === "speaking"  ? 0.26 :
      phase === "listening" ? 0.16 :
      0.10,                                // thinking
      { duration: 700 }
    );

    // Bar animation — softer scale factors than before
    const animGroup = (
      bars:      readonly typeof lH0[],
      maxH:      number[],
      delays:    number[],
      durations: number[],
    ) => {
      // Scale factor: how tall bars grow per phase
      const scaleFactor =
        phase === "thinking"  ? 0.20 :
        phase === "listening" ? 0.65 :
        0.88;                              // speaking (was 1.0 — slightly soft)

      // Min height fraction: how far bars fall between peaks
      const minFraction =
        phase === "thinking"  ? 0.15 :
        phase === "listening" ? 0.28 :
        0.14;

      bars.forEach((bar, i) => {
        const max = (maxH[i]!) * scaleFactor;
        const min = Math.max(2, max * minFraction);
        const dur = durations[i]!;

        bar.value = withDelay(
          delays[i]!,
          withRepeat(
            withSequence(
              withTiming(max, { duration: dur, easing: Easing.inOut(Easing.sin) }),
              withTiming(min, { duration: dur, easing: Easing.inOut(Easing.sin) }),
            ),
            -1, true
          )
        );
      });
    };

    animGroup(leftBars,  L_MAX, L_DEL, L_DUR);
    animGroup(rightBars, R_MAX, R_DEL, R_DUR);
    animGroup(botBars,   B_MAX, B_DEL, B_DUR);
  }, [phase]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const panelStyle = useAnimatedStyle(() => ({
    opacity:   panelOp.value,
    height:    panelH.value,
    overflow:  "hidden",
    transform: [{ translateY: panelTY.value }],
  }));

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: orbGlowOp.value,
  }));

  // Per-bar styles — left
  const lS0 = useAnimatedStyle(() => ({ height: lH0.value }));
  const lS1 = useAnimatedStyle(() => ({ height: lH1.value }));
  const lS2 = useAnimatedStyle(() => ({ height: lH2.value }));
  const lS3 = useAnimatedStyle(() => ({ height: lH3.value }));
  const lS4 = useAnimatedStyle(() => ({ height: lH4.value }));
  const lS5 = useAnimatedStyle(() => ({ height: lH5.value }));
  const lS6 = useAnimatedStyle(() => ({ height: lH6.value }));
  const lS7 = useAnimatedStyle(() => ({ height: lH7.value }));
  const lStyles = [lS0, lS1, lS2, lS3, lS4, lS5, lS6, lS7];

  // Per-bar styles — right
  const rS0 = useAnimatedStyle(() => ({ height: rH0.value }));
  const rS1 = useAnimatedStyle(() => ({ height: rH1.value }));
  const rS2 = useAnimatedStyle(() => ({ height: rH2.value }));
  const rS3 = useAnimatedStyle(() => ({ height: rH3.value }));
  const rS4 = useAnimatedStyle(() => ({ height: rH4.value }));
  const rS5 = useAnimatedStyle(() => ({ height: rH5.value }));
  const rS6 = useAnimatedStyle(() => ({ height: rH6.value }));
  const rS7 = useAnimatedStyle(() => ({ height: rH7.value }));
  const rStyles = [rS0, rS1, rS2, rS3, rS4, rS5, rS6, rS7];

  // Per-bar styles — bottom
  const bS0  = useAnimatedStyle(() => ({ height: bH0.value  }));
  const bS1  = useAnimatedStyle(() => ({ height: bH1.value  }));
  const bS2  = useAnimatedStyle(() => ({ height: bH2.value  }));
  const bS3  = useAnimatedStyle(() => ({ height: bH3.value  }));
  const bS4  = useAnimatedStyle(() => ({ height: bH4.value  }));
  const bS5  = useAnimatedStyle(() => ({ height: bH5.value  }));
  const bS6  = useAnimatedStyle(() => ({ height: bH6.value  }));
  const bS7  = useAnimatedStyle(() => ({ height: bH7.value  }));
  const bS8  = useAnimatedStyle(() => ({ height: bH8.value  }));
  const bS9  = useAnimatedStyle(() => ({ height: bH9.value  }));
  const bS10 = useAnimatedStyle(() => ({ height: bH10.value }));
  const bStyles = [bS0, bS1, bS2, bS3, bS4, bS5, bS6, bS7, bS8, bS9, bS10];

  // ── Colour tokens ──────────────────────────────────────────────────────────
  // Bar opacity reduced (was 0.28/0.18)
  const barColor   = isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.13)";
  const textColor  = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)";
  const orbBg      = isDark ? "rgba(36,36,36,0.96)"    : "rgba(244,244,241,0.98)";
  const orbGlowClr = isDark ? "rgba(255,255,255,1)"    : "rgba(208,208,203,1)";
  const logoTint   = isDark ? "#BBBBBB"                : "#9A9A94";

  const statusText =
    phase === "listening" ? "d i n l i y o r u m" :
    phase === "thinking"  ? "d ü ş ü n ü y o r …" :
    phase === "speaking"  ? "a k ı l c e p   y a n ı t l ı y o r …" :
    "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[ss.panel, panelStyle]} pointerEvents="none">

      {/* [left bars] [orb] [right bars] */}
      <View style={ss.orbRow}>

        <View style={ss.barWing}>
          {lStyles.map((style, i) => (
            <Animated.View
              key={`l${i}`}
              style={[ss.bar, { backgroundColor: barColor }, style]}
            />
          ))}
        </View>

        <Animated.View style={[ss.orbWrap, orbAnimStyle]}>
          {/* Outer glow */}
          <Animated.View style={[ss.glowRing, { backgroundColor: orbGlowClr }, glowStyle]} />
          {/* Mid haze */}
          <View style={[ss.midRing, { backgroundColor: orbBg }]} />
          {/* Core */}
          <View style={[ss.orb, { backgroundColor: orbBg }]}>
            <Image
              source={leafOnly}
              style={[ss.orbLogo, { tintColor: logoTint }]}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <View style={[ss.barWing, ss.barWingRight]}>
          {rStyles.map((style, i) => (
            <Animated.View
              key={`r${i}`}
              style={[ss.bar, { backgroundColor: barColor }, style]}
            />
          ))}
        </View>

      </View>

      {/* Status text */}
      <Text style={[ss.statusText, { color: textColor }]}>{statusText}</Text>

      {/* Bottom waveform cluster */}
      <View style={ss.bottomCluster}>
        {bStyles.map((style, i) => (
          <Animated.View
            key={`b${i}`}
            style={[ss.bar, { backgroundColor: barColor }, style]}
          />
        ))}
      </View>

    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  panel: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            7,          // tighter vertical rhythm (was 10)
    paddingBottom:  4,
  },

  orbRow: {
    flexDirection:     "row",
    alignItems:        "center",
    width:             "100%",
    paddingHorizontal: 18,
  },

  barWing: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "flex-end",
    gap:            BAR_GAP,
    paddingRight:   8,          // tighter gap to orb (was 12)
  },
  barWingRight: {
    justifyContent: "flex-start",
    paddingRight:   0,
    paddingLeft:    8,
  },

  bar: {
    width:        BAR_W,
    borderRadius: BAR_W / 2,
    alignSelf:    "center",
    minHeight:    2,
  },

  // Orb — 24% smaller overall
  orbWrap: {
    width:          ORB_D + 30,   // was ORB_D + 40
    height:         ORB_D + 30,
    alignItems:     "center",
    justifyContent: "center",
  },
  glowRing: {
    position:     "absolute",
    width:        ORB_D + 30,
    height:       ORB_D + 30,
    borderRadius: (ORB_D + 30) / 2,
  },
  midRing: {
    position:     "absolute",
    width:        ORB_D + 10,    // was ORB_D + 14
    height:       ORB_D + 10,
    borderRadius: (ORB_D + 10) / 2,
    opacity:      0.40,           // was 0.55 — softer mid layer
  },
  orb: {
    width:          ORB_D,
    height:         ORB_D,
    borderRadius:   ORB_D / 2,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 4 },  // was 6
    shadowOpacity:  0.06,                      // was 0.08
    shadowRadius:   14,                        // was 20
    elevation:      6,                         // was 10
  },
  orbLogo: {
    width:  42,   // was 54 — proportionally smaller with orb
    height: 42,
  },

  statusText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      10,
    letterSpacing: 1.2,     // was 1.6 — slightly tighter
    textAlign:     "center",
  },

  bottomCluster: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            BAR_GAP,
  },
});
