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

      {/* ── Silk background — soft flowing curves + corner glows ─────── */}
      <View style={styles.glowTL} />
      <View style={styles.glowBR} />

      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 390 845"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* ── Bottom-right cluster — 4 layered S-curves ── */}
        <Path
          d="M 545,290 C 490,370 425,450 385,555 C 345,660 328,755 315,845"
          stroke="#D0D0D3" strokeWidth="1.1" fill="none" opacity="0.50"
        />
        <Path
          d="M 570,370 C 510,445 445,515 402,618 C 359,720 340,800 326,845"
          stroke="#D8D8DB" strokeWidth="0.75" fill="none" opacity="0.38"
        />
        <Path
          d="M 510,460 C 468,525 428,598 398,690 C 368,782 350,828 338,845"
          stroke="#CACACE" strokeWidth="1.3" fill="none" opacity="0.30"
        />
        <Path
          d="M 590,430 C 535,498 472,562 430,655 C 388,748 368,810 352,845"
          stroke="#D4D4D7" strokeWidth="0.6" fill="none" opacity="0.42"
        />

        {/* ── Bottom-left cluster — 4 flowing curves ── */}
        <Path
          d="M -125,550 C -18,522 72,490 125,452 C 178,414 190,365 170,305"
          stroke="#D0D0D3" strokeWidth="1.1" fill="none" opacity="0.50"
        />
        <Path
          d="M -148,655 C -32,624 72,588 132,547 C 192,506 202,455 180,392"
          stroke="#D8D8DB" strokeWidth="0.75" fill="none" opacity="0.38"
        />
        <Path
          d="M -98,758 C 28,726 122,688 178,644 C 234,600 242,550 218,488"
          stroke="#CACACE" strokeWidth="1.3" fill="none" opacity="0.30"
        />
        <Path
          d="M -160,740 C -38,710 65,675 128,630 C 191,585 200,535 176,472"
          stroke="#D4D4D7" strokeWidth="0.6" fill="none" opacity="0.42"
        />

        {/* ── Top-right whisper — single barely-there curve ── */}
        <Path
          d="M 390,80 C 360,120 340,165 355,215 C 370,265 390,285 395,320"
          stroke="#D6D6D9" strokeWidth="0.6" fill="none" opacity="0.28"
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
    backgroundColor: "#F5F5F7",
  },

  // ── Soft corner glows (large, feathered — anchor for the silk lines)
  glowTL: {
    position:        "absolute",
    top:             -140,
    left:            -140,
    width:           380,
    height:          380,
    borderRadius:    190,
    backgroundColor: "rgba(0,0,0,0.026)",
  },
  glowBR: {
    position:        "absolute",
    bottom:          60,
    right:           -140,
    width:           400,
    height:          400,
    borderRadius:    200,
    backgroundColor: "rgba(0,0,0,0.020)",
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
