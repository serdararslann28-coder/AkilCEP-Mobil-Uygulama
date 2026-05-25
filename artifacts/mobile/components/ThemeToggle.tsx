/**
 * ThemeToggle — small glassmorphic circle, icon-only.
 * Sun ↔ Moon morph with spring rotation.
 * Designed to sit in the FullscreenMenu bottom-left corner.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

interface Props {
  size?: number;
}

export default function ThemeToggle({ size = 44 }: Props) {
  const { theme, toggle } = useTheme();

  const spin  = useSharedValue(theme.isDark ? 1 : 0);
  const scale = useSharedValue(1);

  const prevDark = React.useRef(theme.isDark);

  React.useEffect(() => {
    if (prevDark.current === theme.isDark) return;
    prevDark.current = theme.isDark;
    spin.value = withSpring(theme.isDark ? 1 : 0, { damping: 12, stiffness: 120 });
  }, [theme.isDark]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 180}deg` }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.82, { duration: 80 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    });
    toggle();
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg     = theme.isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.055)";
  const border = theme.isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.08)";
  const icon   = theme.isDark ? theme.green : theme.fgSoft;

  return (
    <Animated.View style={[{ width: size, height: size }, pillStyle]}>
      <TouchableOpacity
        style={[ss.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: border }]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <Animated.View style={iconStyle}>
          <Feather name={theme.isDark ? "moon" : "sun"} size={16} color={icon} />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  circle: {
    alignItems:  "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
