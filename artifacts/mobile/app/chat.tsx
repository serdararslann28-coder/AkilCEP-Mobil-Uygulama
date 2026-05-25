/**
 * ChatScreen — ultra-premium AKILCEP AI chat interface.
 * Living logo presence · floating glassmorphic bubbles · cinematic input bar.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FullscreenMenu  from "@/components/FullscreenMenu";
import MessageBubble   from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";
import { useChat }     from "@/context/ChatContext";
import { useTheme }    from "@/context/ThemeContext";

const leafOnly = require("@/assets/images/leaf-only-transparent.png");

export default function ChatScreen() {
  const { theme: T }   = useTheme();
  const insets          = useSafeAreaInsets();
  const { currentMessages, isTyping, sendMessage, startNewConversation } = useChat();

  const [inputText,   setInputText]   = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const topPad    = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const hasText   = inputText.trim().length > 0;

  // ── Send button scale spring ─────────────────────────────────────────────
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const handleSend = () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.78, { duration: 70 }, () => {
      sendScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    sendMessage(inputText.trim());
    setInputText("");
  };

  // ── Living logo — breathing pulse ────────────────────────────────────────
  const breatheScale   = useSharedValue(1);
  const breatheOpacity = useSharedValue(T.isDark ? 0.055 : 0.082);

  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.065, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    breatheOpacity.value = withRepeat(
      withSequence(
        withTiming(T.isDark ? 0.09  : 0.13, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(T.isDark ? 0.055 : 0.08, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [T.isDark]);

  const logoStyle = useAnimatedStyle(() => ({
    transform:  [{ scale: breatheScale.value }],
    opacity:    breatheOpacity.value,
  }));

  // ── Theme-driven colours ──────────────────────────────────────────────────
  const headerBg      = T.isDark ? "rgba(5,5,5,0.88)"   : "rgba(246,246,243,0.88)";
  const inputBg       = T.isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.88)";
  const inputBorder   = T.isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)";
  const hBtnBg        = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.05)";
  const hBtnBorder    = T.isDark ? "rgba(255,255,255,0.10)"  : "transparent";
  const micBg         = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.04)";

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>
      <FullscreenMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      {/* ════════ LIVING LOGO — always behind everything ════════ */}
      <View style={ss.logoFrame} pointerEvents="none">
        {/* Ambient glow aura */}
        <Animated.View
          style={[
            ss.logoAura,
            {
              backgroundColor: T.green,
              opacity: T.isDark ? 0.055 : 0.09,
            },
            useAnimatedStyle(() => ({ transform: [{ scale: breatheScale.value }] })),
          ]}
        />
        {/* Leaf icon */}
        <Animated.Image
          source={leafOnly}
          style={[ss.logoImg, { tintColor: T.green }, logoStyle]}
          resizeMode="contain"
        />
      </View>

      {/* ════════ HEADER ════════ */}
      <View style={[ss.header, { paddingTop: topPad + 10, backgroundColor: headerBg }]}>

        {/* Menu button — top-left */}
        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: hBtnBg, borderColor: hBtnBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenuVisible(true); }}
          hitSlop={12}
          activeOpacity={0.65}
        >
          <Feather name="menu" size={16} color={T.fgSoft} />
        </TouchableOpacity>

        {/* Title — centered */}
        <Text style={[ss.headerTitle, { color: T.fgSoft }]}>
          C E B İ N D E K İ {"  "} A K I L
        </Text>

        {/* Compose button — top-right */}
        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: hBtnBg, borderColor: hBtnBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); startNewConversation(); }}
          hitSlop={12}
          activeOpacity={0.65}
        >
          <Feather name="edit-3" size={16} color={T.fgSoft} />
        </TouchableOpacity>

      </View>

      {/* ════════ MESSAGE LIST ════════ */}
      <KeyboardAvoidingView style={ss.flex} behavior="padding">
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isLatest={index === 0 && item.role === "assistant"}
            />
          )}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ss.messageList}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: 12 }} />}
        />

        {/* ════════ INPUT BAR ════════ */}
        <View style={[ss.inputOuter, { paddingBottom: bottomPad + 10 }]}>
          <View
            style={[
              ss.inputRow,
              {
                backgroundColor: inputBg,
                borderColor:     inputBorder,
                shadowColor:     "#000",
              },
            ]}
          >
            {/* Attachment */}
            <TouchableOpacity style={ss.attachBtn} hitSlop={8} activeOpacity={0.65}>
              <Feather name="plus" size={18} color={T.muted} />
            </TouchableOpacity>

            {/* Text field */}
            <TextInput
              style={[ss.textInput, { color: T.fg }]}
              placeholder="AkılCEP'e yanıt ver..."
              placeholderTextColor={T.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            {/* Right actions */}
            <View style={ss.rightRow}>
              {/* Mic — fades out when typing */}
              {!hasText && (
                <TouchableOpacity
                  style={[ss.micBtn, { backgroundColor: micBg }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/voice"); }}
                  hitSlop={8}
                  activeOpacity={0.65}
                >
                  <Feather name="mic" size={15} color={T.muted} />
                </TouchableOpacity>
              )}

              {/* Send — green glowing pill */}
              <Animated.View style={sendStyle}>
                <TouchableOpacity
                  style={[
                    ss.sendBtn,
                    {
                      backgroundColor: hasText ? T.green : "transparent",
                      borderColor:     hasText ? "transparent" : T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)",
                      shadowColor:     T.green,
                      shadowOpacity:   hasText ? 0.45 : 0,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!hasText}
                  activeOpacity={0.80}
                >
                  <Feather
                    name="arrow-up"
                    size={17}
                    color={hasText ? (T.isDark ? "#050505" : "#FFFFFF") : T.muted}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // ── Living logo
  logoFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    pointerEvents:  "none",
  },
  logoAura: {
    position:     "absolute",
    width:        280,
    height:       280,
    borderRadius: 140,
  },
  logoImg: {
    width:  190,
    height: 190,
  },

  // ── Header
  header: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: 18,
    paddingBottom:    14,
  },
  hBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.06,
    shadowRadius:   6,
  },
  headerTitle: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 1.8,
    flex:          1,
    textAlign:     "center",
    paddingHorizontal: 6,
  },

  // ── Message list
  messageList: { paddingTop: 20, paddingBottom: 8 },

  // ── Input bar
  inputOuter: {
    paddingHorizontal: 14,
    paddingTop:        8,
  },
  inputRow: {
    flexDirection:  "row",
    alignItems:     "flex-end",
    borderRadius:   28,
    borderWidth:    StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical:   7,
    gap:            4,
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.10,
    shadowRadius:   24,
    elevation:      6,
  },
  attachBtn: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   1,
  },
  textInput: {
    flex:        1,
    fontSize:    15,
    fontFamily:  "Inter_400Regular",
    maxHeight:   130,
    paddingVertical:  8,
    paddingHorizontal: 2,
    lineHeight:  22,
  },
  rightRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginBottom:  1,
  },
  micBtn: {
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
    borderWidth:    StyleSheet.hairlineWidth,
    shadowOffset:   { width: 0, height: 4 },
    shadowRadius:   12,
    elevation:      4,
  },
});
