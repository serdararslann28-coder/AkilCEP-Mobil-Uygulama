/**
 * AkılCEP — Ready Screen (final onboarding step)
 *
 * Pure white, Apple HIG. Animated welcome greeting by first name.
 * "AkılCEP'i Aç" saves onboarding completion flag → /chat.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
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

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ONBOARDING_KEY } from "@/app/onboarding";

export default function ReadyScreen() {
  const insets    = useSafeAreaInsets();
  const { user }  = useAuth();
  const { t }      = useLanguage();
  const [loading, setLoading] = useState(false);

  // Derive display first name
  const displayName =
    user?.firstName ??
    (user?.fullName ? user.fullName.split(" ")[0] : null) ??
    "AkılCEP";

  // Staggered entrance
  const greetOp  = useSharedValue(0);
  const greetY   = useSharedValue(24);
  const nameOp   = useSharedValue(0);
  const nameY    = useSharedValue(16);
  const subOp    = useSharedValue(0);
  const btnOp    = useSharedValue(0);

  useEffect(() => {
    greetOp.value = withDelay(80,  withTiming(1, { duration: 680, easing: Easing.out(Easing.ease) }));
    greetY.value  = withDelay(80,  withTiming(0, { duration: 680, easing: Easing.out(Easing.ease) }));
    nameOp.value  = withDelay(300, withTiming(1, { duration: 640, easing: Easing.out(Easing.ease) }));
    nameY.value   = withDelay(300, withTiming(0, { duration: 640, easing: Easing.out(Easing.ease) }));
    subOp.value   = withDelay(520, withTiming(1, { duration: 560, easing: Easing.out(Easing.ease) }));
    btnOp.value   = withDelay(760, withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }));
  }, []);

  const greetStyle = useAnimatedStyle(() => ({
    opacity:   greetOp.value,
    transform: [{ translateY: greetY.value }],
  }));
  const nameStyle  = useAnimatedStyle(() => ({
    opacity:   nameOp.value,
    transform: [{ translateY: nameY.value }],
  }));
  const subStyle   = useAnimatedStyle(() => ({ opacity: subOp.value }));
  const btnStyle   = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  const handleOpen = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLoading(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      router.replace("/chat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        ss.root,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar style="dark" />

      <View style={ss.content}>
        <Animated.Text style={[ss.greeting, greetStyle]}>
          {t("ready.greeting")}
        </Animated.Text>
        <Animated.Text style={[ss.name, nameStyle]}>
          {displayName}{"!"}
        </Animated.Text>
        <Animated.Text style={[ss.subtitle, subStyle]}>
          {t("ready.subtitle")}
        </Animated.Text>
      </View>

      <Animated.View style={[ss.btnWrap, btnStyle]}>
        <TouchableOpacity
          style={[ss.btn, loading && ss.btnOff]}
          onPress={handleOpen}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={ss.btnText}>
            {loading ? t("ready.opening") : t("ready.open")}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   "#FFFFFF",
    paddingHorizontal: 28,
  },

  content: {
    flex:          1,
    justifyContent: "center",
    gap:           4,
  },
  greeting: {
    fontFamily:    "Inter_400Regular",
    fontSize:      34,
    letterSpacing: -1.2,
    color:         "#000000",
    opacity:       0.5,
    lineHeight:    44,
  },
  name: {
    fontFamily:    "Inter_700Bold",
    fontSize:      52,
    letterSpacing: -2.2,
    color:         "#000000",
    lineHeight:    60,
    marginBottom:  12,
  },
  subtitle: {
    fontFamily:    "Inter_400Regular",
    fontSize:      18,
    color:         "#000000",
    opacity:       0.38,
    letterSpacing: -0.2,
    lineHeight:    26,
  },

  btnWrap: { paddingBottom: 8 },
  btn: {
    backgroundColor: "#000000",
    height:          56,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
  },
  btnOff: { opacity: 0.38 },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },
});
