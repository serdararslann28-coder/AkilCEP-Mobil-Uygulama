/**
 * AkılCEP — Splash Screen
 *
 * #F8F8F8 background, leaf logo only. Total duration ~3.3 s.
 *
 * Timeline:
 *   0 ms      Fade in + scale entry  0.97 → 1.00   (500 ms)
 *   500 ms    Exhale                 1.00 → 0.97   (600 ms)
 *   1100 ms   Inhale                 0.97 → 1.00   (600 ms)
 *   1700 ms   Settle                 1.00 → 0.99   (600 ms)
 *   2300 ms   Hold still             0.99           (700 ms)
 *   3000 ms   Fade out                              (300 ms)
 *   3300 ms   Navigate → onboarding / chat
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ONBOARDING_KEY } from "@/app/onboarding";

// Retained for profile.tsx compatibility
export const STARTUP_SOUND_KEY = "@akilcep_startup_sound";

export default function SplashScreen() {
  // Keep the initial frame visible in Expo's web preview even if Reanimated
  // has not attached yet. Native still runs the full entrance animation.
  const opacity = useSharedValue(Platform.OS === "web" ? 1 : 0);
  const scale = useSharedValue(Platform.OS === "web" ? 1 : 0.97);
  const screenOp = useSharedValue(1);

  useEffect(() => {
    // Fade in over 500 ms
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease),
    });

    // Entry → breathe → settle → hold
    scale.value = withSequence(
      // Entry: 0.97 → 1.00 (500 ms)
      withTiming(0.99, { duration: 500, easing: Easing.out(Easing.ease) }),
      withTiming(1.0, { duration: 100, easing: Easing.out(Easing.ease) }),
      // Exhale: 1.00 → 0.97 (600 ms)
      withTiming(0.97, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      // Inhale: 0.97 → 1.00 (600 ms)
      withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      // Settle: 1.00 → 0.99 (600 ms)
      withTiming(0.99, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      // Hold: stay at 0.99 for 700 ms
      withTiming(0.99, { duration: 700 }),
    );

    // Fade out at 3000 ms (300 ms)
    screenOp.value = withDelay(
      3000,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
    );

    // Navigate at 3300 ms
    const nav = setTimeout(async () => {
      // In development (Expo Go is always __DEV__), start from welcome so the
      // full Splash → Welcome → Onboarding flow is exercised during testing.
      if (__DEV__) {
        router.replace("/onboarding");
        return;
      }
      // In production: check for an active Supabase session first,
      // then fall back to the onboarding-done flag (covers guest/local users).
      try {
        const { isSupabaseConfigured, supabase } = await import(
          "@/lib/supabase"
        );
        if (isSupabaseConfigured) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            router.replace("/chat");
            return;
          }
        }
      } catch {
        /* ignore import errors */
      }

      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      router.replace(done === "true" ? "/chat" : "/onboarding");
    }, 3300);

    return () => clearTimeout(nav);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
          source={require("@/assets/images/leaf-only-transparent.png")}
          style={[ss.logo, logoStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 240,
    height: 240,
  },
});
