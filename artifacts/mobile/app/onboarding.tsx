/**
 * AkılCEP — Welcome Screen (onboarding step 1)
 *
 * Pure white, Apple HIG. Large leaf logo, brand title, description, and
 * a single black "Başlayalım" pill that leads to the auth / continue screen.
 *
 * Exports ONBOARDING_KEY so splash.tsx and ready.tsx can read / set the flag.
 */
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_KEY = "@akilcep_onboarding_done";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  // Staggered entrance
  // Reanimated can be unavailable while Expo's web preview is hydrating.
  // Start visible there so a failed animation cannot turn the whole screen
  // into a blank white page. Native keeps the intended entrance animation.
  const logoOp  = useSharedValue(Platform.OS === "web" ? 1 : 0);
  const logoY   = useSharedValue(Platform.OS === "web" ? 0 : 16);
  const textOp  = useSharedValue(Platform.OS === "web" ? 1 : 0);
  const textY   = useSharedValue(Platform.OS === "web" ? 0 : 12);
  const btnOp   = useSharedValue(Platform.OS === "web" ? 1 : 0);

  useEffect(() => {
    logoOp.value = withDelay(80,  withTiming(1, { duration: 640, easing: Easing.out(Easing.ease) }));
    logoY.value  = withDelay(80,  withTiming(0, { duration: 640, easing: Easing.out(Easing.ease) }));
    textOp.value = withDelay(320, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
    textY.value  = withDelay(320, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }));
    btnOp.value  = withDelay(580, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity:   logoOp.value,
    transform: [{ translateY: logoY.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity:   textOp.value,
    transform: [{ translateY: textY.value }],
  }));
  const btnStyle  = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  return (
    <View
      style={[
        ss.root,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar style="dark" />

      {/* Logo */}
      <Animated.View style={[ss.logoSection, logoStyle]}>
        <Image
          source={require("@/assets/images/leaf-only-transparent.png")}
          style={ss.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Text block */}
      <Animated.View style={[ss.textSection, textStyle]}>
        <Text style={ss.title}>AkılCEP</Text>
        <Text style={ss.subtitle}>Cebindeki Akıl</Text>
        <Text style={ss.description}>
          {"Sor, üret, keşfet ve öğren.\nYapay zekâ artık her an yanında."}
        </Text>
      </Animated.View>

      {/* Button */}
      <Animated.View style={[ss.btnSection, btnStyle]}>
        <TouchableOpacity
          style={ss.btn}
          onPress={() => router.push("/auth")}
          activeOpacity={0.85}
        >
          <Text style={ss.btnText}>Başlayalım</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#FFFFFF",
  },

  logoSection: {
    flex:           1.6,
    alignItems:     "center",
    justifyContent: "center",
  },
  logo: {
    width:  220,
    height: 220,
  },

  textSection: {
    flex:              1,
    paddingHorizontal: 34,
    gap:               10,
    justifyContent:    "flex-start",
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
    opacity:       0.42,
  },
  description: {
    fontFamily:    "Inter_400Regular",
    fontSize:      16,
    lineHeight:    25,
    letterSpacing: -0.1,
    color:         "#000000",
    opacity:       0.35,
    marginTop:     4,
  },

  btnSection: {
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
