/**
 * ThemeToggle — floating pill that switches PURE ↔ VOID.
 * Animated sun → moon icon morphing, label cross-fade, spring press.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";

interface Props {
  /** Additional bottom offset above safe area (default 0) */
  bottomOffset?: number;
  /** Additional left offset (default 20) */
  leftOffset?: number;
}

export default function ThemeToggle({ bottomOffset = 0, leftOffset = 20 }: Props) {
  const { theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Icon spin ──
  const spin   = useSharedValue(0);
  // ── Label fade ──
  const labelA = useSharedValue(1);
  // ── Pill press scale ──
  const scale  = useSharedValue(1);

  useEffect(() => {
    // Icon morphs 180° each time theme changes
    spin.value = withSpring(
      theme.isDark ? 1 : 0,
      { damping: 14, stiffness: 120 }
    );
    // Label cross-fades
    labelA.value = withTiming(0, { duration: 110, easing: Easing.in(Easing.ease) }, () => {
      labelA.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
    });
  }, [theme.isDark]);

  const iconStyle  = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 180}deg` }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelA.value }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.88, { duration: 80 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    toggle();
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bottomPos = (insets.bottom || 0) + bottomOffset;

  return (
    <Animated.View style={[ss.wrap, { bottom: bottomPos + 14, left: leftOffset }, pillStyle]}>
      <TouchableOpacity
        style={[
          ss.pill,
          {
            backgroundColor: theme.isDark ? "rgba(255,255,255,0.09)" : "#FFFFFF",
            borderColor:      theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)",
            shadowOpacity:    theme.isDark ? 0 : 0.10,
          },
        ]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <Animated.View style={iconStyle}>
          <Feather
            name={theme.isDark ? "moon" : "sun"}
            size={14}
            color={theme.isDark ? theme.green : "#3A3A3C"}
          />
        </Animated.View>

        <Animated.View style={labelStyle}>
          <Text
            style={[
              ss.label,
              { color: theme.isDark ? theme.green : "#3A3A3C" },
            ]}
          >
            {theme.name}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex:   500,
  },
  pill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               7,
    paddingVertical:   9,
    paddingHorizontal: 14,
    borderRadius:      30,
    borderWidth:       StyleSheet.hairlineWidth,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowRadius:      12,
    elevation:         6,
  },
  label: {
    fontSize:      12,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.4,
  },
});
