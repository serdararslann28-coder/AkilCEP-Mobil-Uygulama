/**
 * FullscreenMenu — premium full-screen navigation overlay.
 * Fully theme-aware: PURE (light glass) / VOID (cinematic black glass).
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat }     from "@/context/ChatContext";
import { useTheme }    from "@/context/ThemeContext";
import ThemeToggle     from "@/components/ThemeToggle";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

// ─── Menu items ───────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { icon: "plus-circle",  label: "Yeni Sohbet",       route: "/chat",   accent: false },
  { icon: "image",        label: "Görselleştirme",     route: null,      accent: false },
  { icon: "mic",          label: "Voice Mode",         route: "/voice",  accent: false },
  { icon: "cpu",          label: "AkılCEP Modelleri",  route: null,      accent: false },
  { icon: "bookmark",     label: "Hafıza",             route: null,      accent: false },
  { icon: "star",         label: "Premium",            route: null,      accent: true  },
  { icon: "settings",     label: "Ayarlar",            route: null,      accent: false },
  { icon: "help-circle",  label: "Yardım & Destek",    route: null,      accent: false },
] as const;

const PINNED = [
  { id: "p1", title: "Proje planlaması nasıl yapılır?" },
  { id: "p2", title: "React Native animasyonları" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FullscreenMenu({ visible, onClose }: Props) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top;
  const btmPad  = Platform.OS === "web" ? 34 : insets.bottom;
  const { theme } = useTheme();
  const T = theme;

  const {
    conversations, currentConversation,
    loadConversation, startNewConversation, deleteConversation,
  } = useChat();

  // ── Entrance animation ──
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.96);
  const translateY = useSharedValue(22);

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1,    { duration: 240, easing: Easing.out(Easing.ease) });
      scale.value      = withTiming(1,    { duration: 300, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0,    { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value    = withTiming(0,    { duration: 200, easing: Easing.in(Easing.ease) });
      scale.value      = withTiming(0.96, { duration: 220 });
      translateY.value = withTiming(18,   { duration: 220 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const panelStyle    = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const go = (route: string) => {
    Haptics.selectionAsync();
    onClose();
    router.push(route as any);
  };

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    onClose();
    router.push("/chat");
  };

  const recentConvs = conversations.slice(0, 6);

  // ─── Dynamic style helpers ─────────────────────────────────────────────────
  const cardShadow = T.isDark
    ? {}
    : { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 };

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: T.isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.18)", zIndex: 200 }, backdropStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: T.bg, zIndex: 201 }, panelStyle]}
        pointerEvents={visible ? "box-none" : "none"}
      >

        {/* ── Header ── */}
        <View style={[ss.header, { paddingTop: topPad + 12, borderBottomColor: T.border }]}>
          <TouchableOpacity
            style={[ss.headerBtn, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
            onPress={onClose} hitSlop={14} activeOpacity={0.6}
          >
            <Feather name="x" size={18} color={T.fgSoft} />
          </TouchableOpacity>

          <View style={ss.headerCenter}>
            <Image source={leafLogo} style={[ss.headerLogo, { tintColor: T.logoTint }]} resizeMode="contain" />
            <Text style={[ss.headerBrand, { color: T.fg }]}>A K I L C E P</Text>
          </View>

          <View style={ss.headerRight}>
            <TouchableOpacity
              style={[ss.headerBtn, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
              hitSlop={14} activeOpacity={0.6}
            >
              <Feather name="search" size={17} color={T.fgSoft} />
            </TouchableOpacity>
            <TouchableOpacity style={ss.avatarWrap} onPress={() => go("/profile")} hitSlop={10} activeOpacity={0.8}>
              <Image source={avatar} style={[ss.avatarImg, { borderColor: T.isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)" }]} />
              <View style={[ss.headerOnlineDot, { backgroundColor: T.onlineDot, borderColor: T.bg }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Body ── */}
        <ScrollView style={ss.scroll} contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 100 }]} showsVerticalScrollIndicator={false}>

          {/* Profile card */}
          <TouchableOpacity
            style={[ss.profileCard, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }, cardShadow]}
            onPress={() => go("/profile")} activeOpacity={0.84}
          >
            <View style={ss.profileLeft}>
              <View>
                <Image source={avatar} style={[ss.profileAvatar, { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.95)" }]} />
                <View style={[ss.profileOnlineDot, { backgroundColor: T.onlineDot, borderColor: T.card }]} />
              </View>
              <View style={ss.profileInfo}>
                <Text style={[ss.profileName, { color: T.fg }]}>Kullanıcı</Text>
                <View style={[ss.planBadge, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                  <Text style={[ss.planText, { color: T.muted }]}>Ücretsiz Plan</Text>
                </View>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={T.zinc} />
          </TouchableOpacity>

          {/* Menu items */}
          <View style={[ss.menuCard, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }, cardShadow]}>
            {MENU_ITEMS.map((item, idx) => {
              const isLast = idx === MENU_ITEMS.length - 1;
              return (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={ss.menuRow}
                    activeOpacity={0.62}
                    onPress={() => { Haptics.selectionAsync(); if (item.route) go(item.route); }}
                  >
                    <View style={[ss.menuIcon, { backgroundColor: item.accent ? T.greenTint : T.cardAlt }]}>
                      <Feather name={item.icon as any} size={15} color={item.accent ? T.greenEmphasis : T.fgSoft} />
                    </View>
                    <Text style={[ss.menuLabel, { color: item.accent ? T.greenEmphasis : T.fg }]}>
                      {item.label}
                    </Text>
                    {item.accent ? (
                      <View style={[ss.premiumBadge, { backgroundColor: T.greenTint }]}>
                        <Text style={[ss.premiumBadgeText, { color: T.greenEmphasis }]}>PRO</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={14} color={T.zinc} />
                    )}
                  </TouchableOpacity>
                  {!isLast && <View style={[ss.divider, { backgroundColor: T.border }]} />}
                </React.Fragment>
              );
            })}
          </View>

          {/* Pinned chats */}
          <View style={ss.section}>
            <View style={ss.sectionHeader}>
              <Feather name="bookmark" size={11} color={T.zinc} />
              <Text style={[ss.sectionTitle, { color: T.zinc }]}>Sabitlendi</Text>
            </View>
            <View style={[ss.chatCard, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }, cardShadow]}>
              {PINNED.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <TouchableOpacity style={ss.chatRow} activeOpacity={0.65}>
                    <View style={[ss.chatIconWrap, { backgroundColor: T.cardAlt }]}>
                      <Feather name="message-square" size={13} color={T.muted} />
                    </View>
                    <Text style={[ss.chatTitle, { color: T.fgSoft }]} numberOfLines={1}>{p.title}</Text>
                    <Feather name="more-horizontal" size={14} color={T.zinc} />
                  </TouchableOpacity>
                  {idx < PINNED.length - 1 && <View style={[ss.divider, { backgroundColor: T.border }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Recent chats */}
          {recentConvs.length > 0 && (
            <View style={ss.section}>
              <View style={ss.sectionHeader}>
                <Feather name="clock" size={11} color={T.zinc} />
                <Text style={[ss.sectionTitle, { color: T.zinc }]}>Yakın Zamandakiler</Text>
              </View>
              <View style={[ss.chatCard, { backgroundColor: T.card, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }, cardShadow]}>
                {recentConvs.map((conv, idx) => {
                  const active = currentConversation?.id === conv.id;
                  return (
                    <React.Fragment key={conv.id}>
                      <TouchableOpacity
                        style={[ss.chatRow, active && { backgroundColor: T.greenTint }]}
                        activeOpacity={0.65}
                        onPress={() => { Haptics.selectionAsync(); loadConversation(conv.id); onClose(); router.push("/chat"); }}
                      >
                        <View style={[ss.chatIconWrap, { backgroundColor: active ? T.greenTint : T.cardAlt }]}>
                          <Feather name="message-square" size={13} color={active ? T.greenEmphasis : T.muted} />
                        </View>
                        <View style={ss.chatMeta}>
                          <Text style={[ss.chatTitle, { color: active ? T.greenEmphasis : T.fgSoft }]} numberOfLines={1}>{conv.title}</Text>
                          <Text style={[ss.chatTime, { color: T.zinc }]}>Az önce</Text>
                        </View>
                        <TouchableOpacity hitSlop={12} onPress={() => { deleteConversation(conv.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                          <Feather name="more-horizontal" size={14} color={T.zinc} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {idx < recentConvs.length - 1 && <View style={[ss.divider, { backgroundColor: T.border }]} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}

        </ScrollView>

        {/* ── Bottom bar — theme toggle lives here ── */}
        <View style={[ss.bottomBar, { paddingBottom: btmPad + 10, borderTopColor: T.border }]}>
          <ThemeToggle bottomOffset={0} leftOffset={0} />
        </View>

        {/* ── FAB ── */}
        <TouchableOpacity
          style={[ss.fab, { bottom: btmPad + 22, backgroundColor: T.isDark ? T.card : "#111111", borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
          onPress={handleNewChat}
          activeOpacity={0.82}
        >
          <Feather name="edit-3" size={16} color={T.isDark ? T.fg : "#FFFFFF"} />
          <Text style={[ss.fabLabel, { color: T.isDark ? T.fg : "#FFFFFF" }]}>Yeni Sohbet</Text>
        </TouchableOpacity>

      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo:   { width: 22, height: 22 },
  headerBrand:  { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 3.2 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarWrap:   { width: 38, height: 38, borderRadius: 19 },
  avatarImg:    { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5 },
  headerOnlineDot: { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 24 },

  profileCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 20, padding: 18, marginBottom: 14,
  },
  profileLeft:      { flexDirection: "row", alignItems: "center", gap: 14 },
  profileAvatar:    { width: 54, height: 54, borderRadius: 27, borderWidth: 2 },
  profileOnlineDot: { position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  profileInfo:      { gap: 6 },
  profileName:      { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.3 },
  planBadge:        { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignSelf: "flex-start" },
  planText:         { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.1 },

  menuCard:    { borderRadius: 18, marginBottom: 14, overflow: "hidden" },
  menuRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, gap: 13 },
  menuIcon:    { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel:   { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: -0.1 },
  premiumBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  premiumBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  section:       { marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, marginBottom: 8 },
  sectionTitle:  { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },

  chatCard:     { borderRadius: 16, overflow: "hidden" },
  chatRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  chatIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  chatMeta:     { flex: 1, gap: 2 },
  chatTitle:    { fontSize: 14, fontFamily: "Inter_400Regular", letterSpacing: -0.05 },
  chatTime:     { fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 0.1 },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 72,
    justifyContent: "center",
  },

  fab: {
    position: "absolute", right: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 13, paddingHorizontal: 20, borderRadius: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10,
  },
  fabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: -0.1 },
});
