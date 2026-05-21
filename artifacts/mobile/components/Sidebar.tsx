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

/**
 * Rendered at 38×30px the "AkılCEP" / tagline text inside the PNG
 * becomes sub-pixel and invisible — only the bold leaf silhouette reads.
 */
const logo = require("@/assets/images/logo-transparent.png");

const SCREEN_WIDTH  = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
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
      translateX.value     = withTiming(0,              { duration: 320 });
      overlayOpacity.value = withTiming(1,              { duration: 320 });
    } else {
      translateX.value     = withTiming(-SIDEBAR_WIDTH, { duration: 280 });
      overlayOpacity.value = withTiming(0,              { duration: 280 });
    }
  }, [visible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity:       overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? "auto" : "none",
  } as any));

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

  const topPad    = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  return (
    <>
      {/* ── Backdrop ── */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Sidebar panel ── */}
      <Animated.View
        style={[
          styles.sidebar,
          { backgroundColor: colors.surface },
          sidebarStyle,
        ]}
      >

        {/* ════════════════════════════════
            HEADER — leaf icon + brand name
        ════════════════════════════════ */}
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          {/* Brand identity row */}
          <View style={styles.brandRow}>
            {/*
              PNG rendered at 38×30 — leaf silhouette reads clearly,
              internal "AkılCEP" text inside the image is sub-pixel.
            */}
            <Image
              source={logo}
              style={styles.leafIcon}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: colors.foreground }]}>
              AkılCEP
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={14}
          >
            <Feather name="x" size={18} color={colors.zinc400} />
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════
            NEW CHAT — floating black pill
        ════════════════════════════════ */}
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.foreground }]}
          onPress={handleNewChat}
          activeOpacity={0.78}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.newChatText, { color: colors.primaryForeground }]}>
            Yeni Sohbet
          </Text>
        </TouchableOpacity>

        {/* ════════════════════════════════
            MODEL SELECTOR
        ════════════════════════════════ */}
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
                {/* Active indicator dot */}
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: colors.foreground,
                      opacity: active ? 1 : 0.22,
                    },
                  ]}
                />
                <View style={styles.modelInfo}>
                  <Text
                    style={[
                      styles.modelName,
                      {
                        color:      active ? colors.foreground : colors.mutedForeground,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {model.name}
                  </Text>
                  <Text style={[styles.modelBadge, { color: colors.zinc400 }]}>
                    {model.badge}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ════════════════════════════════
            CONVERSATION HISTORY
        ════════════════════════════════ */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionLabel, { color: colors.zinc400 }]}>
            GEÇMİŞ
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.historyScroll}>
            {conversations.length === 0 ? (
              <Text style={[styles.emptyHistory, { color: colors.zinc400 }]}>
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
                          color:      active ? colors.foreground : colors.mutedForeground,
                          fontFamily: active ? "Inter_500Medium" : "Inter_400Regular",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {conv.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        deleteConversation(conv.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      hitSlop={10}
                    >
                      <Feather name="trash-2" size={11} color={colors.zinc400} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* ════════════════════════════════
            FOOTER — user profile
        ════════════════════════════════ */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              paddingBottom:  bottomPad + 14,
            },
          ]}
        >
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.card }]}>
              <Feather name="user" size={14} color={colors.foreground} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                Kullanıcı
              </Text>
              <Text style={[styles.userPlan, { color: colors.zinc400 }]}>
                Ücretsiz Plan
              </Text>
            </View>
            <TouchableOpacity hitSlop={12}>
              <Feather name="settings" size={16} color={colors.zinc400} />
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({

  /* ── Backdrop ── */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.20)",
    zIndex: 100,
  },

  /* ── Panel ── */
  sidebar: {
    position:        "absolute",
    top:             0,
    left:            0,
    bottom:          0,
    width:           SIDEBAR_WIDTH,
    zIndex:          101,
    paddingHorizontal: 24,
    shadowColor:     "#000",
    shadowOffset:    { width: 12, height: 0 },
    shadowOpacity:   0.08,
    shadowRadius:    32,
    elevation:       18,
  },

  /* ── Header ── */
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    marginBottom:    30,
  },
  brandRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    flex:          1,
  },
  /* Full transparent PNG at tiny size — leaf reads, internal text invisible */
  leafIcon: {
    width:      38,
    height:     30,
    flexShrink: 0,
  },
  brandName: {
    fontSize:           48,
    fontFamily:         "Inter_700Bold",
    letterSpacing:      -1.8,
    includeFontPadding: false,
    lineHeight:         52,
  },
  closeBtn: {
    flexShrink: 0,
    padding:    2,
  },

  /* ── New chat ── */
  newChatBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    paddingVertical:   15,
    paddingHorizontal: 20,
    borderRadius:   18,
    marginBottom:   28,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 5 },
    shadowOpacity:  0.16,
    shadowRadius:   14,
    elevation:      7,
  },
  newChatText: {
    fontSize:   14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },

  /* ── Section labels ── */
  sectionLabel: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom:  10,
    textTransform: "uppercase",
  },

  /* ── Model selector ── */
  section: { marginBottom: 24 },
  modelRow: {
    flexDirection:   "row",
    alignItems:      "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius:    13,
    marginBottom:    3,
    gap:             10,
  },
  dot: {
    width:        5,
    height:       5,
    borderRadius: 3,
    flexShrink:   0,
  },
  modelInfo: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    flex:          1,
  },
  modelName: {
    fontSize:      13.5,
    letterSpacing: -0.1,
  },
  modelBadge: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
  },

  /* ── History ── */
  historySection: { flex: 1 },
  historyScroll:  { flex: 1 },
  emptyHistory: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    marginTop:     4,
    letterSpacing: 0.1,
  },
  historyRow: {
    flexDirection:   "row",
    alignItems:      "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius:    12,
    marginBottom:    2,
  },
  historyIcon: { marginRight: 9 },
  historyTitle: {
    flex:          1,
    fontSize:      13,
    letterSpacing: 0.05,
  },

  /* ── Footer ── */
  footer: {
    paddingTop:   16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop:    8,
  },
  userRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize:      13.5,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },
  userPlan: {
    fontSize:      11.5,
    fontFamily:    "Inter_400Regular",
    marginTop:     1,
    letterSpacing: 0.1,
  },

});
