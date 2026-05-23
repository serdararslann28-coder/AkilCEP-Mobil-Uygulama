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

import Svg, { Path } from "react-native-svg";

import Sidebar from "@/components/Sidebar";
import { useChat } from "@/context/ChatContext";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

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

      {/* ── Silk lines — thin flowing curves at edges only ───────────── */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 390 845"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Bottom-right silk folds — all starting off right edge */}
        <Path d="M 430,480 C 385,528 338,578 302,638 C 266,698 252,762 248,845"
          stroke="#DADADD" strokeWidth="0.7" fill="none" opacity="0.55" />
        <Path d="M 450,530 C 402,576 352,624 314,683 C 276,742 261,804 257,845"
          stroke="#E0E0E3" strokeWidth="0.5" fill="none" opacity="0.45" />
        <Path d="M 415,570 C 372,614 326,660 290,718 C 254,776 240,824 236,845"
          stroke="#D6D6D9" strokeWidth="0.9" fill="none" opacity="0.38" />
        <Path d="M 465,590 C 414,632 360,672 320,728 C 280,784 264,826 260,845"
          stroke="#E2E2E5" strokeWidth="0.5" fill="none" opacity="0.40" />
        <Path d="M 395,630 C 358,668 316,706 280,760 C 244,814 230,838 226,845"
          stroke="#DADADD" strokeWidth="0.6" fill="none" opacity="0.30" />

        {/* Bottom-left silk folds — mirrored, softer */}
        <Path d="M -40,560 C 14,606 62,656 92,716 C 122,776 128,824 126,845"
          stroke="#DADADD" strokeWidth="0.7" fill="none" opacity="0.42" />
        <Path d="M -60,620 C -2,662 50,710 82,768 C 114,826 120,840 118,845"
          stroke="#E0E0E3" strokeWidth="0.5" fill="none" opacity="0.34" />
        <Path d="M -25,680 C 26,718 70,756 98,808 C 108,828 112,840 112,845"
          stroke="#D8D8DB" strokeWidth="0.6" fill="none" opacity="0.28" />
      </Svg>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 14 }]}>
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

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.push("/chat")}
          hitSlop={14}
          activeOpacity={0.65}
        >
          <Feather name="user" size={16} color="#1C1C1E" />
        </TouchableOpacity>
      </View>

      {/* ── Center ────────────────────────────────────────────────────── */}
      <View style={styles.center}>

        {/* Embossed logo circle */}
        <View style={styles.logoCircleOuter}>
          <View style={styles.logoCircleInner}>
            <Image
              source={leafLogo}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Wordmark */}
        <Text style={styles.wordmark}>A K I L C E P</Text>

        {/* Tagline */}
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>cebindeki akıl</Text>
          <View style={styles.taglineLine} />
        </View>

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
            placeholder="Cepe sor"
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
    backgroundColor: "#FFFFFF",
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
    paddingHorizontal: 22,
    zIndex:            20,
  },
  circleBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems:      "center",
    justifyContent:  "center",
    // iOS shadow
    shadowColor:     "#9A9A9A",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.22,
    shadowRadius:    8,
    // Android
    elevation:       4,
  },

  // ── Center
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            18,
  },

  // Outer ring — very light border for depth
  logoCircleOuter: {
    width:           204,
    height:          204,
    borderRadius:    102,
    backgroundColor: "#ECECEC",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#A0A0A0",
    shadowOffset:    { width: 8, height: 12 },
    shadowOpacity:   0.40,
    shadowRadius:    28,
    elevation:       14,
    marginBottom:    10,
  },
  // Inner circle — slightly lighter for emboss effect
  logoCircleInner: {
    width:           188,
    height:          188,
    borderRadius:    94,
    backgroundColor: "#F2F2F2",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#FFFFFF",
    shadowOffset:    { width: -5, height: -5 },
    shadowOpacity:   0.90,
    shadowRadius:    8,
    elevation:       0,
  },
  logoImage: {
    width:  116,
    height: 116,
  },

  // Wordmark
  wordmark: {
    fontSize:      17,
    fontFamily:    "Inter_400Regular",
    color:         "#1C1C1E",
    letterSpacing: 8,
  },

  // Tagline
  taglineRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  taglineLine: {
    width:           24,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "#AEAEB2",
  },
  tagline: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    color:         "#AEAEB2",
    letterSpacing: 2.8,
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
    // Premium depth shadow
    shadowColor:       "#000000",
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.09,
    shadowRadius:      28,
    elevation:         10,
  },
  inputIconBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
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
