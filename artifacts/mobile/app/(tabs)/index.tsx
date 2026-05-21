import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
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

const logo = require("@/assets/images/logo-transparent.png");

const SUGGESTED_PROMPTS = [
  { icon: "zap" as const,       label: "Fikir üret",  text: "Bana yaratıcı bir iş fikri öner" },
  { icon: "book-open" as const, label: "Özetle",      text: "Bu konuyu basitçe açıkla" },
  { icon: "code" as const,      label: "Kod yaz",     text: "Python'da bir uygulama yaz" },
  { icon: "edit-3" as const,    label: "Yaz",         text: "Profesyonel bir e-posta taslağı hazırla" },
  { icon: "search" as const,    label: "Araştır",     text: "Yapay zeka trendlerini analiz et" },
  { icon: "cpu" as const,       label: "Analiz et",   text: "Veri setimi yorumlamama yardım et" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { startNewConversation, sendMessage } = useChat();

  // Ambient breathing around logo
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoFloat.value = withRepeat(
      withSequence(withTiming(-5, { duration: 2800 }), withTiming(5, { duration: 2800 })),
      -1, true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: logoFloat.value }] }));

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

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSidebarVisible(true); }}
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          hitSlop={8}
        >
          <Feather name="menu" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          hitSlop={8}
          onPress={() => { startNewConversation(); router.push("/chat"); }}
        >
          <Feather name="edit" size={17} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero / Logo ── */}
          <View style={styles.heroSection}>
            <Animated.View style={[styles.logoWrap, floatStyle]}>
              <Image
                source={logo}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* ── Divider ── */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* ── Prompt cards ── */}
          <View style={styles.promptsGrid}>
            {SUGGESTED_PROMPTS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.promptCard, { backgroundColor: colors.card }]}
                onPress={() => handlePrompt(item.text)}
                activeOpacity={0.72}
              >
                <View style={[styles.promptIconWrap, { backgroundColor: colors.background }]}>
                  <Feather name={item.icon} size={13} color={colors.zinc600} />
                </View>
                <Text style={[styles.promptLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <Text style={[styles.promptText, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Floating input bar ── */}
        <View
          style={[
            styles.inputBar,
            { backgroundColor: colors.card, marginBottom: bottomPad + 16 },
          ]}
        >
          <TouchableOpacity
            style={styles.inputTouchArea}
            activeOpacity={0.8}
            onPress={() => { startNewConversation(); router.push("/chat"); }}
          >
            <Text style={[styles.inputPlaceholder, { color: colors.mutedForeground }]}>
              AkılCEP'e sor...
            </Text>
          </TouchableOpacity>

          <View style={styles.inputActions}>
            <TouchableOpacity
              style={[styles.attachBtn, { backgroundColor: colors.background }]}
              hitSlop={6}
            >
              <Feather name="paperclip" size={15} color={colors.zinc500} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.micBtn, { backgroundColor: colors.foreground }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/voice"); }}
            >
              <Feather name="mic" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

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
    paddingTop: 4,
  },

  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 4,
  },
  logoWrap: {
    backgroundColor: "transparent",
  },
  logoImage: {
    width: 230,
    height: 178,
    backgroundColor: "transparent",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
    marginHorizontal: 4,
  },

  promptsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  promptCard: {
    width: "47%",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 10,
  },
  promptIconWrap: {
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
    marginHorizontal: 16,
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
  inputTouchArea: {
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
  attachBtn: {
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
