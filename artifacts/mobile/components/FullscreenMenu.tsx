/**
 * FullscreenMenu — ChatGPT iOS × Apple luxury navigation overlay.
 * Sliding capsule theme toggle · circular compose FAB · PURE / VOID.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated as RNAnimated,
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

import { useChat }   from "@/context/ChatContext";
import { useTheme }  from "@/context/ThemeContext";
import ThemeToggle   from "@/components/ThemeToggle";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

// ─── Menu structure ───────────────────────────────────────────────────────────
const GROUPS = [
  [
    { icon: "edit-3",      label: "Yeni Sohbet",      route: "/chat",  accent: false },
    { icon: "image",       label: "Görselleştirme",    route: null,     accent: false },
    { icon: "mic",         label: "Voice Mode",        route: "/voice", accent: false },
    { icon: "cpu",         label: "AkılCEP Modelleri", route: null,     accent: false },
  ],
  [
    { icon: "bookmark",    label: "Hafıza",            route: null,     accent: false },
    { icon: "star",        label: "Premium",           route: null,     accent: true  },
  ],
  [
    { icon: "settings",    label: "Ayarlar",           route: null,     accent: false },
    { icon: "help-circle", label: "Yardım & Destek",   route: null,     accent: false },
  ],
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FullscreenMenu({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { theme } = useTheme();
  const T = theme;
  const {
    conversations, currentConversation,
    loadConversation, startNewConversation, deleteConversation,
  } = useChat();

  // ── Entrance / exit ────────────────────────────────────────────────────────
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(28);

  React.useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value    = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(22, { duration: 220 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const panelStyle    = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // ── FAB scroll shrink ──────────────────────────────────────────────────────
  const scrollY  = useRef(new RNAnimated.Value(0)).current;
  const fabScale = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.80], extrapolate: "clamp" });

  // ── Navigation helpers ─────────────────────────────────────────────────────
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

  const recentConvs = conversations.slice(0, 8);

  // ── Dynamic tokens ─────────────────────────────────────────────────────────
  const dividerClr   = T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.055)";
  const groupBg      = T.isDark ? "rgba(255,255,255,0.055)" : "#FFFFFF";
  const groupBorder  = T.isDark ? "rgba(255,255,255,0.08)"  : "transparent";
  const iconWrapBg   = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.04)";
  const accentIconBg = T.isDark ? T.greenTint                : "rgba(107,203,142,0.10)";
  const groupShadow  = T.isDark ? 0 : 0.04;

  return (
    <>
      {/* ── Backdrop ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: T.isDark ? "rgba(0,0,0,0.68)" : "rgba(0,0,0,0.14)", zIndex: 200 },
          backdropStyle,
        ]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Full panel ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: T.bg, zIndex: 201 }, panelStyle]}
        pointerEvents={visible ? "box-none" : "none"}
      >

        {/* ────────── Fixed header ────────── */}
        <View style={[ss.header, { paddingTop: topPad + 16, borderBottomColor: dividerClr }]}>

          {/* Close button */}
          <TouchableOpacity
            style={[ss.headerCircle, { backgroundColor: groupBg, borderColor: groupBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}
            onPress={onClose} hitSlop={16} activeOpacity={0.62}
          >
            <Feather name="x" size={15} color={T.fgSoft} />
          </TouchableOpacity>

          {/* Centered logo */}
          <View style={ss.headerCenter}>
            <Image source={leafLogo} style={[ss.headerLogo, { tintColor: T.logoTint }]} resizeMode="contain" />
            <Text style={[ss.headerWordmark, { color: T.fg }]}>AKILCEP</Text>
          </View>

          {/* Avatar */}
          <TouchableOpacity
            style={ss.headerAvatarWrap}
            onPress={() => go("/profile")}
            hitSlop={10} activeOpacity={0.80}
          >
            <Image
              source={avatar}
              style={[ss.headerAvatar, { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)" }]}
            />
            <View style={[ss.headerOnline, { backgroundColor: T.onlineDot, borderColor: T.bg }]} />
          </TouchableOpacity>

        </View>

        {/* ────────── Scrollable body ────────── */}
        <RNAnimated.ScrollView
          style={ss.scroll}
          contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 96 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
        >

          {/* ── Profile card ── */}
          <TouchableOpacity
            style={[
              ss.profileCard,
              { backgroundColor: groupBg, borderColor: groupBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, shadowOpacity: groupShadow },
            ]}
            onPress={() => go("/profile")}
            activeOpacity={0.82}
          >
            <View style={ss.profileLeft}>
              {/* Avatar + online dot */}
              <View style={ss.profileAvatarWrap}>
                <Image
                  source={avatar}
                  style={[ss.profileAvatar, { borderColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.95)" }]}
                />
                <View style={[ss.profileOnline, { backgroundColor: T.onlineDot, borderColor: groupBg }]} />
              </View>

              {/* Text */}
              <View style={ss.profileMeta}>
                <Text style={[ss.profileName, { color: T.fg }]}>Kullanıcı</Text>
                <View style={ss.profileSubRow}>
                  <View style={[ss.planChip, { backgroundColor: T.isDark ? T.greenTint : "rgba(107,203,142,0.12)" }]}>
                    <Text style={[ss.planChipText, { color: T.green }]}>Ücretsiz</Text>
                  </View>
                  <Text style={[ss.planSub, { color: T.muted }]}>AkılCEP AI</Text>
                </View>
              </View>
            </View>

            {/* Arrow */}
            <View style={[ss.profileArrow, { backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
              <Feather name="chevron-right" size={13} color={T.zinc} />
            </View>
          </TouchableOpacity>

          {/* ── Menu groups ── */}
          {GROUPS.map((group, gi) => (
            <View
              key={gi}
              style={[ss.group, { backgroundColor: groupBg, borderColor: groupBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, shadowOpacity: groupShadow }]}
            >
              {group.map((item, ii) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={ss.menuRow}
                    activeOpacity={0.60}
                    onPress={() => { Haptics.selectionAsync(); if (item.route) go(item.route); }}
                  >
                    <View style={[ss.menuIconWrap, { backgroundColor: item.accent ? accentIconBg : iconWrapBg }]}>
                      <Feather name={item.icon as any} size={13} color={item.accent ? T.green : T.fgSoft} />
                    </View>
                    <Text style={[ss.menuLabel, { color: item.accent ? T.green : T.fg }]}>
                      {item.label}
                    </Text>
                    {item.accent ? (
                      <View style={[ss.proBadge, { backgroundColor: T.greenTint }]}>
                        <Text style={[ss.proBadgeText, { color: T.greenEmphasis }]}>PRO</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={12} color={T.isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)"} />
                    )}
                  </TouchableOpacity>
                  {ii < group.length - 1 && (
                    <View style={[ss.divider, { backgroundColor: dividerClr, marginLeft: 56 }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          ))}

          {/* ── Recent conversations ── */}
          {recentConvs.length > 0 && (
            <>
              <Text style={[ss.sectionLabel, { color: T.zinc }]}>Son Sohbetler</Text>
              <View style={[ss.group, { backgroundColor: groupBg, borderColor: groupBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, shadowOpacity: groupShadow }]}>
                {recentConvs.map((conv, idx) => {
                  const active = currentConversation?.id === conv.id;
                  return (
                    <React.Fragment key={conv.id}>
                      <TouchableOpacity
                        style={[ss.menuRow, active && { backgroundColor: T.isDark ? T.greenTint : "rgba(107,203,142,0.07)" }]}
                        activeOpacity={0.62}
                        onPress={() => { Haptics.selectionAsync(); loadConversation(conv.id); onClose(); router.push("/chat"); }}
                      >
                        <View style={[ss.menuIconWrap, { backgroundColor: active ? T.greenTint : iconWrapBg }]}>
                          <Feather name="message-square" size={13} color={active ? T.green : T.muted} />
                        </View>
                        <Text style={[ss.menuLabel, { color: active ? T.green : T.fg }]} numberOfLines={1}>
                          {conv.title}
                        </Text>
                        <TouchableOpacity hitSlop={14} onPress={() => { deleteConversation(conv.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                          <Feather name="more-horizontal" size={13} color={T.isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)"} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {idx < recentConvs.length - 1 && (
                        <View style={[ss.divider, { backgroundColor: dividerClr, marginLeft: 56 }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Sign out ── */}
          <View style={[ss.group, { backgroundColor: groupBg, borderColor: groupBorder, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, shadowOpacity: groupShadow }]}>
            <TouchableOpacity
              style={ss.menuRow}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
              activeOpacity={0.60}
            >
              <View style={[ss.menuIconWrap, { backgroundColor: "rgba(255,59,48,0.09)" }]}>
                <Feather name="log-out" size={13} color="#FF3B30" />
              </View>
              <Text style={[ss.menuLabel, { color: "#FF3B30" }]}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>

        </RNAnimated.ScrollView>

        {/* ────────── Bottom bar ────────── */}
        <View style={[ss.bottomBar, { paddingBottom: btmPad + 16, borderTopColor: dividerClr }]}>

          {/* Sliding capsule theme toggle — bottom-left */}
          <ThemeToggle />

          <View style={{ flex: 1 }} />

          {/* Circular compose FAB — bottom-right */}
          <RNAnimated.View style={[ss.fabWrap, { transform: [{ scale: fabScale }] }]}>
            <TouchableOpacity
              style={[
                ss.fab,
                {
                  backgroundColor: T.isDark ? "#F0F0F0" : "#0A0A0A",
                  shadowOpacity: T.isDark ? 0 : 0.22,
                },
              ]}
              onPress={handleNewChat}
              activeOpacity={0.80}
            >
              <Feather name="edit-3" size={18} color={T.isDark ? "#0A0A0A" : "#FFFFFF"} />
            </TouchableOpacity>
          </RNAnimated.View>

        </View>

      </Animated.View>
    </>
  );
}

const FAB_SIZE = 52;

const ss = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter:   { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo:     { width: 18, height: 18 },
  headerWordmark: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 3.2 },
  headerAvatarWrap: { width: 36, height: 36 },
  headerAvatar:   { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5 },
  headerOnline:   { position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },

  // Profile card
  profileCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowRadius: 12, elevation: 3,
  },
  profileLeft:       { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  profileAvatarWrap: { width: 50, height: 50 },
  profileAvatar:     { width: 50, height: 50, borderRadius: 25, borderWidth: 2 },
  profileOnline:     { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  profileMeta:       { flex: 1, gap: 6 },
  profileName:       { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.4 },
  profileSubRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  planChip:          { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  planChipText:      { fontSize: 11, fontFamily: "Inter_500Medium" },
  planSub:           { fontSize: 12, fontFamily: "Inter_400Regular" },
  profileArrow:      { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  // Groups
  group: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },
  menuRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 13, paddingHorizontal: 16, gap: 14,
  },
  menuIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  menuLabel:    { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: -0.1 },
  proBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  proBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  divider:      { height: StyleSheet.hairlineWidth },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6, textTransform: "uppercase",
    paddingHorizontal: 4, paddingBottom: 6, paddingTop: 4,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // FAB — circle
  fabWrap: {},
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8,
  },
});
