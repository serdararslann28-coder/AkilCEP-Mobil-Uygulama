import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Dimensions,
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AI_MODELS, useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo-transparent.png");

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.80, 320);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    conversations,
    currentConversation,
    loadConversation,
    deleteConversation,
    startNewConversation,
    selectedModel,
    setSelectedModel,
  } = useChat();

  const translateX     = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value     = withTiming(0, { duration: 320 });
      overlayOpacity.value = withTiming(1, { duration: 320 });
    } else {
      translateX.value     = withTiming(-SIDEBAR_WIDTH, { duration: 280 });
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const topPad    = Platform.OS === "web" ? 56 : insets.top;
  const bottomPad = Platform.OS === "web" ? 28 : insets.bottom;

  return (
    <>
      {/* Dimmed backdrop */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          { backgroundColor: colors.surface, shadowColor: "#000" },
          sidebarStyle,
        ]}
      >
        {/* ── Header: leaf icon + brand name ── */}
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={styles.brandRow}>
            {/* Leaf-only crop of the transparent logo PNG */}
            <View style={styles.leafClip}>
              <Image
                source={logo}
                style={styles.leafImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>
              AkılCEP
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
          >
            <Feather name="x" size={17} color={colors.zinc400} />
          </TouchableOpacity>
        </View>

        {/* ── New chat button ── */}
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.foreground }]}
          onPress={handleNewChat}
          activeOpacity={0.80}
        >
          <Feather name="plus" size={15} color={colors.primaryForeground} />
          <Text style={[styles.newChatText, { color: colors.primaryForeground }]}>
            Yeni Sohbet
          </Text>
        </TouchableOpacity>

        {/* ── Model selector ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.zinc400 }]}>
            MODEL
          </Text>
          {AI_MODELS.map((model) => {
            const active = selectedModel === model.id;
            return (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.modelRow,
                  active && { backgroundColor: colors.card },
                ]}
                onPress={() => {
                  setSelectedModel(model.id);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modelDot}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: active
                          ? colors.foreground
                          : colors.zinc400,
                        opacity: active ? 1 : 0.35,
                      },
                    ]}
                  />
                </View>
                <View style={styles.modelInfo}>
                  <Text
                    style={[
                      styles.modelName,
                      {
                        color: active
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: active
                          ? "Inter_600SemiBold"
                          : "Inter_400Regular",
                      },
                    ]}
                  >
                    {model.name}
                  </Text>
                  <Text
                    style={[
                      styles.modelBadge,
                      { color: colors.zinc400 },
                    ]}
                  >
                    {model.badge}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Conversation history ── */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionLabel, { color: colors.zinc400 }]}>
            GEÇMİŞ
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.historyScroll}
          >
            {conversations.length === 0 ? (
              <Text
                style={[styles.emptyHistory, { color: colors.zinc400 }]}
              >
                Henüz sohbet yok
              </Text>
            ) : (
              conversations.map((conv) => {
                const active = currentConversation?.id === conv.id;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.historyRow,
                      active && { backgroundColor: colors.card },
                    ]}
                    onPress={() => handleConversation(conv.id)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="message-square"
                      size={12}
                      color={active ? colors.foreground : colors.zinc400}
                      style={styles.historyIcon}
                    />
                    <Text
                      style={[
                        styles.historyTitle,
                        {
                          color: active
                            ? colors.foreground
                            : colors.mutedForeground,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {conv.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        deleteConversation(conv.id);
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        );
                      }}
                      hitSlop={10}
                    >
                      <Feather
                        name="trash-2"
                        size={11}
                        color={colors.zinc400}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* ── Footer ── */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 12,
            },
          ]}
        >
          <View style={styles.userRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.card },
              ]}
            >
              <Feather name="user" size={14} color={colors.foreground} />
            </View>
            <View style={styles.userInfo}>
              <Text
                style={[styles.userName, { color: colors.foreground }]}
              >
                Kullanıcı
              </Text>
              <Text
                style={[styles.userPlan, { color: colors.zinc400 }]}
              >
                Ücretsiz Plan
              </Text>
            </View>
            <TouchableOpacity hitSlop={12}>
              <Feather
                name="settings"
                size={16}
                color={colors.zinc400}
              />
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
    paddingHorizontal: 22,
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 16,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  /* Crops just the leaf portion of the full logo PNG */
  leafClip: {
    width: 30,
    height: 36,
    overflow: "hidden",
  },
  leafImage: {
    width: 90,
    height: 70,
    marginLeft: -30,
    marginTop: -2,
  },
  brandName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.0,
  },
  closeBtn: {
    padding: 4,
  },

  /* ── New chat ── */
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  newChatText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },

  /* ── Section labels ── */
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  /* ── Model selector ── */
  section: { marginBottom: 26 },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 13,
    marginBottom: 3,
    gap: 10,
  },
  modelDot: {
    width: 16,
    alignItems: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  modelInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  modelName: {
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  modelBadge: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  /* ── History ── */
  historySection: { flex: 1 },
  historyScroll: { flex: 1 },
  emptyHistory: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    letterSpacing: 0.1,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
    gap: 0,
  },
  historyIcon: { marginRight: 9 },
  historyTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.05,
  },

  /* ── Footer ── */
  footer: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.1,
  },
  userPlan: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
    letterSpacing: 0.1,
  },
});
