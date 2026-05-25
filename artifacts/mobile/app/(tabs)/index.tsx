/**
 * Home — ultra premium AI assistant.
 * Responds fully to PURE / VOID theme.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FullscreenMenu from "@/components/FullscreenMenu";
import ProfileMenu   from "@/components/ProfileMenu";
import ThemeToggle   from "@/components/ThemeToggle";
import { useChat }   from "@/context/ChatContext";
import { useTheme }  from "@/context/ThemeContext";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { startNewConversation, sendMessage } = useChat();
  const { theme } = useTheme();

  const [inputText, setInputText]     = useState("");
  const [sidebar, setSidebar]         = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 36 : insets.bottom;

  const handleSend = () => {
    const msg = inputText.trim();
    if (!msg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    sendMessage(msg);
    setInputText("");
    router.push("/chat");
  };

  const hasText = inputText.trim().length > 0;

  // ── Dynamic colour tokens ──
  const T = theme;

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 14 }]}>

        <TouchableOpacity
          style={[styles.circleBtn, { backgroundColor: T.card, shadowColor: T.isDark ? "transparent" : "#9A9A9A" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSidebar(true); }}
          hitSlop={14}
          activeOpacity={0.65}
        >
          <Feather name="menu" size={16} color={T.fg} />
        </TouchableOpacity>

        <Text style={[styles.topTitle, { color: T.fg }]}>C E B İ N D E K İ  A K I L</Text>

        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setProfileMenu(true); }}
          hitSlop={14}
          activeOpacity={0.80}
        >
          <Image source={avatar} style={[styles.avatarImg, { borderColor: T.card }]} />
          <View style={[styles.onlineDot, { backgroundColor: T.onlineDot, borderColor: T.bg }]} />
        </TouchableOpacity>

      </View>

      {/* ── Center ── */}
      <View style={styles.center}>
        <Image
          source={leafLogo}
          style={[styles.logoImage, { tintColor: T.logoTint }]}
          resizeMode="contain"
        />
        <Text style={[styles.wordmark, { color: T.fg }]}>A K I L C E P</Text>
        <Text style={[styles.subtitle, { color: T.zinc }]}>size nasıl yardımcı olabilirim?</Text>
      </View>

      {/* ── Input bar ── */}
      <View style={[styles.inputWrap, { paddingBottom: btmPad + 64 }]}>
        <View style={[
          styles.inputBar,
          {
            backgroundColor: T.card,
            borderColor:      T.border,
            borderWidth:      T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:    T.isDark ? 0 : 0.08,
          },
        ]}>

          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); startNewConversation(); router.push("/chat"); }}
            hitSlop={10}
            activeOpacity={0.65}
          >
            <Feather name="plus" size={18} color={T.fg} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { color: T.fg }]}
            placeholder="AkılCEPE yanıt ver"
            placeholderTextColor={T.zinc}
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/voice"); }}
            hitSlop={10}
            activeOpacity={0.65}
          >
            <Feather name="mic" size={17} color={T.fg} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: hasText ? T.primary : T.accent }]}
            onPress={handleSend}
            disabled={!hasText}
            hitSlop={10}
            activeOpacity={0.75}
          >
            <Feather name="arrow-up" size={16} color={hasText ? T.primaryForeground : T.muted} />
          </TouchableOpacity>

        </View>
      </View>

      {/* ── Theme toggle — floating bottom-left ── */}
      <ThemeToggle bottomOffset={btmPad + 6} />

      <FullscreenMenu visible={sidebar}      onClose={() => setSidebar(false)} />
      <ProfileMenu    visible={profileMenu}  onClose={() => setProfileMenu(false)} />
    </View>
  );
}

// ─── Layout-only styles (no colours) ─────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    position:          "absolute",
    top: 0, left: 0, right: 0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    zIndex:            20,
  },
  topTitle: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 2.2,
    textAlign:     "center",
    flexShrink:    1,
  },
  circleBtn: {
    width:        44, height:       44,
    borderRadius: 22,
    alignItems:   "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation:    4,
  },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  avatarImg: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5,
  },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  logoImage:  { width: 152, height: 152, marginBottom: 8 },
  wordmark: {
    fontSize: 18, fontFamily: "Inter_400Regular", letterSpacing: 8,
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    letterSpacing: 0.8, textAlign: "center", marginTop: 2,
  },

  inputWrap:      { paddingHorizontal: 18 },
  inputBar: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      60,
    paddingVertical:   8,
    paddingHorizontal: 8,
    gap:               2,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 6 },
    shadowRadius:      24,
    elevation:         9,
  },
  inputIconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingHorizontal: 4, paddingVertical: 6 },
  sendBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
