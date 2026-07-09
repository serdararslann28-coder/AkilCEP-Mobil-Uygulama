/**
 * AkılCEP — Continue Screen (auth method selection)
 *
 * Pure white, Apple HIG. Four auth options in the order specified:
 *   1. Apple ile Devam Et     — black pill (coming soon in Expo Go)
 *   2. Google ile Devam Et    — white pill with border + Google G
 *   3. E-posta ile Devam Et   — outline pill → /login
 *   4. Hesap Oluştur          — outline pill → /register
 *   5. Misafir link           — text-only
 *
 * Legal footer at bottom.
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
  withTiming,
} from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

// ── Google "G" mark ───────────────────────────────────────────────────────────
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const insets              = useSafeAreaInsets();
  const { continueAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);

  // Staggered entrance
  const headerOp = useSharedValue(0);
  const headerY  = useSharedValue(14);
  const stackOp  = useSharedValue(0);
  const legalOp  = useSharedValue(0);

  useEffect(() => {
    headerOp.value = withDelay(60,  withTiming(1, { duration: 560, easing: Easing.out(Easing.ease) }));
    headerY.value  = withDelay(60,  withTiming(0, { duration: 560, easing: Easing.out(Easing.ease) }));
    stackOp.value  = withDelay(260, withTiming(1, { duration: 520, easing: Easing.out(Easing.ease) }));
    legalOp.value  = withDelay(440, withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }));
  const stackStyle  = useAnimatedStyle(() => ({ opacity: stackOp.value }));
  const legalStyle  = useAnimatedStyle(() => ({ opacity: legalOp.value }));

  const haptic = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleApple = async () => {
    await haptic();
    Alert.alert(
      "Apple ile Giriş",
      "Bu özellik yakında kullanıma açılacak.",
      [{ text: "Tamam" }],
    );
  };

  const handleGoogle = async () => {
    await haptic();
    Alert.alert(
      "Google ile Giriş",
      "Bu özellik yakında kullanıma açılacak.",
      [{ text: "Tamam" }],
    );
  };

  const handleEmailLogin = async () => {
    await haptic();
    router.push("/login");
  };

  const handleRegister = async () => {
    await haptic();
    router.push("/register");
  };

  const handleGuest = async () => {
    await haptic();
    setGuestLoading(true);
    try {
      await continueAsGuest();
      router.replace("/interests");
    } finally {
      setGuestLoading(false);
    }
  };

  const topPad = insets.top + 16;
  const btmPad = insets.bottom + 16;

  return (
    <View style={[ss.root, { paddingTop: topPad, paddingBottom: btmPad }]}>
      <StatusBar style="dark" />

      {/* Header — leaf logo + title + subtitle */}
      <Animated.View style={[ss.header, headerStyle]}>
        <Image
          source={require("@/assets/images/leaf-only-transparent.png")}
          style={ss.logo}
          resizeMode="contain"
        />
        <Text style={ss.title}>{"AkılCEP'e\nHoş Geldin"}</Text>
        <Text style={ss.subtitle}>Devam etmek için bir yöntem seç.</Text>
      </Animated.View>

      {/* Button stack */}
      <Animated.View style={[ss.stack, stackStyle]}>

        {/* Apple — black */}
        <TouchableOpacity style={ss.btnBlack} onPress={handleApple} activeOpacity={0.85}>
          <View style={ss.iconWrap}>
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
          </View>
          <Text style={ss.labelWhite}>Apple ile Devam Et</Text>
          <View style={ss.iconWrap} />
        </TouchableOpacity>

        {/* Google — white with border */}
        <TouchableOpacity style={ss.btnWhite} onPress={handleGoogle} activeOpacity={0.85}>
          <View style={ss.iconWrap}>
            <GoogleIcon size={20} />
          </View>
          <Text style={ss.labelBlack}>Google ile Devam Et</Text>
          <View style={ss.iconWrap} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={ss.divider} />

        {/* Email login — outline */}
        <TouchableOpacity style={ss.btnOutline} onPress={handleEmailLogin} activeOpacity={0.85}>
          <View style={ss.iconWrap}>
            <Feather name="mail" size={20} color="#000000" />
          </View>
          <Text style={ss.labelBlack}>E-posta ile Giriş Yap</Text>
          <View style={ss.iconWrap} />
        </TouchableOpacity>

        {/* Create account — outline */}
        <TouchableOpacity style={ss.btnOutline} onPress={handleRegister} activeOpacity={0.85}>
          <View style={ss.iconWrap}>
            <Feather name="user-plus" size={20} color="#000000" />
          </View>
          <Text style={ss.labelBlack}>Hesap Oluştur</Text>
          <View style={ss.iconWrap} />
        </TouchableOpacity>

        {/* Guest — text only */}
        <TouchableOpacity
          onPress={handleGuest}
          disabled={guestLoading}
          activeOpacity={0.5}
          style={ss.guestBtn}
        >
          <Text style={ss.guestText}>
            {guestLoading ? "Yükleniyor..." : "Misafir olarak devam et"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Legal */}
      <Animated.View style={[ss.legalWrap, legalStyle]}>
        <Text style={ss.legal}>
          Devam ederek{" "}
          <Text style={ss.legalLink}>Kullanım Koşulları</Text>
          {" "}ve{" "}
          <Text style={ss.legalLink}>Gizlilik Politikası</Text>
          {"'nı"} kabul etmiş olursunuz.
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const BTN_H = 56;
const RADIUS = 28;

const ss = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   "#FFFFFF",
    paddingHorizontal: 24,
  },

  // Header
  header: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
  },
  logo: {
    width:        72,
    height:       72,
    marginBottom: 4,
  },
  title: {
    fontFamily:    "Inter_700Bold",
    fontSize:      36,
    letterSpacing: -1.5,
    color:         "#000000",
    textAlign:     "center",
    lineHeight:    43,
  },
  subtitle: {
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    letterSpacing: -0.1,
    color:         "#000000",
    opacity:       0.42,
    textAlign:     "center",
  },

  // Button stack
  stack: {
    gap: 10,
  },

  // Black fill — Apple
  btnBlack: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#000000",
    height:            BTN_H,
    borderRadius:      RADIUS,
    paddingHorizontal: 20,
  },
  // White fill with border — Google
  btnWhite: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#FFFFFF",
    height:            BTN_H,
    borderRadius:      RADIUS,
    paddingHorizontal: 20,
    borderWidth:       1,
    borderColor:       "#E5E5E5",
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.05,
    shadowRadius:      4,
    elevation:         1,
  },
  // Outline — Email / Register
  btnOutline: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "transparent",
    height:            BTN_H,
    borderRadius:      RADIUS,
    paddingHorizontal: 20,
    borderWidth:       1,
    borderColor:       "#E5E5E5",
  },

  labelWhite: {
    flex:          1,
    textAlign:     "center",
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },
  labelBlack: {
    flex:          1,
    textAlign:     "center",
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#000000",
    letterSpacing: -0.2,
  },

  iconWrap: {
    width:          20,
    alignItems:     "center",
    justifyContent: "center",
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "#E8E8E8",
    marginVertical:  2,
  },

  // Guest text link
  guestBtn: {
    alignItems:    "center",
    paddingVertical: 12,
  },
  guestText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      14,
    color:         "#000000",
    opacity:       0.38,
    letterSpacing: -0.1,
  },

  // Legal footer
  legalWrap: {
    paddingTop:        16,
    paddingHorizontal: 8,
  },
  legal: {
    fontFamily:    "Inter_400Regular",
    fontSize:      12,
    color:         "#000000",
    opacity:       0.38,
    textAlign:     "center",
    lineHeight:    18,
    letterSpacing: -0.1,
  },
  legalLink: {
    fontFamily: "Inter_500Medium",
    opacity:    0.6,
  },
});
