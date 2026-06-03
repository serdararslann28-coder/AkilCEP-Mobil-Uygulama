/**
 * Cinematic Splash — AkılCEP "Silent Intelligence"
 *
 * Animation timeline:
 *   0.00s  black screen
 *   0.30s  logo fades in (600 ms ease-out)
 *   0.80s  eclipse ring emerges (600 ms) + breathing pulse starts
 *   1.20s  water reflection appears (700 ms) + ripple oscillation begins
 *   1.80s  subtitle "cebindeki akıl" fades in (500 ms)
 *   2.20s  cinematic push-in zoom begins (scale 1.0 → 1.045 over 800 ms)
 *   2.70s  whole composition fades to black (300 ms)
 *   3.00s  navigate → onboarding (new user) or (tabs) (returning)
 *
 * No spinners. No progress indicators. Pure emotion.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router }         from "expo-router";
import { StatusBar }      from "expo-status-bar";
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ONBOARDING_KEY } from "@/app/onboarding";

// ── Dev flag — set true to always start from onboarding during testing ────────
const FORCE_SHOW_ONBOARDING = true;

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

const { width: SW, height: SH } = Dimensions.get("window");

// ── Eclipse geometry (identical to onboarding for visual continuity) ──────────
const ECLIPSE_D   = SW * 1.30;
const ECLIPSE_CY  = SH * 0.72;
const ECLIPSE_TOP = ECLIPSE_CY - ECLIPSE_D / 2;
const ECLIPSE_X   = (SW - ECLIPSE_D) / 2;

// Multi-layer bloom rings — outermost to crisp main ring
const ECLIPSE_LAYERS = [
  { extra: 140, bw: 52, op: 0.010 },
  { extra: 80,  bw: 32, op: 0.022 },
  { extra: 40,  bw: 16, op: 0.048 },
  { extra: 18,  bw:  8, op: 0.092 },
  { extra:  5,  bw:  4, op: 0.200 },
  { extra:  0,  bw:  2, op: 0.920 }, // crisp ring
];

// Reflection: rings positioned below the eclipse center, compressed vertically
const REFLECT_SCY = 0.30;
const REFLECT_OP  = 0.22;
const REFLECT_TOP = ECLIPSE_CY + ECLIPSE_D * 0.18;

// Stars — 32 deterministic positions in the upper 48% of screen
const STARS = Array.from({ length: 32 }, (_, i) => ({
  x:    ((i * 137.508) % 100) / 100 * SW,
  y:    (20 + (i * 79.3 + 13) % 42) / 100 * SH,
  size: i % 6 < 2 ? 1.0 : i % 6 < 4 ? 1.5 : 2.0,
  op:   0.12 + (i % 7) * 0.065,
}));

// ── Duration constants (ms) ───────────────────────────────────────────────────
const T_LOGO_IN    = 300;
const T_ECLIPSE_IN = 800;
const T_REFLECT_IN = 1200;
const T_SUBTITLE   = 1800;
const T_ZOOM       = 2200;
const T_FADE_OUT   = 2700;
const T_NAVIGATE   = 3000;

export default function SplashScreen() {
  // ── Audio — expo-av Audio.Sound ────────────────────────────────────────────
  // ffmpeg-processed: trimmed to 3.0 s, fade-in 0.5 s, fade-out 0.65 s @ 2.35 s,
  // gentle compression + low-pass 11 kHz (removes harsh "movie trailer" peaks).
  // Software volume ramps mirror the ffmpeg envelope for double-layer fade insurance.
  const soundRef = useRef<Audio.Sound | null>(null);

  // ── Animated values ────────────────────────────────────────────────────────
  const logoOp        = useSharedValue(0);
  const eclipseOp     = useSharedValue(0);
  const eclipseScale  = useSharedValue(1);
  const reflectOp     = useSharedValue(0);
  const rippleScaleX  = useSharedValue(1);
  const rippleOp      = useSharedValue(1);
  const subtitleOp    = useSharedValue(0);
  const fogOp         = useSharedValue(0);
  const cinemaScale   = useSharedValue(1);
  const masterOp      = useSharedValue(1);

  // Where to navigate — resolved from AsyncStorage before 3 s
  const destination = useRef<"/chat" | "/onboarding">("/onboarding");

  useEffect(() => {
    // Resolve destination — FORCE_SHOW_ONBOARDING bypasses saved state
    if (!FORCE_SHOW_ONBOARDING) {
      AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
        if (val) destination.current = "/chat";
      }).catch(() => {});
    }

    // ── Animation sequence ─────────────────────────────────────────────────

    // 0.3 s — logo emerges
    logoOp.value = withDelay(T_LOGO_IN,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );

    // 0.8 s — eclipse ring fades in
    eclipseOp.value = withDelay(T_ECLIPSE_IN,
      withTiming(1, { duration: 580, easing: Easing.out(Easing.ease) }),
    );

    // Eclipse breathing — starts gently after it appears (1.5 s)
    eclipseScale.value = withDelay(1500,
      withRepeat(
        withSequence(
          withTiming(1.020, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.980, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      ),
    );

    // Fog haze — subtle bloom behind eclipse, rises with it
    fogOp.value = withDelay(T_ECLIPSE_IN + 100,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }),
    );

    // 1.2 s — reflection appears
    reflectOp.value = withDelay(T_REFLECT_IN,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }),
    );

    // Water ripple — gentle horizontal oscillation starts at 1.4 s
    rippleScaleX.value = withDelay(1400,
      withRepeat(
        withSequence(
          withTiming(1.018, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.985, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.010, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.995, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, false,
      ),
    );

    // Reflection opacity shimmer
    rippleOp.value = withDelay(1400,
      withRepeat(
        withSequence(
          withTiming(0.80, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.00, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      ),
    );

    // 1.8 s — subtitle fades in
    subtitleOp.value = withDelay(T_SUBTITLE,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.ease) }),
    );

    // 2.2 s — cinematic push-in zoom (slow, subtle — like a cinema lens push)
    cinemaScale.value = withDelay(T_ZOOM,
      withTiming(1.045, { duration: 820, easing: Easing.out(Easing.ease) }),
    );

    // 2.7 s — fade entire composition to black
    masterOp.value = withDelay(T_FADE_OUT,
      withTiming(0, { duration: 320, easing: Easing.in(Easing.ease) }),
    );

    // ── Audio — expo-av Audio.Sound ────────────────────────────────────────────
    // Load the sound immediately so it's ready by 0.3 s.
    // All volume control goes through setVolumeAsync — no hook state needed.
    let rampInId:  ReturnType<typeof setInterval> | null = null;
    let rampOutId: ReturnType<typeof setInterval> | null = null;

    Audio.Sound.createAsync(
      require("@/assets/sounds/startup.mp3"),
      { shouldPlay: false, volume: 0, progressUpdateIntervalMillis: 80 },
    ).then(({ sound }) => {
      soundRef.current = sound;
    }).catch(() => {});

    // 0.3 s — start playback, ramp volume in over 500 ms (synced with logo fade)
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
    }, T_LOGO_IN);

    // 2.35 s — ramp volume out over 650 ms, synced with visual master fade
    const audioFade = setTimeout(() => {
      const s = soundRef.current;
      if (!s) return;
      const START = 0.85;
      const STEPS  = 26;
      const STEP_MS = 650 / STEPS;
      let step = 0;
      rampOutId = setInterval(() => {
        step++;
        s.setVolumeAsync(Math.max(0, START * (1 - step / STEPS))).catch(() => {});
        if (step >= STEPS) { clearInterval(rampOutId!); rampOutId = null; }
      }, STEP_MS);
    }, 2350);

    // 3.0 s — navigate
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

  // ── Animated styles ─────────────────────────────────────────────────────────
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value,
  }));

  const eclipseStyle = useAnimatedStyle(() => ({
    opacity:   eclipseOp.value,
    transform: [{ scale: eclipseScale.value }],
  }));

  const reflectStyle = useAnimatedStyle(() => ({
    opacity:   reflectOp.value * REFLECT_OP,
    transform: [
      { scaleY: REFLECT_SCY },
      { scaleX: rippleScaleX.value },
    ],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOp.value,
  }));

  const fogStyle = useAnimatedStyle(() => ({
    opacity: fogOp.value,
  }));

  const cinemaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cinemaScale.value }],
  }));

  const masterStyle = useAnimatedStyle(() => ({
    opacity: masterOp.value,
  }));

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* ── MASTER FADE WRAPPER — covers everything ── */}
      <Animated.View style={[StyleSheet.absoluteFill, masterStyle]}>

        {/* ── CINEMATIC ZOOM WRAPPER ── */}
        <Animated.View style={[StyleSheet.absoluteFill, cinemaStyle]}>

          {/* Stars */}
          {STARS.map((s, i) => (
            <View
              key={i}
              style={[
                ss.star,
                {
                  left:         s.x,
                  top:          s.y,
                  width:        s.size,
                  height:       s.size,
                  borderRadius: s.size / 2,
                  opacity:      s.op,
                },
              ]}
            />
          ))}

          {/* ── ECLIPSE ── */}
          <Animated.View style={[ss.abs, eclipseStyle]}>

            {/* Fog haze — soft column of luminance behind eclipse */}
            <Animated.View style={[ss.abs, fogStyle]} pointerEvents="none">
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.018)",
                  "rgba(255,255,255,0.036)",
                  "rgba(255,255,255,0.018)",
                  "transparent",
                ]}
                locations={[0, 0.30, 0.55, 0.75, 1.0]}
                style={[
                  ss.abs,
                  {
                    top:    SH * 0.38,
                    bottom: 0,
                  },
                ]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
              />
            </Animated.View>

            {/* Main eclipse bloom rings */}
            {ECLIPSE_LAYERS.map((l, i) => {
              const d  = ECLIPSE_D + l.extra;
              return (
                <View
                  key={i}
                  style={{
                    position:     "absolute",
                    top:          ECLIPSE_TOP - l.extra / 2,
                    left:         ECLIPSE_X - l.extra / 2,
                    width:        d,
                    height:       d,
                    borderRadius: d / 2,
                    borderWidth:  l.bw,
                    borderColor:  `rgba(255,255,255,${l.op})`,
                  }}
                />
              );
            })}

          </Animated.View>

          {/* ── WATER REFLECTION ── */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top:      REFLECT_TOP,
                left:     ECLIPSE_X,
                width:    ECLIPSE_D,
                height:   ECLIPSE_D,
              },
              reflectStyle,
            ]}
          >
            {ECLIPSE_LAYERS.map((l, i) => {
              const d = ECLIPSE_D + l.extra;
              return (
                <View
                  key={i}
                  style={{
                    position:     "absolute",
                    top:          -l.extra / 2,
                    left:         -l.extra / 2,
                    width:        d,
                    height:       d,
                    borderRadius: d / 2,
                    borderWidth:  l.bw,
                    borderColor:  `rgba(255,255,255,${l.op})`,
                  }}
                />
              );
            })}
          </Animated.View>

          {/* Landscape dark gradient — builds the atmospheric depth */}
          <LinearGradient
            colors={[
              "transparent",
              "rgba(0,0,0,0.25)",
              "rgba(0,0,0,0.68)",
              "#000000",
            ]}
            locations={[0.42, 0.58, 0.76, 1.0]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Sky vignette */}
          <LinearGradient
            colors={["rgba(0,0,0,0.60)", "transparent"]}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* ── LOGO + WORDMARK ── */}
          <Animated.View style={[ss.logoWrap, logoStyle]}>
            <Image
              source={leafLogo}
              style={ss.leafImg}
              tintColor="rgba(255,255,255,0.92)"
              resizeMode="contain"
            />
            <Text style={ss.wordmark}>AkılCEP</Text>
            <Animated.View style={subtitleStyle}>
              <Text style={ss.subtitle}>cebindeki akıl</Text>
            </Animated.View>
          </Animated.View>

        </Animated.View>

      </Animated.View>

    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000000",
  },
  abs: {
    ...StyleSheet.absoluteFillObject,
  },

  // Stars
  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // Logo area — centered in upper half of screen
  logoWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    height:         SH * 0.58,
    alignItems:     "center",
    justifyContent: "center",
    gap:            14,
  },
  leafImg: {
    width:  80,
    height: 80,
  },
  wordmark: {
    fontSize:      36,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: 4.5,
    textTransform: "uppercase",
    marginTop:     2,
    textAlign:     "center",
  },
});
