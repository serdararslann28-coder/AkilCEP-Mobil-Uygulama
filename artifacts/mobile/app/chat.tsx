import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MessageBubble from "@/components/MessageBubble";
import Sidebar from "@/components/Sidebar";
import TypingIndicator from "@/components/TypingIndicator";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentMessages, isTyping, sendMessage, selectedModel, startNewConversation } = useChat();
  const [inputText, setInputText] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handleSend = () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.85, { duration: 80 }, () => {
      sendScale.value = withSpring(1, { duration: 120 });
    });
    sendMessage(inputText.trim());
    setInputText("");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const modelDisplay = selectedModel === "gpt-4o"
    ? "GPT-4o"
    : selectedModel === "gpt-4-turbo"
    ? "GPT-4 Turbo"
    : selectedModel === "gpt-3.5-turbo"
    ? "GPT-3.5"
    : "Claude 3";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />

      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.modelPill} activeOpacity={0.7}>
          <View style={[styles.modelDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.modelName, { color: colors.foreground }]}>{modelDisplay}</Text>
          <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerBtn}
          hitSlop={10}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSidebarVisible(true);
          }}
        >
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {currentMessages.length === 0 ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
            <View style={[styles.emptyOrb, { borderColor: colors.border }]}>
              <View style={[styles.emptyOrbDot, { backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ne sormak istersiniz?</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {modelDisplay} ile sohbet başlatın
            </Text>
          </Animated.View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={currentMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <MessageBubble message={item} isLatest={index === 0 && item.role === "assistant"} />
            )}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: 12 },
            ]}
            ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            scrollEnabled
          />
        )}

        <View
          style={[
            styles.inputContainer,
            {
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
              backgroundColor: colors.background,
            },
          ]}
        >
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.attachBtn} hitSlop={6}>
              <Feather name="paperclip" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            <View style={styles.rightActions}>
              <TouchableOpacity
                style={[styles.voiceBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/voice");
                }}
                hitSlop={6}
              >
                <Feather name="mic" size={16} color={colors.zinc300} />
              </TouchableOpacity>

              <Animated.View style={sendStyle}>
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: inputText.trim()
                        ? colors.primary
                        : colors.accent,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Feather
                    name="arrow-up"
                    size={18}
                    color={inputText.trim() ? colors.primaryForeground : colors.mutedForeground}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modelName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
  messageList: {
    paddingTop: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  emptyOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyOrbDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  attachBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 4,
    lineHeight: 22,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 1,
  },
  voiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
