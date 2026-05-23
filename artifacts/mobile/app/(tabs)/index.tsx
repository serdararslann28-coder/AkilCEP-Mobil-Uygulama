/**
 * Home — clean AI assistant home screen.
 * Input area + suggestion cards + quick actions.
 * Uses useColors() for theming. Voice Mode is a separate modal screen (/voice).
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

// ─── Suggestion prompts ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "zap"      , label: "Kod yaz"   , sub: "Kod üret veya düzelt"   , prompt: "Basit bir React bileşeni yaz" },
  { icon: "file-text", label: "Özet çıkar", sub: "Metni kısalt ve özetle" , prompt: "Bu metni özetle: " },
  { icon: "cpu"      , label: "Analiz et" , sub: "Derin analiz yap"       , prompt: "Bunu analiz et: " },
  { icon: "globe"    , label: "Çeviri yap", sub: "Dil çevirisi"           , prompt: "İngilizce'ye çevir: " },
] as const;

export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { startNewConversation, sendMessage } = useChat();

  const [inputText, setInputText] = useState("");
  const [sidebar, setSidebar]     = useState(false);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 36 : insets.bottom;

  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  // Send a message, navigate to chat
  const handleSend = (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.82, { duration: 80 }, () => {
      sendScale.value = withSpring(1, { duration: 120 });
    });
    startNewConversation();
    sendMessage(msg);
    setInputText("");
    router.push("/chat");
  };

  const hasText = inputText.trim().length > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Sidebar visible={sidebar} onClose={() => setSidebar(false)} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebar(true);
          }}
          hitSlop={12}
        >
          <Feather name="menu" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.brandRow}>
          <Text style={[styles.brandName, { color: colors.foreground }]}>
            AkılCEP
          </Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={[styles.onlineLabel, { color: colors.zinc400 }]}>
              çevrimiçi
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            startNewConversation();
            router.push("/chat");
          }}
          hitSlop={12}
        >
          <Feather name="edit-2" size={15} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: btmPad + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Greeting ───────────────────────────────────────────────────── */}
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            Merhaba 👋
          </Text>
          <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>
            Size nasıl yardımcı olabilirim?
          </Text>
        </View>

        {/* Input card ─────────────────────────────────────────────────── */}
        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            placeholder="Bir şey sorun..."
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            blurOnSubmit={false}
          />

          <View style={styles.inputActions}>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                { backgroundColor: colors.background },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/voice");
              }}
              hitSlop={8}
            >
              <Feather name="mic" size={15} color={colors.zinc500} />
            </TouchableOpacity>

            <Animated.View style={sendStyle}>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: hasText
                      ? colors.primary
                      : colors.accent,
                  },
                ]}
                onPress={() => handleSend()}
                disabled={!hasText}
                activeOpacity={0.80}
              >
                <Feather
                  name="arrow-up"
                  size={17}
                  color={
                    hasText
                      ? colors.primaryForeground
                      : colors.mutedForeground
                  }
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Suggestions ────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.zinc400 }]}>
          ÖNERİLER
        </Text>

        <View style={styles.suggestionsGrid}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s.label}
              style={[styles.suggestionCard, { backgroundColor: colors.card }]}
              onPress={() => handleSend(s.prompt)}
              activeOpacity={0.72}
            >
              <View
                style={[
                  styles.suggestionIcon,
                  { backgroundColor: colors.background },
                ]}
              >
                <Feather
                  name={s.icon as any}
                  size={15}
                  color={colors.foreground}
                />
              </View>
              <View style={styles.suggestionText}>
                <Text
                  style={[
                    styles.suggestionLabel,
                    { color: colors.foreground },
                  ]}
                >
                  {s.label}
                </Text>
                <Text
                  style={[
                    styles.suggestionSub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {s.sub}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick actions ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.zinc400 }]}>
          HIZLI ERİŞİM
        </Text>

        <View style={styles.quickRow}>
          {/* History */}
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSidebar(true);
            }}
            activeOpacity={0.72}
          >
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>
              Geçmiş
            </Text>
          </TouchableOpacity>

          {/* Voice Mode — primary CTA */}
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnVoice]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/voice");
            }}
            activeOpacity={0.82}
          >
            <Feather name="mic" size={16} color="#fff" />
            <Text style={[styles.quickLabel, styles.quickLabelVoice]}>
              Sesli Mod
            </Text>
          </TouchableOpacity>

          {/* New chat */}
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startNewConversation();
              router.push("/chat");
            }}
            activeOpacity={0.72}
          >
            <Feather name="message-circle" size={16} color={colors.mutedForeground} />
            <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>
              Sohbet
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:  { flex: 1 },
  scroll: { flex: 1 },

  // ── Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 18,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.05,
    shadowRadius:   4,
    elevation:      2,
  },
  brandRow: {
    alignItems: "center",
    gap:        4,
  },
  brandName: {
    fontSize:      17,
    fontFamily:    "Inter_700Bold",
    letterSpacing: -0.4,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  onlineDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: "#22c55e",
  },
  onlineLabel: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.2,
  },

  // ── Body scroll
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop:        28,
  },

  // ── Greeting
  greetingBlock: {
    marginBottom: 22,
    gap:          5,
  },
  greeting: {
    fontSize:      27,
    fontFamily:    "Inter_700Bold",
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
    lineHeight:    22,
  },

  // ── Input card
  inputCard: {
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     10,
    marginBottom:      30,
    gap:               10,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.07,
    shadowRadius:      16,
    elevation:         4,
  },
  textInput: {
    fontSize:    15,
    fontFamily:  "Inter_400Regular",
    minHeight:   48,
    maxHeight:   100,
    lineHeight:  22,
    paddingTop:  0,
    paddingBottom: 0,
  },
  inputActions: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "flex-end",
    gap:            6,
  },
  iconBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
  },
  sendBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.10,
    shadowRadius:   6,
    elevation:      3,
  },

  // ── Section labels
  sectionLabel: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom:  12,
  },

  // ── Suggestion cards
  suggestionsGrid: {
    gap:          10,
    marginBottom: 30,
  },
  suggestionCard: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      16,
    paddingVertical:   14,
    paddingHorizontal: 14,
    gap:               12,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.05,
    shadowRadius:      8,
    elevation:         2,
  },
  suggestionIcon: {
    width:          36,
    height:         36,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  suggestionText: {
    flex: 1,
    gap:  2,
  },
  suggestionLabel: {
    fontSize:      14,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.1,
  },
  suggestionSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },

  // ── Quick actions
  quickRow: {
    flexDirection: "row",
    gap:           10,
  },
  quickBtn: {
    flex:           1,
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 16,
    borderRadius:   16,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.05,
    shadowRadius:   8,
    elevation:      2,
  },
  quickBtnVoice: {
    flex:            1.5,
    backgroundColor: "#1848C5",
    shadowColor:     "#1848C5",
    shadowOpacity:   0.30,
    shadowRadius:    14,
    elevation:       6,
  },
  quickLabel: {
    fontSize:   12,
    fontFamily: "Inter_500Medium",
  },
  quickLabelVoice: {
    color:      "#fff",
    fontFamily: "Inter_600SemiBold",
  },
});
