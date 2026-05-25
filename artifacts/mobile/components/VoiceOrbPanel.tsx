/**
 * VoiceOrbPanel — cinematic inline voice interaction layer.
 *
 * Layout (appears between chat FlatList and input bar):
 *
 *   [←bars ] [  logo orb  ] [bars→]
 *          "AkılCEP yanıtlıyor..."
 *         · · · ||||||||||| · · ·
 *
 * Appearance driven by voicePhase prop — panel handles all
 * its own animation internally.
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

// ── Bar geometry ─────────────────────────────────────────────────────────────
// Left bars: outer→inner (bar[0] is outermost, bar[7] is closest to orb)
const L_MAX = [6,  10, 18, 28, 36, 32, 24, 16];
const L_DEL = [200,160,120, 80, 40,  0, 60,140];
const L_DUR = [380,320,360,300,340,280,360,320];

// Right bars: inner→outer (mirror of left)
const R_MAX = [16, 24, 32, 36, 28, 18, 10,  6];
const R_DEL = [140, 60,  0, 40, 80,120,160,200];
const R_DUR = [320,360,280,340,300,360,320,380];

// Bottom cluster: bell-curve heights, center is tallest
const B_MAX = [4,  8, 14, 22, 32, 38, 32, 22, 14,  8,  4];
const B_DEL = [0, 60,120, 40, 80, 20, 80, 40,120, 60,  0];
const B_DUR = [340,280,360,300,320,360,300,360,280,340,320];

const BAR_W  = 2.5;
const BAR_GAP = 4;
const ORB_D  = 116;                         // orb diameter
const PANEL_H = 194;                        // total panel height

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
  const leftBars  = [lH0, lH1, lH2, lH3, lH4, lH5, lH6, lH7] as const;

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

  // ── Bottom cluster bar heights ─────────────────────────────────────────────
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
  const orbScale   = useSharedValue(1);
  const orbGlowOp  = useSharedValue(0.14);

  // ── Panel entry/exit ───────────────────────────────────────────────────────
  const panelOp = useSharedValue(0);
  const panelTY = useSharedValue(24);
  const panelH  = useSharedValue(0);

  // ── Animate ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const active = phase !== "idle";

    // Panel slide-in / slide-out + height collapse
    panelOp.value = withTiming(active ? 1 : 0, {
      duration: active ? 420 : 280,
      easing: Easing.out(Easing.ease),
    });
    panelTY.value = withTiming(active ? 0 : 20, {
      duration: active ? 420 : 280,
      easing: Easing.out(Easing.ease),
    });
    panelH.value = withTiming(active ? PANEL_H : 0, {
      duration: active ? 380 : 260,
      easing: Easing.out(Easing.ease),
    });

    if (!active) {
      // Collapse bars
      [...leftBars, ...rightBars, ...botBars].forEach((v) => {
        v.value = withTiming(2, { duration: 300 });
      });
      orbScale.value  = withTiming(1, { duration: 300 });
      orbGlowOp.value = withTiming(0.14, { duration: 300 });
      return;
    }

    // Orb: continuous breathing
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.028, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );

    // Orb glow: brighter when speaking
    orbGlowOp.value = withTiming(
      phase === "speaking" ? 0.38 : phase === "listening" ? 0.24 : 0.14,
      { duration: 600 }
    );

    // Animate a group of bars
    const animGroup = (
      bars:     readonly typeof lH0[],
      maxH:     number[],
      delays:   number[],
      durations:number[],
    ) => {
      const minFraction = phase === "thinking"  ? 0.10
                        : phase === "listening" ? 0.25
                        : 0.12;                         // speaking
      const scaleFactor = phase === "thinking"  ? 0.25
                        : phase === "listening" ? 0.72
                        : 1.0;                          // speaking = full

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

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: orbGlowOp.value,
  }));

  // Per-bar animated styles — left
  const lS0 = useAnimatedStyle(() => ({ height: lH0.value }));
  const lS1 = useAnimatedStyle(() => ({ height: lH1.value }));
  const lS2 = useAnimatedStyle(() => ({ height: lH2.value }));
  const lS3 = useAnimatedStyle(() => ({ height: lH3.value }));
  const lS4 = useAnimatedStyle(() => ({ height: lH4.value }));
  const lS5 = useAnimatedStyle(() => ({ height: lH5.value }));
  const lS6 = useAnimatedStyle(() => ({ height: lH6.value }));
  const lS7 = useAnimatedStyle(() => ({ height: lH7.value }));
  const lStyles = [lS0, lS1, lS2, lS3, lS4, lS5, lS6, lS7];

  // Per-bar animated styles — right
  const rS0 = useAnimatedStyle(() => ({ height: rH0.value }));
  const rS1 = useAnimatedStyle(() => ({ height: rH1.value }));
  const rS2 = useAnimatedStyle(() => ({ height: rH2.value }));
  const rS3 = useAnimatedStyle(() => ({ height: rH3.value }));
  const rS4 = useAnimatedStyle(() => ({ height: rH4.value }));
  const rS5 = useAnimatedStyle(() => ({ height: rH5.value }));
  const rS6 = useAnimatedStyle(() => ({ height: rH6.value }));
  const rS7 = useAnimatedStyle(() => ({ height: rH7.value }));
  const rStyles = [rS0, rS1, rS2, rS3, rS4, rS5, rS6, rS7];

  // Per-bar animated styles — bottom
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
  const barColor   = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)";
  const textColor  = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)";
  const orbBg      = isDark ? "rgba(38,38,38,0.95)"    : "rgba(244,244,241,0.98)";
  const orbGlowClr = isDark ? "rgba(255,255,255,1)"    : "rgba(210,210,205,1)";
  const logoTint   = isDark ? "#CCCCCC"                : "#8A8A84";

  // Status text per phase
  const statusText =
    phase === "listening" ? "D İ N L İ Y O R U M" :
    phase === "thinking"  ? "D Ü Ş Ü N Ü Y O R …" :
    phase === "speaking"  ? "A K I L C E P   Y A N I T L I Y O R …" :
    "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[ss.panel, panelStyle]} pointerEvents="none">

      {/* ── Row: [left bars] [orb] [right bars] ── */}
      <View style={ss.orbRow}>

        {/* Left bars — outer on left, inner on right edge */}
        <View style={ss.barWing}>
          {lStyles.map((style, i) => (
            <Animated.View
              key={`l${i}`}
              style={[ss.bar, { backgroundColor: barColor }, style]}
            />
          ))}
        </View>

        {/* Logo orb */}
        <Animated.View style={[ss.orbWrap, orbStyle]}>
          {/* Outer glow ring */}
          <Animated.View
            style={[
              ss.glowRing,
              { backgroundColor: orbGlowClr },
              glowStyle,
            ]}
          />
          {/* Middle soft ring */}
          <View style={[ss.midRing, { backgroundColor: orbBg }]} />
          {/* Core orb */}
          <View style={[ss.orb, { backgroundColor: orbBg }]}>
            <Image
              source={leafOnly}
              style={[ss.orbLogo, { tintColor: logoTint }]}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Right bars — inner on left edge, outer on right */}
        <View style={[ss.barWing, ss.barWingRight]}>
          {rStyles.map((style, i) => (
            <Animated.View
              key={`r${i}`}
              style={[ss.bar, { backgroundColor: barColor }, style]}
            />
          ))}
        </View>

      </View>

      {/* ── Status text ── */}
      <Text style={[ss.statusText, { color: textColor }]}>{statusText}</Text>

      {/* ── Bottom waveform cluster ── */}
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
    height:         PANEL_H,
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    paddingBottom:  8,
  },

  // Orb row
  orbRow: {
    flexDirection:  "row",
    alignItems:     "center",
    width:          "100%",
    paddingHorizontal: 16,
  },

  // Bar wings
  barWing: {
    flex:          1,
    flexDirection: "row",
    alignItems:    "center",
    justifyContent:"flex-end",   // bars cluster near orb on left
    gap:           BAR_GAP,
    paddingRight:  12,
  },
  barWingRight: {
    justifyContent: "flex-start",
    paddingRight:   0,
    paddingLeft:    12,
  },
  bar: {
    width:        BAR_W,
    borderRadius: BAR_W / 2,
    alignSelf:    "center",
    minHeight:    2,
  },

  // Orb layers
  orbWrap: {
    width:          ORB_D + 40,  // includes glow ring space
    height:         ORB_D + 40,
    alignItems:     "center",
    justifyContent: "center",
  },
  glowRing: {
    position:     "absolute",
    width:        ORB_D + 40,
    height:       ORB_D + 40,
    borderRadius: (ORB_D + 40) / 2,
  },
  midRing: {
    position:     "absolute",
    width:        ORB_D + 14,
    height:       ORB_D + 14,
    borderRadius: (ORB_D + 14) / 2,
    opacity:      0.55,
  },
  orb: {
    width:          ORB_D,
    height:         ORB_D,
    borderRadius:   ORB_D / 2,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.08,
    shadowRadius:   20,
    elevation:      10,
  },
  orbLogo: {
    width:  54,
    height: 54,
  },

  // Status text
  statusText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      10,
    letterSpacing: 1.6,
    textAlign:     "center",
  },

  // Bottom waveform cluster
  bottomCluster: {
    flexDirection: "row",
    alignItems:    "center",
    justifyContent:"center",
    gap:           BAR_GAP,
  },
});
