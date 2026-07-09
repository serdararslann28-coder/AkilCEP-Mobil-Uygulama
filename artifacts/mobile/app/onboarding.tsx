/**
 * AkılCEP — Onboarding (2 screens)
 *
 * Screen 1: large logo, title, subtitle, description → Başlayalım
 * Screen 2: closing title, description → AkılCEP'i Aç → saves flag, opens chat
 *
 * Apple HIG: white background, Inter typography, monochrome.
 * Crossfade animation between screens.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "@akilcep_onboarding_done";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage]   = useState<1 | 2>(1);
  const fadeOp            = useSharedValue(1);

  // Crossfade: out → swap content → in
  const goToPage2 = () => {
    fadeOp.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }, () => {
      "worklet";
      runOnJS(setPage)(2);
      fadeOp.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.ease) });
    });
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/chat");
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeOp.value }));

  return (
    <View style={[ss.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      <Animated.View style={[ss.fill, fadeStyle]}>
        {page === 1 ? (
          <Screen1 onPress={goToPage2} />
        ) : (
          <Screen2 onPress={finish} />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Screen 1 ─────────────────────────────────────────────────────────────────

function Screen1({ onPress }: { onPress: () => void }) {
  return (
    <View style={ss.screen}>
      {/* Large centered logo */}
      <View style={ss.logoSection}>
        <Image
          source={require("@/assets/images/logo-transparent.png")}
          style={ss.logoLarge}
          resizeMode="contain"
        />
      </View>

      {/* Text block */}
      <View style={ss.textSection}>
        <Text style={ss.title}>AkılCEP</Text>
        <Text style={ss.description}>
          {"Sor, üret, keşfet ve öğren.\nYapay zekâ artık her an yanında."}
        </Text>
      </View>

      {/* Bottom button */}
      <View style={ss.buttonSection}>
        <TouchableOpacity style={ss.btn} onPress={onPress} activeOpacity={0.85}>
          <Text style={ss.btnText}>Başlayalım</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen 2 ─────────────────────────────────────────────────────────────────

function Screen2({ onPress }: { onPress: () => void }) {
  return (
    <View style={ss.screen}>
      {/* Vertically centered text */}
      <View style={ss.s2Content}>
        <Text style={ss.s2Title}>Hazırsın.</Text>
        <Text style={ss.s2Description}>AkılCEP seni bekliyor.</Text>
      </View>

      {/* Bottom button */}
      <View style={ss.buttonSection}>
        <TouchableOpacity style={ss.btn} onPress={onPress} activeOpacity={0.85}>
          <Text style={ss.btnText}>AkılCEP'i Aç</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#FFFFFF",
  },
  fill: {
    flex: 1,
  },
  screen: {
    flex:    1,
    paddingBottom: 32,
  },

  // Screen 1 — logo area
  logoSection: {
    flex:           1.5,
    alignItems:     "center",
    justifyContent: "center",
  },
  logoLarge: {
    width:  220,
    height: 220,
  },

  // Screen 1 — text area
  textSection: {
    flex:              1,
    paddingHorizontal: 36,
    justifyContent:    "flex-start",
    gap:               10,
  },
  title: {
    fontFamily:    "Inter_700Bold",
    fontSize:      46,
    letterSpacing: -1.8,
    color:         "#000000",
    lineHeight:    52,
  },
  subtitle: {
    fontFamily:    "Inter_500Medium",
    fontSize:      18,
    letterSpacing: -0.3,
    color:         "#000000",
    opacity:       0.45,
  },
  description: {
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    lineHeight:    25,
    letterSpacing: -0.1,
    color:         "#000000",
    opacity:       0.38,
    marginTop:     6,
  },

  // Screen 2 — centred content
  s2Content: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 36,
    gap:               14,
  },
  s2Title: {
    fontFamily:    "Inter_700Bold",
    fontSize:      52,
    letterSpacing: -2.2,
    color:         "#000000",
    textAlign:     "center",
  },
  s2Description: {
    fontFamily:    "Inter_400Regular",
    fontSize:      17,
    lineHeight:    26,
    letterSpacing: -0.1,
    color:         "#000000",
    opacity:       0.38,
    textAlign:     "center",
  },

  // Button — shared across both screens
  buttonSection: {
    paddingHorizontal: 24,
    paddingBottom:     8,
  },
  btn: {
    backgroundColor: "#000000",
    height:          56,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
  },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },
});
