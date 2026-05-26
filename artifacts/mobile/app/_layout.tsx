import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary }  from "@/components/ErrorBoundary";
import { ChatProvider }   from "@/context/ChatContext";
import { ThemeProvider }  from "@/context/ThemeContext";
import { ONBOARDING_KEY } from "@/app/onboarding";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({ initialRoute }: { initialRoute: "onboarding" | "(tabs)" }) {
  return (
    <Stack initialRouteName={initialRoute}>
      {/* Onboarding — no gesture dismiss, no header */}
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, animation: "none", gestureEnabled: false }}
      />
      <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
      <Stack.Screen name="chat"    options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="voice"   options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen name="vision"  options={{ headerShown: false, animation: "fade",               presentation: "fullScreenModal" }} />
      <Stack.Screen name="profile" options={{ headerShown: false, animation: "slide_from_bottom" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const isWeb = Platform.OS === "web";

  // null = still checking AsyncStorage
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [ready,          setReady]          = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(v => setOnboardingDone(v === "true"))
      .catch(() => setOnboardingDone(false));
  }, []);

  // Gate on both fonts + onboarding check
  useEffect(() => {
    const fontsReady = fontsLoaded || !!fontError || isWeb;
    if (!fontsReady || onboardingDone === null) return;
    SplashScreen.hideAsync();
    setReady(true);
  }, [fontsLoaded, fontError, onboardingDone]);

  // Safety timeout — don't block render forever if fonts stall
  useEffect(() => {
    if (isWeb) return;
    const t = setTimeout(() => {
      if (!ready) {
        SplashScreen.hideAsync();
        setReady(true);
        if (onboardingDone === null) setOnboardingDone(false);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  if (!ready || onboardingDone === null) return null;

  const initialRoute: "onboarding" | "(tabs)" = onboardingDone ? "(tabs)" : "onboarding";

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <ChatProvider>
                  <RootLayoutNav initialRoute={initialRoute} />
                </ChatProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
