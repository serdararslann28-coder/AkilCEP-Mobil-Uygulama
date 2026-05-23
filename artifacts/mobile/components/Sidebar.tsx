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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AI_MODELS, useChat } from "@/context/ChatContext";
import BrandHeader from "@/components/BrandHeader";

// ─── Home-screen palette (hardcoded, same tokens as index.tsx) ────────────────
const C = {
  bg:             "#EBEBEC",
  foreground:     "#1C1C1E",
  muted:          "#8E8E93",
  zinc400:        "#AEAEB2",
  card:           "rgba(255,255,255,0.82)",
  activeRow:      "rgba(255,255,255,0.72)",
  border:         "rgba(0,0,0,0.07)",
  pillBg:         "#1C1C1E",
  pillText:       "#FFFFFF",
};

const SCREEN_WIDTH  = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
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
      <Animated.View style={[styles.sidebar, sidebarStyle]}>

        {/* ════════════════════════════════
            HEADER
        ════════════════════════════════ */}
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <BrandHeader color={C.foreground} />
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={14}
          >
            <Feather name="x" size={18} color={C.zinc400} />
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════
            NEW CHAT
        ════════════════════════════════ */}
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={handleNewChat}
          activeOpacity={0.78}
        >
          <Feather name="plus" size={16} color={C.pillText} />
          <Text style={styles.newChatText}>Yeni Sohbet</Text>
        </TouchableOpacity>

        {/* ════════════════════════════════
            MODEL SELECTOR
        ════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MODEL</Text>
          {AI_MODELS.map((model) => {
            const active = selectedModel === model.id;
            return (
              <TouchableOpacity
                key={model.id}
                style={[styles.modelRow, active && styles.modelRowActive]}
                onPress={() => {
                  setSelectedModel(model.id);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modelInfo}>
                  <Text
                    style={[
                      styles.modelName,
                      active && styles.modelNameActive,
                    ]}
                  >
                    {model.name}
                  </Text>
                  <Text style={styles.modelBadge}>{model.badge}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ════════════════════════════════
            CONVERSATION HISTORY
        ════════════════════════════════ */}
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>GEÇMİŞ</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.historyScroll}>
            {conversations.length === 0 ? (
              <Text style={styles.emptyHistory}>Henüz sohbet yok</Text>
            ) : (
              conversations.map((conv) => {
                const active = currentConversation?.id === conv.id;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[styles.historyRow, active && styles.historyRowActive]}
                    onPress={() => handleConversation(conv.id)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="message-square"
                      size={12}
                      color={active ? C.foreground : C.zinc400}
                      style={styles.historyIcon}
                    />
                    <Text
                      style={[
                        styles.historyTitle,
                        active && styles.historyTitleActive,
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
                      <Feather name="trash-2" size={11} color={C.zinc400} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* ════════════════════════════════
            FOOTER
        ════════════════════════════════ */}
        <View style={[styles.footer, { paddingBottom: bottomPad + 14 }]}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={14} color={C.foreground} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>Kullanıcı</Text>
              <Text style={styles.userPlan}>Ücretsiz Plan</Text>
            </View>
            <TouchableOpacity hitSlop={12}>
              <Feather name="settings" size={16} color={C.zinc400} />
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
    zIndex: 100,
  },

  sidebar: {
    position:          "absolute",
    top:               0,
    left:              0,
    bottom:            0,
    width:             SIDEBAR_WIDTH,
    zIndex:            101,
    backgroundColor:   C.bg,
    paddingHorizontal: 24,
    overflow:          "hidden",
    shadowColor:       "#000",
    shadowOffset:      { width: 16, height: 0 },
    shadowOpacity:     0.07,
    shadowRadius:      40,
    elevation:         18,
  },

  /* ── Header ── */
  header: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   30,
  },
  closeBtn: { padding: 2 },

  /* ── New chat pill ── */
  newChatBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    paddingVertical:   15,
    paddingHorizontal: 20,
    borderRadius:      18,
    marginBottom:      28,
    backgroundColor:   C.pillBg,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.12,
    shadowRadius:      12,
    elevation:         6,
  },
  newChatText: {
    fontSize:      14,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.1,
    color:         C.pillText,
  },

  /* ── Section labels ── */
  sectionLabel: {
    fontSize:      10,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom:  10,
    color:         C.zinc400,
    textTransform: "uppercase",
  },

  /* ── Model selector ── */
  section:   { marginBottom: 24 },
  modelRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   11,
    paddingHorizontal: 12,
    borderRadius:      13,
    marginBottom:      3,
    gap:               10,
  },
  modelRowActive: { backgroundColor: C.activeRow },
  modelInfo: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    flex:          1,
  },
  modelName: {
    fontSize:      13.5,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    color:         C.muted,
  },
  modelNameActive: {
    fontFamily: "Inter_600SemiBold",
    color:      C.foreground,
  },
  modelBadge: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
    color:      C.zinc400,
  },

  /* ── History ── */
  historySection: { flex: 1 },
  historyScroll:  { flex: 1 },
  emptyHistory: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    marginTop:     4,
    letterSpacing: 0.1,
    color:         C.zinc400,
  },
  historyRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   10,
    paddingHorizontal: 10,
    borderRadius:      12,
    marginBottom:      2,
  },
  historyRowActive:  { backgroundColor: C.activeRow },
  historyIcon:       { marginRight: 9 },
  historyTitle: {
    flex:          1,
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
    color:         C.muted,
  },
  historyTitleActive: {
    fontFamily: "Inter_500Medium",
    color:      C.foreground,
  },

  /* ── Footer ── */
  footer: {
    paddingTop:     16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    marginTop:      8,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: C.card,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize:      13.5,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
    color:         C.foreground,
  },
  userPlan: {
    fontSize:      11.5,
    fontFamily:    "Inter_400Regular",
    marginTop:     1,
    letterSpacing: 0.1,
    color:         C.zinc400,
  },

});
