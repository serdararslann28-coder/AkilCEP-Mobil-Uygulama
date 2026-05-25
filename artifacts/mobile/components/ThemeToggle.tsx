/**
 * ThemeToggle — sliding capsule toggle.
 * Sun (left) ↔ Moon (right). Pill slides with spring physics.
 * Glassmorphic, Apple-premium, no text labels.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

// ─── Capsule geometry ─────────────────────────────────────────────────────────
const CW   = 80;   // capsule width
const CH   = 36;   // capsule height
const PILL = 28;   // pill diameter
const PAD  = 4;    // padding inside capsule

const POS_LIGHT = PAD;                  // pill x for PURE
const POS_DARK  = CW - PILL - PAD;     // pill x for VOID  (= 48)

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const prevDark = useRef(theme.isDark);

  // ── Animated values ──
  const pillX       = useSharedValue(theme.isDark ? POS_DARK  : POS_LIGHT);
  const sunOpacity  = useSharedValue(theme.isDark ? 0.28 : 0.9);
  const moonOpacity = useSharedValue(theme.isDark ? 0.9  : 0.28);
  const pillScale   = useSharedValue(1);

  useEffect(() => {
    if (prevDark.current === theme.isDark) return;
    prevDark.current = theme.isDark;

    pillX.value       = withSpring(theme.isDark ? POS_DARK : POS_LIGHT, { damping: 18, stiffness: 190 });
    sunOpacity.value  = withTiming(theme.isDark ? 0.28 : 0.9,  { duration: 300, easing: Easing.inOut(Easing.ease) });
    moonOpacity.value = withTiming(theme.isDark ? 0.9  : 0.28, { duration: 300, easing: Easing.inOut(Easing.ease) });
  }, [theme.isDark]);

  const pillStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));
  const pilScStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }, { scale: pillScale.value }] }));
  const sunStyle   = useAnimatedStyle(() => ({ opacity: sunOpacity.value }));
  const moonStyle  = useAnimatedStyle(() => ({ opacity: moonOpacity.value }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pillScale.value = withSpring(0.80, { duration: 80 }, () => {
      pillScale.value = withSpring(1, { damping: 14, stiffness: 220 });
    });
    toggle();
  };

  // Capsule glass colours
  const capsuleBg  = theme.isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.055)";
  const capsuleBdr = theme.isDark ? "rgba(255,255,255,0.11)"  : "rgba(0,0,0,0.07)";
  const pillBg     = theme.isDark ? "rgba(255,255,255,0.20)"  : "#FFFFFF";
  const pillShadow = theme.isDark ? 0 : 0.14;
  const sunClr     = theme.isDark ? "#F5F5F5" : "#3A3A3C";
  const moonClr    = theme.isDark ? "rgba(255,255,255,0.82)" : "#3A3A3C";

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <View
        style={[
          ss.capsule,
          { backgroundColor: capsuleBg, borderColor: capsuleBdr },
        ]}
      >
        {/* Icon layer — always visible, opacity animated */}
        <View style={ss.iconRow}>
          <Animated.View style={[ss.iconSlot, sunStyle]}>
            <Feather name="sun" size={13} color={sunClr} />
          </Animated.View>
          <Animated.View style={[ss.iconSlot, moonStyle]}>
            <Feather name="moon" size={13} color={moonClr} />
          </Animated.View>
        </View>

        {/* Sliding pill */}
        <Animated.View
          style={[
            ss.pill,
            { width: PILL, height: PILL, borderRadius: PILL / 2, backgroundColor: pillBg, shadowOpacity: pillShadow },
            pilScStyle,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const ss = StyleSheet.create({
  capsule: {
    width:        CW,
    height:       CH,
    borderRadius: CH / 2,
    borderWidth:  StyleSheet.hairlineWidth,
    overflow:     "hidden",
    justifyContent: "center",
    // Shadow on capsule
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     3,
  },
  iconRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection:  "row",
    alignItems:     "center",
  },
  iconSlot: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    top:      (CH - PILL) / 2,
    left:     0,                // translateX drives actual position
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation:    2,
  },
});
