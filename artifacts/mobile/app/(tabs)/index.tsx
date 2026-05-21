import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
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
  { icon: "zap", label: "Fikir üret", text: "Bana yaratıcı bir iş fikri öner" },
  { icon: "book-open", label: "Özetle", text: "Bu konuyu basitçe açıkla" },
  { icon: "code", label: "Kod yaz", text: "Python'da bir uygulama yaz" },
  { icon: "edit-3", label: "Yaz", text: "Profesyonel bir e-posta taslağı hazırla" },
  { icon: "search", label: "Araştır", text: "Yapay zeka trendlerini analiz et" },
  { icon: "cpu", label: "Analiz et", text: "Veri setimi yorumlamama yardım et" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const { startNewConversation, sendMessage } = useChat();

  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.15);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 2800 }),
        withTiming(1, { duration: 2800 })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 2800 }),
        withTiming(0.12, { duration: 2800 })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const handlePrompt = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startNewConversation();
    sendMessage(text);
    router.push("/chat");
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    sendMessage(inputText.trim());
    setInputText("");
    router.push("/chat");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />

      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebarVisible(true);
          }}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Feather name="menu" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Feather name="edit" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.heroSection}>
          <View style={styles.orbContainer}>
            <Animated.View style={[styles.orbGlow, { backgroundColor: colors.primary }, glowStyle]} />
            <View style={[styles.orb, { borderColor: colors.zinc800 }]}>
              <View style={[styles.orbInner, { backgroundColor: colors.primary }]} />
            </View>
          </View>

          <Text style={[styles.appName, { color: colors.foreground }]}>AkılCEP AI</Text>
          <Text style={[styles.slogan, { color: colors.mutedForeground }]}>Cebindeki Akıl</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.promptsGrid}>
          {SUGGESTED_PROMPTS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.promptCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handlePrompt(item.text)}
              activeOpacity={0.7}
            >
              <View style={[styles.promptIcon, { backgroundColor: colors.accent }]}>
                <Feather name={item.icon as any} size={14} color={colors.zinc300} />
              </View>
              <Text style={[styles.promptLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.promptText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.duration(400).delay(300)}
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            marginBottom: bottomPad + 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.inputArea]}
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
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            hitSlop={6}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Feather name="paperclip" size={16} color={colors.zinc400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.micBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/voice");
            }}
          >
            <Feather name="mic" size={17} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 36,
  },
  orbContainer: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  orbGlow: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orbInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.2,
    marginBottom: 6,
  },
  slogan: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  promptsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  promptCard: {
    width: "47%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  promptIcon: {
    width: 32,
    height: 32,
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
    borderRadius: 26,
    borderWidth: 1,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 10,
    gap: 8,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
