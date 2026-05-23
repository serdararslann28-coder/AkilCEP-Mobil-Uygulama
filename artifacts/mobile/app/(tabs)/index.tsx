/**
 * Home — premium white minimalist AI assistant.
 * Apple-inspired luxury aesthetic. Voice Mode stays separate at /voice.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LeafIcon from "@/components/LeafIcon";
import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";

export default function HomeScreen() {
  const insets  = useSafeAreaInsets();
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

      {/* ── Subtle background shapes ──────────────────────────────────── */}
      <View style={styles.shapeTL} />
      <View style={styles.shapeBR} />
      <View style={styles.shapeBL} />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebar(true);
          }}
          hitSlop={12}
          activeOpacity={0.70}
        >
          <Feather name="menu" size={17} color="#1a1a1a" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.push("/chat")}
          hitSlop={12}
          activeOpacity={0.70}
        >
          <Feather name="user" size={17} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      {/* ── Center — logo + wordmark ───────────────────────────────────── */}
      <View style={styles.center}>

        {/* Neumorphic logo circle */}
        <View style={styles.logoCircle}>
          <LeafIcon size={88} color="#111111" />
        </View>

        {/* Wordmark */}
        <Text style={styles.wordmark}>A K I L C E P</Text>

        {/* Tagline with decorative lines */}
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>Cebindeki Akıl</Text>
          <View style={styles.taglineLine} />
        </View>

      </View>

      {/* ── Floating input bar ─────────────────────────────────────────── */}
      <View style={[styles.inputWrap, { paddingBottom: btmPad + 16 }]}>
        <View style={styles.inputBar}>

          {/* + button */}
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startNewConversation();
              router.push("/chat");
            }}
            hitSlop={8}
            activeOpacity={0.70}
          >
            <Feather name="plus" size={18} color="#1a1a1a" />
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={styles.textInput}
            placeholder="Cepe sor"
            placeholderTextColor="#ABABAB"
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          {/* Mic */}
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/voice");
            }}
            hitSlop={8}
            activeOpacity={0.70}
          >
            <Feather name="mic" size={17} color="#1a1a1a" />
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[
              styles.inputIconBtn,
              hasText && styles.inputIconBtnActive,
            ]}
            onPress={handleSend}
            disabled={!hasText}
            hitSlop={8}
            activeOpacity={0.70}
          >
            <Feather
              name="arrow-up"
              size={17}
              color={hasText ? "#fff" : "#1a1a1a"}
            />
          </TouchableOpacity>

        </View>
      </View>

      <Sidebar visible={sidebar} onClose={() => setSidebar(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#F7F7F7",
  },

  // ── Background abstract shapes
  shapeTL: {
    position:        "absolute",
    top:             -80,
    left:            -80,
    width:           280,
    height:          280,
    borderRadius:    140,
    backgroundColor: "rgba(0,0,0,0.028)",
  },
  shapeBR: {
    position:        "absolute",
    bottom:          60,
    right:           -100,
    width:           340,
    height:          340,
    borderRadius:    170,
    backgroundColor: "rgba(0,0,0,0.022)",
    transform:       [{ rotate: "20deg" }],
  },
  shapeBL: {
    position:        "absolute",
    bottom:          -60,
    left:            -60,
    width:           220,
    height:          220,
    borderRadius:    110,
    backgroundColor: "rgba(0,0,0,0.018)",
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
    paddingHorizontal: 24,
    zIndex:            10,
  },
  circleBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: "#EFEFEF",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#B0B0B0",
    shadowOffset:    { width: 3, height: 3 },
    shadowOpacity:   0.35,
    shadowRadius:    6,
    elevation:       4,
  },

  // ── Center
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            20,
  },

  // Neumorphic logo circle
  logoCircle: {
    width:           192,
    height:          192,
    borderRadius:    96,
    backgroundColor: "#EFEFEF",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#B8B8B8",
    shadowOffset:    { width: 10, height: 10 },
    shadowOpacity:   0.55,
    shadowRadius:    22,
    elevation:       12,
    marginBottom:    8,
  },
  logoImage: {
    width:   120,
    height:  120,
  },

  // Wordmark
  wordmark: {
    fontSize:      18,
    fontFamily:    "Inter_400Regular",
    color:         "#1A1A1A",
    letterSpacing: 9,
  },

  // Tagline
  taglineRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  taglineLine: {
    width:           28,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "#AAAAAA",
  },
  tagline: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    color:         "#AAAAAA",
    letterSpacing: 2.5,
  },

  // ── Input bar
  inputWrap: {
    paddingHorizontal: 20,
  },
  inputBar: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      50,
    paddingVertical:   10,
    paddingHorizontal: 10,
    gap:               4,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.08,
    shadowRadius:      24,
    elevation:         8,
  },
  textInput: {
    flex:          1,
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "#1A1A1A",
    paddingHorizontal: 6,
    paddingVertical:   4,
  },
  inputIconBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    alignItems:     "center",
    justifyContent: "center",
  },
  inputIconBtnActive: {
    backgroundColor: "#1A1A1A",
  },
});
