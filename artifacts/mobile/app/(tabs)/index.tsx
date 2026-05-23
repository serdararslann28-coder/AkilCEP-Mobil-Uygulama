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

      {/* ── Silk lines ────────────────────────────────────────────────── */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 390 845"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Right-edge S-curve — from just below top buttons, graceful S */}
        <Path
          d="M 388,168 C 378,210 360,250 362,292 C 364,334 376,364 370,402"
          stroke="#FFFFFF" strokeWidth="1.0" fill="none" opacity="0.80"
        />

        {/* Left-edge whisper — faint counter-curve */}
        <Path
          d="M 2,636 C 14,610 24,582 26,554 C 28,526 20,502 24,476"
          stroke="#FFFFFF" strokeWidth="0.65" fill="none" opacity="0.38"
        />

        {/* Ribbon 1 — first wave, 16px band, sits at ~y=650 centre */}
        <Path
          d="M -20,666 C 60,636 168,624 288,640 C 408,656 462,694 560,678
             L 560,694 C 462,710 408,672 288,656 C 168,640 60,652 -20,682 Z"
          fill="#FFFFFF" opacity="0.50"
        />

        {/* Ribbon 2 — second wave, 14px band, ~y=708 centre */}
        <Path
          d="M -20,712 C 66,684 172,672 294,688 C 416,704 468,740 568,724
             L 568,738 C 468,754 416,718 294,702 C 172,686 66,698 -20,726 Z"
          fill="#FFFFFF" opacity="0.38"
        />

        {/* Ribbon 3 — lowest, fills bottom corner */}
        <Path
          d="M -20,756 C 68,732 176,720 300,734 C 424,748 476,778 576,762
             L 576,845 L -20,845 Z"
          fill="#FFFFFF" opacity="0.26"
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
