import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AI_MODELS, useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const colors = useColors();
  const {
    conversations,
    currentConversation,
    loadConversation,
    deleteConversation,
    startNewConversation,
    selectedModel,
    setSelectedModel,
  } = useChat();

  const translateX    = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value    = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateX.value    = withTiming(-SIDEBAR_WIDTH, { duration: 280 });
      overlayOpacity.value = withTiming(0, { duration: 280 });
    }
  }, [visible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? "auto" : "none",
  }));

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startNewConversation();
    onClose();
    router.push("/chat");
  };

  const handleConversation = (id: string) => {
    Haptics.selectionAsync();
    loadConversation(id);
    onClose();
    router.push("/chat");
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteConversation(id);
  };

  return (
    <>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor: colors.surface,
            shadowColor: "#000",
          },
          sidebarStyle,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={[styles.logoDot, { backgroundColor: colors.foreground }]} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>AkılCEP AI</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.card }]}
            hitSlop={10}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* New chat */}
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.foreground }]}
          onPress={handleNewChat}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={15} color={colors.primaryForeground} />
          <Text style={[styles.newChatText, { color: colors.primaryForeground }]}>
            Yeni Sohbet
          </Text>
        </TouchableOpacity>

        {/* Model selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MODEL</Text>
          {AI_MODELS.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelRow,
                {
                  backgroundColor:
                    selectedModel === model.id ? colors.card : "transparent",
                },
              ]}
              onPress={() => {
                setSelectedModel(model.id);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: colors.foreground }]}>
                  {model.name}
                </Text>
                <Text style={[styles.modelBadge, { color: colors.mutedForeground }]}>
                  {model.badge}
                </Text>
              </View>
              {selectedModel === model.id && (
                <Feather name="check" size={13} color={colors.foreground} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* History */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>GEÇMİŞ</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.historyList}>
            {conversations.length === 0 ? (
              <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>
                Henüz sohbet yok
              </Text>
            ) : (
              conversations.map((conv) => (
                <TouchableOpacity
                  key={conv.id}
                  style={[
                    styles.historyRow,
                    currentConversation?.id === conv.id && {
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={() => handleConversation(conv.id)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="message-square"
                    size={13}
                    color={colors.mutedForeground}
                    style={styles.historyIcon}
                  />
                  <Text
                    style={[styles.historyTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {conv.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(conv.id)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={12} color={colors.zinc400} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.card }]}>
              <Feather name="user" size={15} color={colors.foreground} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.foreground }]}>Kullanıcı</Text>
              <Text style={[styles.userPlan, { color: colors.mutedForeground }]}>Ücretsiz Plan</Text>
            </View>
            <TouchableOpacity hitSlop={10}>
              <Feather name="settings" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex: 100,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 101,
    paddingTop: Platform.OS === "web" ? 67 : 60,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 0,
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logoText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  newChatText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  modelInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modelName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  modelBadge: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  historySection: {
    flex: 1,
  },
  historyList: { flex: 1 },
  emptyHistory: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  historyIcon: { marginRight: 8 },
  historyTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  userPlan: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});
