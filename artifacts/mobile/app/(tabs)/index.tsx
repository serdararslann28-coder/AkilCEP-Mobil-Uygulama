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

      {/* ── Hairline silk accents ─────────────────────────────────────── */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 390 845"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Right-edge S — hugs the right, starts below top buttons */}
        <Path
          d="M 390,172 C 378,214 362,256 364,298 C 366,340 378,368 372,408"
          stroke="#FFFFFF" strokeWidth="0.9" fill="none" opacity="0.60"
        />

        {/* Bottom sweep 1 — thin arc from left edge, lower third */}
        <Path
          d="M -10,668 C 72,638 176,626 296,642 C 416,658 468,696 560,680"
          stroke="#FFFFFF" strokeWidth="0.8" fill="none" opacity="0.45"
        />

        {/* Bottom sweep 2 — slightly below, softer */}
        <Path
          d="M -10,710 C 76,682 178,670 300,686 C 422,702 472,736 565,720"
          stroke="#FFFFFF" strokeWidth="0.7" fill="none" opacity="0.32"
        />

        {/* Bottom sweep 3 — lowest, barely there */}
        <Path
          d="M -10,750 C 80,726 182,714 306,728 C 430,742 480,772 568,758"
          stroke="#FFFFFF" strokeWidth="0.6" fill="none" opacity="0.22"
        />

        {/* Left-edge whisper — faint counter-accent */}
        <Path
          d="M 0,648 C 14,620 26,590 28,560 C 30,530 22,506 26,480"
          stroke="#FFFFFF" strokeWidth="0.6" fill="none" opacity="0.30"
        />
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
