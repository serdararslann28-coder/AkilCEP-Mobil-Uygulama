/**
 * Splash — AkılCEP ultra-minimal brand moment.
 *
 * Timeline:
 *   0.00 s  black screen
 *   0.30 s  icon fades in (700 ms ease-out cubic)
 *   0.50 s  wordmark "AkılCEP" fades in (600 ms)
 *   1.10 s  subtitle "cebindeki akıl" fades in (500 ms)
 *   2.60 s  everything fades to black (400 ms)
 *   3.00 s  navigate → /welcome (new user) or /chat (returning)
 *
 * Background: pure black. No rings. No arcs. No gradients.
 * Logo is the only thing that matters.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio }      from "expo-av";
import { router }     from "expo-router";
import { StatusBar }  from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ONBOARDING_KEY } from "@/app/onboarding";

// ── Dev flag ──────────────────────────────────────────────────────────────────
const FORCE_SHOW_ONBOARDING = true;

// ── Startup sound preference key ──────────────────────────────────────────────
export const STARTUP_SOUND_KEY = "@akilcep_startup_sound";

const brandIcon = require("@/assets/images/akilcep-icon.png");

const { width: SW, height: SH } = Dimensions.get("window");

// A handful of faint stars — deterministic, very restrained
const STARS = Array.from({ length: 10 }, (_, i) => ({
  x:    ((i * 137.508) % 100) / 100 * SW,
  y:    (8 + (i * 71.3 + 17) % 38) / 100 * SH,
  r:    i % 3 === 0 ? 1.0 : 1.5,
  op:   0.10 + (i % 5) * 0.045,
}));

// ── Timing constants (ms) ─────────────────────────────────────────────────────
const T_ICON      = 300;
const T_WORDMARK  = 500;
const T_SUBTITLE  = 1100;
const T_FADE_OUT  = 2600;
const T_NAVIGATE  = 3000;

export default function SplashScreen() {
  // ── Audio ref ────────────────────────────────────────────────────────────
  const soundRef = useRef<Audio.Sound | null>(null);

  // ── Animated values ──────────────────────────────────────────────────────
  const iconOp     = useSharedValue(0);
  const wordmarkOp = useSharedValue(0);
  const subtitleOp = useSharedValue(0);
  const glowPulse  = useSharedValue(0);
  const masterOp   = useSharedValue(1);

  // Destination resolved from AsyncStorage before 3 s
  const destination = useRef<"/chat" | "/welcome">("/welcome");

  useEffect(() => {
    // Resolve destination
    if (!FORCE_SHOW_ONBOARDING) {
      AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
        if (val) destination.current = "/chat";
      }).catch(() => {});
    }

    // ── Animation sequence ────────────────────────────────────────────────

    // 0.3 s — icon emerges
    iconOp.value = withDelay(T_ICON,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    // 0.5 s — wordmark
    wordmarkOp.value = withDelay(T_WORDMARK,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );

    // 1.1 s — subtitle
    subtitleOp.value = withDelay(T_SUBTITLE,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
    );

    // Glow breathe — starts with icon, continuous
    glowPulse.value = withDelay(T_ICON,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    // 2.6 s — fade to black
    masterOp.value = withDelay(T_FADE_OUT,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
    );

    // ── Audio ─────────────────────────────────────────────────────────────
    let rampInId:  ReturnType<typeof setInterval> | null = null;
    let rampOutId: ReturnType<typeof setInterval> | null = null;

    AsyncStorage.getItem(STARTUP_SOUND_KEY).then((pref) => {
      if (pref === "off") return;
      Audio.Sound.createAsync(
        require("@/assets/sounds/startup.mp3"),
        { shouldPlay: false, volume: 0, progressUpdateIntervalMillis: 80 },
      ).then(({ sound }) => {
        soundRef.current = sound;
      }).catch(() => {});
    }).catch(() => {});

    // Start playback at icon fade-in, ramp in over 500 ms
    const audioStart = setTimeout(() => {
      const s = soundRef.current;
      if (!s) return;
      s.playAsync().catch(() => {});
      const TARGET = 0.85;
      const STEPS  = 20;
      const STEP_MS = 500 / STEPS;
      let step = 0;
      rampInId = setInterval(() => {
        step++;
        s.setVolumeAsync(Math.min(TARGET, (step / STEPS) * TARGET)).catch(() => {});
        if (step >= STEPS) { clearInterval(rampInId!); rampInId = null; }
      }, STEP_MS);
    }, T_ICON);

    // Ramp out at 2.35 s over 650 ms, synced with fade-to-black
    const audioFade = setTimeout(() => {
      const s = soundRef.current;
      if (!s) return;
      const START   = 0.85;
      const STEPS   = 26;
      const STEP_MS = 650 / STEPS;
      let step = 0;
      rampOutId = setInterval(() => {
        step++;
        s.setVolumeAsync(Math.max(0, START * (1 - step / STEPS))).catch(() => {});
        if (step >= STEPS) { clearInterval(rampOutId!); rampOutId = null; }
      }, STEP_MS);
    }, 2350);

    // Navigate
    const nav = setTimeout(() => {
      router.replace(destination.current);
    }, T_NAVIGATE);

    return () => {
      clearTimeout(audioStart);
      clearTimeout(audioFade);
      clearTimeout(nav);
      if (rampInId)  clearInterval(rampInId);
      if (rampOutId) clearInterval(rampOutId);
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  // ── Animated styles ──────────────────────────────────────────────────────
  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOp.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(glowPulse.value, [0, 1], [0.00, 1.00]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [0.92, 1.08]) }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOp.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOp.value,
  }));

  const masterStyle = useAnimatedStyle(() => ({
    opacity: masterOp.value,
  }));

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      <Animated.View style={[StyleSheet.absoluteFill, masterStyle]}>

        {/* Stars — 10 very faint dots, purely decorative */}
        {STARS.map((s, i) => (
          <View
            key={i}
            style={[
              ss.star,
              {
                left:         s.x,
                top:          s.y,
                width:        s.r,
                height:       s.r,
                borderRadius: s.r / 2,
                opacity:      s.op,
              },
            ]}
          />
        ))}

        {/* Center composition */}
        <View style={ss.center}>

          {/* Glow halo — breathes behind the icon */}
          <Animated.View style={[ss.glow, glowStyle]} />

          {/* Brand icon */}
          <Animated.View style={iconStyle}>
            <Image
              source={brandIcon}
              style={ss.icon}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Wordmark */}
          <Animated.Text style={[ss.wordmark, wordmarkStyle]}>
            AkılCEP
          </Animated.Text>

          {/* Subtitle */}
          <Animated.View style={subtitleStyle}>
            <Text style={ss.subtitle}>cebindeki akıl</Text>
          </Animated.View>

        </View>

      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000000",
  },

  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // Vertically centered, sits at ~42% from top for optical balance
  center: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
    paddingBottom:  SH * 0.06,
  },

  // Soft radial glow — no border, just a shadow bloom
  glow: {
    position:        "absolute",
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "transparent",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.18,
    shadowRadius:    48,
  },

  icon: {
    width:  100,
    height: 100,
  },

  wordmark: {
    fontSize:      36,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.8,
  },

  subtitle: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.36)",
    letterSpacing: 4.8,
    textTransform: "uppercase",
    textAlign:     "center",
  },
});
