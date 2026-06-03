/**
 * Auth — premium sign-in screen.
 *
 * Visual language mirrors the onboarding: pure black (#050505), white
 * typography, soft glow rings, cinematic spacing. No heavy backgrounds —
 * the AkılCEP logo floats in darkness above the auth buttons.
 *
 * All providers call enterApp() which marks onboarding done and routes
 * to /chat. Real OAuth flows can be wired into each handler independently.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect } from "react";
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
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_KEY } from "@/app/onboarding";

const LOGO = require("@/assets/images/akilcep-icon.png");

const { width: SW, height: SH } = Dimensions.get("window");

// ── Complete onboarding + auth flow ──────────────────────────────────────────
async function enterApp() {
  try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
  router.replace("/chat");
}

// ── Glow ring — reusable pulsing ring ────────────────────────────────────────
function GlowRing({ size, delay, minOp, maxOp }: {
  size:  number;
  delay: number;
  minOp: number;
  maxOp: number;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withDelay(delay,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   interpolate(pulse.value, [0, 1], [minOp, maxOp]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.07]) }],
  }));

  return (
    <Animated.View style={[
      ss.glowRing,
      { width: size, height: size, borderRadius: size / 2 },
      style,
    ]} />
  );
}

// ── Auth button ───────────────────────────────────────────────────────────────
interface AuthBtnProps {
  icon:      React.ReactElement;
  label:     string;
  primary?:  boolean;
  onPress:   () => void;
}

function AuthButton({ icon, label, primary, onPress }: AuthBtnProps) {
  const handlePress = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  if (primary) {
    return (
      <TouchableOpacity style={ss.btnPrimary} onPress={handlePress} activeOpacity={0.84}>
        <View style={ss.btnIcon}>{icon}</View>
        <Text style={ss.btnPrimaryLabel}>{label}</Text>
        <View style={ss.btnSpacer} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={ss.btnGlass} onPress={handlePress} activeOpacity={0.72}>
      <View style={ss.btnIcon}>{icon}</View>
      <Text style={ss.btnGlassLabel}>{label}</Text>
      <View style={ss.btnSpacer} />
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Auth() {
  const insets = useSafeAreaInsets();

  const handleApple  = useCallback(() => enterApp(), []);
  const handleGoogle = useCallback(() => enterApp(), []);
  const handleEmail  = useCallback(() => enterApp(), []);
  const handleCreate = useCallback(() => enterApp(), []);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* Ambient glow behind logo */}
      <View style={[ss.glowCenter, { top: SH * 0.18 }]}>
        <GlowRing size={260} delay={0}    minOp={0.03} maxOp={0.11} />
        <GlowRing size={160} delay={400}  minOp={0.05} maxOp={0.18} />
        <GlowRing size={80}  delay={800}  minOp={0.08} maxOp={0.26} />
      </View>

      {/* Logo */}
      <View style={[ss.logoArea, { paddingTop: topPad + 48 }]}>
        <Image source={LOGO} style={ss.logo} resizeMode="contain" />
        <Text style={ss.brand}>AkılCEP</Text>
        <Text style={ss.tagline}>Cebindeki akıl, her zaman yanında.</Text>
      </View>

      {/* Divider */}
      <View style={ss.dividerRow}>
        <View style={ss.dividerLine} />
        <Text style={ss.dividerText}>Giriş yap veya hesap oluştur</Text>
        <View style={ss.dividerLine} />
      </View>

      {/* Auth buttons */}
      <View style={[ss.btnStack, { paddingBottom: btmPad + 20 }]}>

        <AuthButton
          primary
          icon={<AntDesign name="apple" size={19} color="#000" />}
          label="Apple ile Devam Et"
          onPress={handleApple}
        />

        <AuthButton
          icon={<AntDesign name="google" size={17} color="rgba(255,255,255,0.80)" />}
          label="Google ile Devam Et"
          onPress={handleGoogle}
        />

        <View style={ss.btnDivider} />

        <AuthButton
          icon={<Feather name="mail" size={17} color="rgba(255,255,255,0.70)" />}
          label="E-posta ile Giriş"
          onPress={handleEmail}
        />

        <AuthButton
          icon={<Feather name="user-plus" size={17} color="rgba(255,255,255,0.50)" />}
          label="Hesap Oluştur"
          onPress={handleCreate}
        />

        {/* Legal */}
        <Text style={ss.legal}>
          Devam ederek{" "}
          <Text style={ss.legalLink}>Kullanım Şartları</Text>
          {" "}ve{" "}
          <Text style={ss.legalLink}>Gizlilik Politikası</Text>
          {"'nı kabul edersiniz."}
        </Text>

      </View>

      {/* Bottom fade — softens the button area edge */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.60)"]}
        style={ss.bottomFade}
        pointerEvents="none"
      />

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const BTN_W = SW - 48;

const ss = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#050505",
    alignItems:      "center",
  },

  // Glow rings container
  glowCenter: {
    position:       "absolute",
    left:           SW / 2 - 130,
    alignItems:     "center",
    justifyContent: "center",
    width:          260,
    height:         260,
  },
  glowRing: {
    position:        "absolute",
    borderWidth:     1,
    borderColor:     "#FFFFFF",
    backgroundColor: "transparent",
  },

  // Logo section
  logoArea: {
    alignItems: "center",
    gap:        10,
    flex:       1,
  },
  logo: {
    width:  104,
    height: 104,
  },
  brand: {
    fontSize:      30,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -0.8,
    marginTop:     4,
  },
  tagline: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: -0.1,
    textAlign:     "center",
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems:    "center",
    paddingHorizontal: 24,
    gap:           12,
    marginBottom:  20,
    width:         "100%",
  },
  dividerLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.28)",
    letterSpacing: -0.1,
  },

  // Button stack
  btnStack: {
    width:           "100%",
    paddingHorizontal: 24,
    gap:             10,
    alignItems:      "center",
  },

  // Primary — white fill (Apple)
  btnPrimary: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "#FFFFFF",
    borderRadius:    14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width:           BTN_W,
  },
  btnPrimaryLabel: {
    flex:          1,
    textAlign:     "center",
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#000000",
    letterSpacing: -0.3,
    marginLeft:    -24,   // compensate icon width to visually center label
  },

  // Glass — outline (Google, Email)
  btnGlass: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "rgba(255,255,255,0.05)",
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.18)",
    borderRadius:      14,
    paddingVertical:   16,
    paddingHorizontal: 20,
    width:             BTN_W,
  },
  btnGlassLabel: {
    flex:          1,
    textAlign:     "center",
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    color:         "rgba(255,255,255,0.78)",
    letterSpacing: -0.2,
    marginLeft:    -24,
  },

  btnIcon: {
    width:          24,
    alignItems:     "center",
    justifyContent: "center",
  },
  btnSpacer: { width: 24 },

  btnDivider: {
    width:           BTN_W,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical:  2,
  },

  legal: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "rgba(255,255,255,0.22)",
    textAlign:     "center",
    lineHeight:    18,
    paddingHorizontal: 16,
    marginTop:     6,
  },
  legalLink: {
    color: "rgba(255,255,255,0.40)",
  },

  // Gradient fade at very bottom
  bottomFade: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   80,
  },
});
