/**
 * Home — ultra premium white minimalist AI assistant.
 * Apple-inspired luxury aesthetic. Voice Mode is a separate screen at /voice.
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

import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { startNewConversation, sendMessage } = useChat();

  const [inputText, setInputText] = useState("");
  const [sidebar, setSidebar]     = useState(false);

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

  return (
    <View style={styles.root}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 14 }]}>

        {/* Left — menu */}
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebar(true);
          }}
          hitSlop={14}
          activeOpacity={0.65}
        >
          <Feather name="menu" size={16} color="#1C1C1E" />
        </TouchableOpacity>

        {/* Center — brand title */}
        <Text style={styles.topTitle}>C E B İ N D E K İ  A K I L</Text>

        {/* Right — avatar */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => router.push("/chat")}
          hitSlop={14}
          activeOpacity={0.80}
        >
          <Image source={avatar} style={styles.avatarImg} />
          <View style={styles.onlineDot} />
        </TouchableOpacity>

      </View>

      {/* ── Center ────────────────────────────────────────────────────── */}
      <View style={styles.center}>

        {/* Logo — bare on background, no circle */}
        <Image
          source={leafLogo}
          style={styles.logoImage}
          resizeMode="contain"
        />

        {/* Wordmark */}
        <Text style={styles.wordmark}>A K I L C E P</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>size nasıl yardımcı olabilirim?</Text>

      </View>

      {/* ── Floating input bar ─────────────────────────────────────────── */}
      <View style={[styles.inputWrap, { paddingBottom: btmPad + 14 }]}>
        <View style={styles.inputBar}>

          {/* + */}
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startNewConversation();
              router.push("/chat");
            }}
            hitSlop={10}
            activeOpacity={0.65}
          >
            <Feather name="plus" size={18} color="#1C1C1E" />
          </TouchableOpacity>

          {/* Text field */}
          <TextInput
            style={styles.textInput}
            placeholder="AkılCEPE yanıt ver"
            placeholderTextColor="#AEAEB2"
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          {/* Mic — opens Voice Mode */}
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/voice");
            }}
            hitSlop={10}
            activeOpacity={0.65}
          >
            <Feather name="mic" size={17} color="#1C1C1E" />
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[styles.sendBtn, hasText && styles.sendBtnActive]}
            onPress={handleSend}
            disabled={!hasText}
            hitSlop={10}
            activeOpacity={0.75}
          >
            <Feather
              name="arrow-up"
              size={16}
              color={hasText ? "#FFFFFF" : "#8E8E93"}
            />
          </TouchableOpacity>

        </View>
      </View>

      <Sidebar visible={sidebar} onClose={() => setSidebar(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: "#EBEBEC",
  },

  // ── Top bar
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    zIndex:            20,
  },

  topTitle: {
    fontSize:      10,
    fontFamily:    "Inter_400Regular",
    color:         "#1C1C1E",
    letterSpacing: 2.2,
    textAlign:     "center",
    flexShrink:    1,
  },

  circleBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.90)",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#9A9A9A",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.18,
    shadowRadius:    8,
    elevation:       4,
  },

  avatarWrap: {
    width:        44,
    height:       44,
    borderRadius: 22,
    shadowColor:  "#9A9A9A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation:    4,
  },
  avatarImg: {
    width:        44,
    height:       44,
    borderRadius: 22,
    borderWidth:  1.5,
    borderColor:  "rgba(255,255,255,0.80)",
  },
  onlineDot: {
    position:        "absolute",
    bottom:          1,
    right:           1,
    width:           11,
    height:          11,
    borderRadius:    6,
    backgroundColor: "#34C759",
    borderWidth:     2,
    borderColor:     "#EBEBEC",
  },

  // ── Center
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
  },

  logoImage: {
    width:        152,
    height:       152,
    marginBottom: 8,
  },

  wordmark: {
    fontSize:      18,
    fontFamily:    "Inter_400Regular",
    color:         "#1C1C1E",
    letterSpacing: 8,
  },

  subtitle: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "#AEAEB2",
    letterSpacing: 0.8,
    textAlign:     "center",
    marginTop:     2,
  },

  // ── Input bar
  inputWrap: {
    paddingHorizontal: 18,
  },
  inputBar: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      60,
    paddingVertical:   8,
    paddingHorizontal: 8,
    gap:               2,
    shadowColor:       "#000000",
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.08,
    shadowRadius:      24,
    elevation:         9,
  },
  inputIconBtn: {
    width:          42,
    height:         42,
    borderRadius:   21,
    alignItems:     "center",
    justifyContent: "center",
  },
  textInput: {
    flex:              1,
    fontSize:          15,
    fontFamily:        "Inter_400Regular",
    color:             "#1C1C1E",
    paddingHorizontal: 4,
    paddingVertical:   6,
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "#E5E5EA",
  },
  sendBtnActive: {
    backgroundColor: "#1C1C1E",
  },

});
