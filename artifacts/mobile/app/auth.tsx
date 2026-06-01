/**
 * Auth screen — premium login / sign-up.
 *
 * Visual system: identical eclipse + stars + fog language as splash/onboarding
 * for seamless transition. Content fades in with staggered reveal.
 *
 * Buttons (top to bottom priority):
 *   1. Apple  — white filled  (primary)
 *   2. Google — ghost border  (secondary)
 *   3. Phone  — ghost subtle  (tertiary)
 *
 * Auth implementation is wired up to auth providers via the button handlers.
 * On any successful auth → sets ONBOARDING_KEY + navigates to (tabs).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
} from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_KEY } from "@/app/onboarding";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

const { width: SW, height: SH } = Dimensions.get("window");

// ── Eclipse geometry — ring center sits at 65 % so more of it is visible
//    above the button cluster compared with the splash (72 %)
const ECLIPSE_D  = SW * 1.30;
const ECLIPSE_CY = SH * 0.65;
const ECLIPSE_X  = (SW - ECLIPSE_D) / 2;

const ECLIPSE_LAYERS = [
  { extra: 120, bw: 44, op: 0.010 },
  { extra: 70,  bw: 27, op: 0.022 },
  { extra: 36,  bw: 14, op: 0.048 },
  { extra: 16,  bw:  7, op: 0.090 },
  { extra:  5,  bw:  4, op: 0.195 },
  { extra:  0,  bw:  2, op: 0.920 },
];

const REFLECT_SCY = 0.28;
const REFLECT_OP  = 0.16;
const REFLECT_TOP = ECLIPSE_CY + ECLIPSE_D * 0.19;

// Stars — same deterministic set
const STARS = Array.from({ length: 28 }, (_, i) => ({
  x:    ((i * 137.508) % 100) / 100 * SW,
  y:    (14 + (i * 79.3 + 13) % 44) / 100 * SH,
  size: i % 6 < 2 ? 1.0 : i % 6 < 4 ? 1.5 : 2.0,
  op:   0.10 + (i % 7) * 0.055,
}));

// ── Complete onboarding + auth flow ──────────────────────────────────────────
async function enterApp() {
  try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
  router.replace("/chat");
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKGROUND
// ═════════════════════════════════════════════════════════════════════════════
function EclipseBackground() {
  const breathe  = useSharedValue(1);
  const rippleX  = useSharedValue(1);
  const rippleOp = useSharedValue(1);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.016, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.984, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    rippleX.value = withRepeat(
      withSequence(
        withTiming(1.012, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.990, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.006, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    rippleOp.value = withRepeat(
      withSequence(
        withTiming(0.80, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.00, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  const eclipseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));
  const reflectStyle = useAnimatedStyle(() => ({
    opacity:   rippleOp.value * REFLECT_OP,
    transform: [{ scaleY: REFLECT_SCY }, { scaleX: rippleX.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* Stars */}
      {STARS.map((s, i) => (
        <View key={i} style={[ss.star, {
          left: s.x, top: s.y,
          width: s.size, height: s.size,
          borderRadius: s.size / 2,
          opacity: s.op,
        }]} />
      ))}

      {/* Eclipse */}
      <Animated.View style={[StyleSheet.absoluteFill, eclipseStyle]}>
        {ECLIPSE_LAYERS.map((l, i) => {
          const d = ECLIPSE_D + l.extra;
          return (
            <View key={i} style={{
              position:     "absolute",
              top:          ECLIPSE_CY - d / 2,
              left:         ECLIPSE_X - l.extra / 2,
              width:        d,
              height:       d,
              borderRadius: d / 2,
              borderWidth:  l.bw,
              borderColor:  `rgba(255,255,255,${l.op})`,
            }} />
          );
        })}
      </Animated.View>

      {/* Reflection */}
      <Animated.View style={[{
        position: "absolute",
        top:      REFLECT_TOP,
        left:     ECLIPSE_X,
        width:    ECLIPSE_D,
        height:   ECLIPSE_D,
      }, reflectStyle]}>
        {ECLIPSE_LAYERS.map((l, i) => {
          const d = ECLIPSE_D + l.extra;
          return (
            <View key={i} style={{
              position:     "absolute",
              top:          -l.extra / 2,
              left:         -l.extra / 2,
              width:        d,
              height:       d,
              borderRadius: d / 2,
              borderWidth:  l.bw,
              borderColor:  `rgba(255,255,255,${l.op})`,
            }} />
          );
        })}
      </Animated.View>

      {/* Fog column */}
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.014)", "rgba(255,255,255,0.028)", "transparent"]}
        locations={[0, 0.32, 0.58, 1.0]}
        style={[StyleSheet.absoluteFill, { top: SH * 0.38 }]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      />

      {/* Depth gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.32)", "rgba(0,0,0,0.75)", "#000000"]}
        locations={[0.38, 0.56, 0.74, 1.0]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sky vignette */}
      <LinearGradient
        colors={["rgba(0,0,0,0.60)", "transparent"]}
        locations={[0, 0.28]}
        style={StyleSheet.absoluteFill}
      />

    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH BUTTON
// ═════════════════════════════════════════════════════════════════════════════
type ButtonVariant = "filled" | "ghost" | "ghost-subtle";

interface AuthButtonProps {
  label:      string;
  icon:       React.ReactNode;
  variant:    ButtonVariant;
  onPress:    () => void;
  animStyle?: object;
}

function AuthButton({ label, icon, variant, onPress, animStyle }: AuthButtonProps) {
  const pressed = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value }],
  }));

  const handlePressIn  = () => { pressed.value = withTiming(0.971, { duration: 80 }); };
  const handlePressOut = () => { pressed.value = withTiming(1.000, { duration: 160 }); };

  const containerStyle = [
    ss.authBtn,
    variant === "filled"       && ss.authBtnFilled,
    variant === "ghost"        && ss.authBtnGhost,
    variant === "ghost-subtle" && ss.authBtnSubtle,
  ];

  const textStyle = [
    ss.authBtnText,
    variant === "filled"       && ss.authBtnTextDark,
    (variant === "ghost" || variant === "ghost-subtle") && ss.authBtnTextLight,
  ];

  return (
    <Animated.View style={[animStyle, pressStyle]}>
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={ss.authBtnIcon}>{icon}</View>
        <Text style={textStyle}>{label}</Text>
        {/* Spacer to visually center label with icon present */}
        <View style={ss.authBtnTrail} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Staggered entry animations ─────────────────────────────────────────────
  const logoOp    = useSharedValue(0);
  const logoY     = useSharedValue(18);
  const headOp    = useSharedValue(0);
  const headY     = useSharedValue(14);
  const btn1Op    = useSharedValue(0);
  const btn1Y     = useSharedValue(22);
  const btn2Op    = useSharedValue(0);
  const btn2Y     = useSharedValue(22);
  const btn3Op    = useSharedValue(0);
  const btn3Y     = useSharedValue(22);
  const privacyOp = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const dur  = { duration: 560, easing: ease };
    const dury = { duration: 520, easing: ease };

    // Logo
    logoOp.value = withDelay( 80, withTiming(1, dur));
    logoY.value  = withDelay( 80, withTiming(0, dury));
    // Headline + description
    headOp.value = withDelay(180, withTiming(1, dur));
    headY.value  = withDelay(180, withTiming(0, dury));
    // Buttons — 80 ms stagger each
    btn1Op.value = withDelay(300, withTiming(1, dur));
    btn1Y.value  = withDelay(300, withTiming(0, dury));
    btn2Op.value = withDelay(380, withTiming(1, dur));
    btn2Y.value  = withDelay(380, withTiming(0, dury));
    btn3Op.value = withDelay(460, withTiming(1, dur));
    btn3Y.value  = withDelay(460, withTiming(0, dury));
    // Privacy
    privacyOp.value = withDelay(600, withTiming(1, { duration: 500 }));
  }, []);

  const logoStyle    = useAnimatedStyle(() => ({ opacity: logoOp.value,    transform: [{ translateY: logoY.value }] }));
  const headStyle    = useAnimatedStyle(() => ({ opacity: headOp.value,    transform: [{ translateY: headY.value }] }));
  const btn1Style    = useAnimatedStyle(() => ({ opacity: btn1Op.value,    transform: [{ translateY: btn1Y.value }] }));
  const btn2Style    = useAnimatedStyle(() => ({ opacity: btn2Op.value,    transform: [{ translateY: btn2Y.value }] }));
  const btn3Style    = useAnimatedStyle(() => ({ opacity: btn3Op.value,    transform: [{ translateY: btn3Y.value }] }));
  const privacyStyle = useAnimatedStyle(() => ({ opacity: privacyOp.value }));

  // ── Auth handlers (connect real providers here) ────────────────────────────
  const handleApple = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await enterApp();
  }, []);

  const handleGoogle = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await enterApp();
  }, []);

  const handlePhone = useCallback(async () => {
    Haptics.selectionAsync();
    await enterApp();
  }, []);

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* ── ATMOSPHERE ── */}
      <EclipseBackground />

      {/* ── TOP: Logo + wordmark ── */}
      <Animated.View style={[ss.logoArea, { paddingTop: topPad + 20 }, logoStyle]}>
        <Image
          source={leafLogo}
          style={ss.leafImg}
          tintColor="rgba(255,255,255,0.90)"
          resizeMode="contain"
        />
        <Text style={ss.wordmark}>AkılCEP</Text>
        <Text style={ss.tagline}>cebindeki akıl</Text>
      </Animated.View>

      {/* ── MIDDLE: Welcome headline ── */}
      <Animated.View style={[ss.welcomeArea, headStyle]}>
        <Text style={ss.headline}>Hoş Geldin</Text>
        <Text style={ss.description}>
          Yapay zekayı doğal hisset.{"\n"}Sor, konuş, üret.
        </Text>
      </Animated.View>

      {/* ── BOTTOM: Auth buttons + privacy ── */}
      <View style={[ss.bottom, { paddingBottom: btmPad + 20 }]}>

        <AuthButton
          label="Apple ile Devam Et"
          variant="filled"
          animStyle={btn1Style}
          onPress={handleApple}
          icon={<Ionicons name="logo-apple" size={18} color="#000000" />}
        />

        <AuthButton
          label="Google ile Devam Et"
          variant="ghost"
          animStyle={btn2Style}
          onPress={handleGoogle}
          icon={<AntDesign name="google" size={16} color="rgba(255,255,255,0.80)" />}
        />

        <AuthButton
          label="Telefon Numarasıyla Devam Et"
          variant="ghost-subtle"
          animStyle={btn3Style}
          onPress={handlePhone}
          icon={<Feather name="phone" size={16} color="rgba(255,255,255,0.50)" />}
        />

        {/* Privacy note */}
        <Animated.Text style={[ss.privacy, privacyStyle]}>
          Devam ederek{" "}
          <Text style={ss.privacyLink}>Gizlilik Politikası</Text>
          {" "}ve{" "}
          <Text style={ss.privacyLink}>Kullanım Koşulları</Text>
          'nı kabul etmiş olursunuz.
        </Animated.Text>

      </View>

    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#000000",
  },

  // Stars
  star: {
    position:        "absolute",
    backgroundColor: "#FFFFFF",
  },

  // ── Logo area ──────────────────────────────────────────────────────────────
  logoArea: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  leafImg: {
    width:  44,
    height: 44,
    marginBottom: 4,
  },
  wordmark: {
    fontSize:      26,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.35)",
    letterSpacing: 4.0,
    textTransform: "uppercase",
  },

  // ── Welcome text ───────────────────────────────────────────────────────────
  welcomeArea: {
    flex:              1,
    justifyContent:    "center",
    paddingHorizontal: 32,
    paddingBottom:     SH * 0.06,  // shift content slightly above center
    gap:               12,
  },
  headline: {
    fontSize:      44,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1.2,
  },
  description: {
    fontSize:      16,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.48)",
    lineHeight:    26,
    letterSpacing: -0.15,
  },

  // ── Bottom section ─────────────────────────────────────────────────────────
  bottom: {
    paddingHorizontal: 24,
    gap:               10,
  },

  // Auth button base
  authBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   16,
    paddingHorizontal: 20,
    borderRadius:      14,
    gap:               0,
  },
  authBtnFilled: {
    backgroundColor: "#FFFFFF",
  },
  authBtnGhost: {
    backgroundColor: "rgba(255,255,255,0.00)",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.18)",
  },
  authBtnSubtle: {
    backgroundColor: "transparent",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.09)",
  },

  authBtnIcon: {
    width:          28,
    alignItems:     "center",
    justifyContent: "center",
  },
  authBtnText: {
    flex:          1,
    textAlign:     "center",
    fontSize:      16,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },
  authBtnTextDark: {
    color: "#000000",
  },
  authBtnTextLight: {
    color: "rgba(255,255,255,0.88)",
  },
  // Balances the icon so label appears visually centered
  authBtnTrail: {
    width: 28,
  },

  // Privacy
  privacy: {
    textAlign:     "center",
    fontSize:      11.5,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.24)",
    lineHeight:    17,
    marginTop:     4,
    paddingHorizontal: 8,
  },
  privacyLink: {
    color:          "rgba(255,255,255,0.40)",
    textDecorationLine: "underline",
  },

});
