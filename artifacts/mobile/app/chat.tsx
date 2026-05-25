/**
 * ChatScreen — AKILCEP premium AI chat.
 * Watermark logo · floating neutral bubbles · glassmorphic input.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
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

  // ── Send spring ──────────────────────────────────────────────────────────
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const handleSend = () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.80, { duration: 70 }, () => {
      sendScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    sendMessage(inputText.trim());
    setInputText("");
  };

  // ── Watermark logo — slow breathing, pure watermark ──────────────────────
  const loScale = useSharedValue(1);
  const loOp    = useSharedValue(T.isDark ? 0.05 : 0.07);

  useEffect(() => {
    loScale.value = withRepeat(
      withSequence(
        withTiming(1.055, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    loOp.value = withRepeat(
      withSequence(
        withTiming(T.isDark ? 0.075 : 0.10, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
        withTiming(T.isDark ? 0.045 : 0.065,{ duration: 4600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [T.isDark]);

  // Smoke-gray tint — no green, blends into bg naturally
  const logoTint = T.isDark ? "#888888" : "#5A5A5A";

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loScale.value }],
    opacity:   loOp.value,
  }));

  // ── Colour tokens ─────────────────────────────────────────────────────────
  // Header
  const headerBg    = T.isDark ? "rgba(5,5,5,0.82)"       : "rgba(246,246,243,0.82)";
  // Input — exact spec values for PURE; integrated dark glass for VOID
  const inputBg     = T.isDark ? "rgba(255,255,255,0.055)" : "#F1F1EE";
  const sendBtnBg   = T.isDark ? "rgba(255,255,255,0.12)"  : "#E5E5E1";
  const inputTextClr   = T.isDark ? T.fg  : "#5C5C5C";
  const inputPlhClr    = T.isDark ? T.muted : "#9A9A9A";
  // Attachment / mic icon
  const attachClr   = T.isDark ? "rgba(255,255,255,0.32)"  : "#9A9A9A";
  // Header button glass
  const btnBg       = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.045)";
  const btnBorder   = T.isDark ? StyleSheet.hairlineWidth  : 0;
  const btnBorderClr= T.isDark ? "rgba(255,255,255,0.09)"  : "transparent";

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>
      <FullscreenMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />

      {/* ════════ WATERMARK LOGO — no container, no glow box ════════ */}
      <View style={ss.logoFrame} pointerEvents="none">
        <Animated.Image
          source={leafOnly}
          style={[ss.logoImg, { tintColor: logoTint }, logoStyle]}
          resizeMode="contain"
        />
      </View>

      {/* ════════ HEADER ════════ */}
      <View style={[ss.header, { paddingTop: topPad + 10, backgroundColor: headerBg }]}>

        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: btnBg, borderColor: btnBorderClr, borderWidth: btnBorder }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenuVisible(true); }}
          hitSlop={12} activeOpacity={0.62}
        >
          <Feather name="menu" size={16} color={T.fgSoft} />
        </TouchableOpacity>

        <Text style={[ss.headerTitle, { color: T.fgSoft }]}>
          C E B İ N D E K İ {"  "} A K I L
        </Text>

        <TouchableOpacity
          style={[ss.hBtn, { backgroundColor: btnBg, borderColor: btnBorderClr, borderWidth: btnBorder }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); startNewConversation(); }}
          hitSlop={12} activeOpacity={0.62}
        >
          <Feather name="edit-3" size={16} color={T.fgSoft} />
        </TouchableOpacity>

      </View>

      {/* ════════ MESSAGES ════════ */}
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
          contentContainerStyle={ss.msgList}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={<View style={{ height: 12 }} />}
        />

        {/* ════════ INPUT BAR ════════ */}
        <View style={[ss.inputOuter, { paddingBottom: bottomPad + 10 }]}>
          <View style={[ss.inputRow, { backgroundColor: inputBg }]}>

            {/* Attachment */}
            <TouchableOpacity style={ss.attachBtn} hitSlop={8} activeOpacity={0.60}>
              <Feather name="plus" size={18} color={attachClr} />
            </TouchableOpacity>

            {/* Text field */}
            <TextInput
              style={[ss.textInput, { color: inputTextClr }]}
              placeholder="AkılCEP'e yanıt ver…"
              placeholderTextColor={inputPlhClr}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            {/* Right: mic + send */}
            <View style={ss.rightRow}>
              {!hasText && (
                <TouchableOpacity
                  style={ss.micBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/voice"); }}
                  hitSlop={8} activeOpacity={0.60}
                >
                  <Feather name="mic" size={15} color={attachClr} />
                </TouchableOpacity>
              )}

              {/* Send — same surface tone, no border, fades with input state */}
              <Animated.View style={sendStyle}>
                <TouchableOpacity
                  style={[
                    ss.sendBtn,
                    {
                      backgroundColor: sendBtnBg,
                      opacity: hasText ? 1 : 0.42,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!hasText}
                  activeOpacity={0.70}
                >
                  <Feather
                    name="arrow-up"
                    size={17}
                    color={T.isDark ? "rgba(255,255,255,0.82)" : "#5C5C5C"}
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

  // Watermark — absoluteFill, icon only, no container
  logoFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    pointerEvents:  "none",
  },
  logoImg: {
    width:  300,
    height: 300,
  },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 18,
    paddingBottom:     14,
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
    shadowRadius:   8,
  },
  headerTitle: {
    flex:          1,
    textAlign:     "center",
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 1.8,
    paddingHorizontal: 6,
  },

  // List
  msgList: { paddingTop: 20, paddingBottom: 8 },

  // Input
  inputOuter: {
    paddingHorizontal: 14,
    paddingTop:        8,
  },
  inputRow: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    borderRadius:      28,
    paddingHorizontal: 8,
    paddingVertical:   7,
    gap:               4,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.04,
    shadowRadius:      8,
    elevation:         2,
  },
  attachBtn: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   1,
  },
  textInput: {
    flex:              1,
    fontSize:          15,
    fontFamily:        "Inter_400Regular",
    maxHeight:         130,
    paddingVertical:   8,
    paddingHorizontal: 2,
    lineHeight:        22,
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
  },
});
