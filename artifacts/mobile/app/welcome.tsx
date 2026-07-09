/**
 * Welcome — premium brand intro screen shown once before onboarding.
 *
 * Animation sequence (1 500 ms total):
 *   0 ms   brand icon fades in  (500 ms ease-out)
 *   420 ms "AkılCEP" fades in   (440 ms ease-out)
 *   800 ms "HOŞ GELDİN" fades in(380 ms ease-out)
 *   100 ms soft glow begins pulsing from first frame
 *   1 500 ms  navigate to /onboarding
 *
 * No buttons. No cards. No loading indicators.
 * Pure brand moment — then onboarding takes over.
 */
import { router }      from "expo-router";
import { StatusBar }   from "expo-status-bar";
import React, { useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const brandIcon = require("@/assets/images/akilcep-icon.png");

const { width: SW } = Dimensions.get("window");
const ICON_SIZE = SW * 0.38;

// ── Timing constants (ms) ─────────────────────────────────────────────────────
const T_ICON     =   0;
const T_BRAND    = 420;
const T_WELCOME  = 800;
const T_NAVIGATE = 1500;

export default function Welcome() {
  const { t } = useLanguage();

  // Fade-in values
  const iconOp    = useSharedValue(0);
  const brandOp   = useSharedValue(0);
  const welcomeOp = useSharedValue(0);

  // Glow pulse
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    // ── Fade sequence ───────────────────────────────────────────────────────
    iconOp.value = withDelay(T_ICON,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    brandOp.value = withDelay(T_BRAND,
      withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) }),
    );

    welcomeOp.value = withDelay(T_WELCOME,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.ease) }),
    );

    // ── Glow — begins with icon, slow continuous breathe ───────────────────
    glowPulse.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    // ── Navigate ────────────────────────────────────────────────────────────
    const nav = setTimeout(() => {
      router.replace("/onboarding");
    }, T_NAVIGATE);

    return () => clearTimeout(nav);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({ opacity: iconOp.value }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(glowPulse.value, [0, 1], [0.08, 0.22]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1.00, 1.08]) }],
  }));

  const brandStyle   = useAnimatedStyle(() => ({ opacity: brandOp.value }));
  const welcomeStyle = useAnimatedStyle(() => ({ opacity: welcomeOp.value }));

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* Center composition */}
      <View style={ss.center}>

        {/* Soft glow bloom — absolute, behind icon */}
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
        <Animated.Text style={[ss.wordmark, brandStyle]}>
          AkılCEP
        </Animated.Text>

        {/* Welcome line */}
        <Animated.Text style={[ss.welcome, welcomeStyle]}>
          {t("brand.welcomeGreeting")}
        </Animated.Text>

      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000000",
    alignItems:      "center",
    justifyContent:  "center",
  },

  center: {
    alignItems: "center",
    gap:        22,
  },

  // Radial glow bloom behind icon
  glow: {
    position:        "absolute",
    width:           ICON_SIZE * 1.55,
    height:          ICON_SIZE * 1.55,
    borderRadius:    ICON_SIZE * 0.775,
    backgroundColor: "rgba(255,255,255,0.05)",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.28,
    shadowRadius:    52,
  },

  icon: {
    width:  ICON_SIZE,
    height: ICON_SIZE,
  },

  wordmark: {
    fontSize:      34,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.9,
    marginTop:     4,
  },

  welcome: {
    fontSize:      11,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: 4.8,
    textTransform: "uppercase",
  },
});
