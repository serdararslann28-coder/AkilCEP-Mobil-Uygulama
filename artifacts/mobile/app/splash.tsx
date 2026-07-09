/**
 * AkılCEP — Splash Screen
 *
 * #F8F8F8 background, centered logo.
 * Entry: fade in + scale 0.95 → 1.0 (600 ms)
 * Breathing: gentle 1.0 ↔ 1.02 oscillation after entry
 * Total visible: ~1.5 s → navigate to onboarding (new) or chat (returning)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ONBOARDING_KEY } from "@/app/onboarding";

// Retained for profile.tsx compatibility
export const STARTUP_SOUND_KEY = "@akilcep_startup_sound";

export default function SplashScreen() {
  const opacity  = useSharedValue(0);
  const scale    = useSharedValue(0.95);
  const screenOp = useSharedValue(1);

  useEffect(() => {
    // Fade in
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });

    // Scale in (0.95 → 1.0) then breathe (1.0 ↔ 1.02) indefinitely
    scale.value = withSequence(
      withTiming(1.0, { duration: 600, easing: Easing.out(Easing.ease) }),
      withRepeat(
        withTiming(1.02, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    // Fade screen out at 1200 ms (300 ms)
    screenOp.value = withDelay(
      1200,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
    );

    // Navigate at 1500 ms
    const nav = setTimeout(async () => {
      // In development, always show onboarding regardless of saved state.
      // In production, respect the AsyncStorage completion flag.
      if (__DEV__) {
        router.replace("/onboarding");
        return;
      }
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      router.replace(done === "true" ? "/chat" : "/onboarding");
    }, 1500);

    return () => clearTimeout(nav);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOp.value,
  }));

  return (
    <View style={ss.root}>
      <StatusBar style="dark" />
      <Animated.View style={[StyleSheet.absoluteFill, ss.center, screenStyle]}>
        <Animated.Image
          source={require("@/assets/images/logo-transparent.png")}
          style={[ss.logo, logoStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#F8F8F8",
  },
  center: {
    alignItems:     "center",
    justifyContent: "center",
  },
  logo: {
    width:  200,
    height: 200,
  },
});
