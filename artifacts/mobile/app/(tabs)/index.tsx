import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

const SUGGESTED_PROMPTS = [
  { icon: "zap" as const,        label: "Fikir üret",  text: "Bana yaratıcı bir iş fikri öner" },
  { icon: "book-open" as const,  label: "Özetle",      text: "Bu konuyu basitçe açıkla" },
  { icon: "code" as const,       label: "Kod yaz",     text: "Python'da bir uygulama yaz" },
  { icon: "edit-3" as const,     label: "Yaz",         text: "Profesyonel bir e-posta taslağı hazırla" },
  { icon: "search" as const,     label: "Araştır",     text: "Yapay zeka trendlerini analiz et" },
  { icon: "cpu" as const,        label: "Analiz et",   text: "Veri setimi yorumlamama yardım et" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { startNewConversation, sendMessage } = useChat();

  const orbScale   = useSharedValue(1);
  const shadowOpac = useSharedValue(0.10);

  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 3000 }), withTiming(1, { duration: 3000 })),
      -1, true
    );
    shadowOpac.value = withRepeat(
      withSequence(withTiming(0.18, { duration: 3000 }), withTiming(0.08, { duration: 3000 })),
      -1, true
    );
  }, []);

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    shadowOpacity: shadowOpac.value,
  }));

  const handlePrompt = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startNewConversation();
    sendMessage(text);
    router.push("/chat");
  };

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebarVisible(true);
          }}
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          hitSlop={8}
        >
          <Feather name="menu" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          hitSlop={8}
          onPress={() => {
            startNewConversation();
            router.push("/chat");
          }}
        >
          <Feather name="edit" size={17} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 130 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <Animated.View entering={FadeInUp.duration(700).delay(80)} style={styles.heroSection}>
          <Animated.View style={[styles.orbWrap, orbAnimStyle]}>
            <View style={[styles.orb, { backgroundColor: colors.foreground }]}>
              <View style={[styles.orbCenter, { backgroundColor: colors.background }]} />
            </View>
          </Animated.View>

          <Text style={[styles.appName, { color: colors.foreground }]}>AkılCEP AI</Text>
          <Text style={[styles.slogan, { color: colors.mutedForeground }]}>Cebindeki Akıl</Text>
        </Animated.View>

        {/* Prompt grid */}
        <Animated.View entering={FadeInDown.duration(500).delay(220)} style={styles.promptsGrid}>
          {SUGGESTED_PROMPTS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.promptCard, { backgroundColor: colors.card }]}
              onPress={() => handlePrompt(item.text)}
              activeOpacity={0.75}
            >
              <View style={[styles.promptIcon, { backgroundColor: colors.background }]}>
                <Feather name={item.icon} size={13} color={colors.zinc600} />
              </View>
              <Text style={[styles.promptLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.promptText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Floating input bar */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(350)}
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            marginBottom: bottomPad + 16,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.inputArea}
          activeOpacity={0.8}
          onPress={() => {
            startNewConversation();
            router.push("/chat");
          }}
        >
          <Text style={[styles.inputPlaceholder, { color: colors.mutedForeground }]}>
            AkılCEP'e sor...
          </Text>
        </TouchableOpacity>

        <View style={styles.inputActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.background }]}
            hitSlop={6}
          >
            <Feather name="paperclip" size={15} color={colors.zinc500} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.micBtn, { backgroundColor: colors.foreground }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/voice");
            }}
          >
            <Feather name="mic" size={16} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 0,
  },
  orbWrap: {
    marginBottom: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
  },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  orbCenter: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  appName: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.4,
    marginBottom: 6,
  },
  slogan: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.1,
  },

  promptsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  promptCard: {
    width: "47%",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  promptIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  promptLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  promptText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },

  inputBar: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
  },
  inputArea: {
    flex: 1,
    paddingVertical: 6,
  },
  inputPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
});
