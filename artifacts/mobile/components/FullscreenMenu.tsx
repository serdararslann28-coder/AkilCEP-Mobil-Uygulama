/**
 * FullscreenMenu — premium ultra-minimal AI workspace menu.
 * Icon-free menu rows, clean typography, luxury spacing.
 * PURE / VOID fully supported.
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

import { useChat }  from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";
import ThemeToggle  from "@/components/ThemeToggle";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

// ─── Static example data ────────────────────────────────────────────────────────
const PINNED = [
  { id: "pin1", title: "AkılCEP UI Tasarımı" },
  { id: "pin2", title: "Ses Asistanı Deneyimi" },
  { id: "pin3", title: "Premium Sistemi" },
];

const EXAMPLE_HISTORY = [
  { id: "h1", title: "Türkiye'nin ChatGPT Durumu",  time: "2s" },
  { id: "h2", title: "AkılCEP Tasarım Sistemi",     time: "5s" },
  { id: "h3", title: "Yeni Özellik Fikirleri",      time: "1g" },
  { id: "h4", title: "Onboarding Akışı Tasarımı",   time: "2g" },
  { id: "h5", title: "Kullanıcı Deneyimi Analizi",  time: "3g" },
];

// ─── Menu groups — icon-free, clean text only ───────────────────────────────────
const GROUP_PRIMARY = [
  { label: "Yeni Sohbet",    route: "/chat", accent: false },
  { label: "Görselleştirme", route: null,    accent: false },
] as const;

const GROUP_SECONDARY = [
  { label: "Premium",        route: null, accent: true  },
  { label: "Ayarlar",        route: null, accent: false },
  { label: "Yardım & Destek",route: null, accent: false },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────────
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
  const translateY = useSharedValue(30);

  React.useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value    = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(26, { duration: 220 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const panelStyle    = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // ── FAB scroll shrink ──────────────────────────────────────────────────────
  const scrollY  = useRef(new RNAnimated.Value(0)).current;
  const fabScale = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.78], extrapolate: "clamp" });

  // ── Navigation ─────────────────────────────────────────────────────────────
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

  // ── Merge real + example history ───────────────────────────────────────────
  const realConvs = conversations.slice(0, 5).map(c => ({
    id: c.id, title: c.title, time: "Az önce", real: true,
  }));
  const displayHistory = realConvs.length > 0
    ? realConvs
    : EXAMPLE_HISTORY.map(h => ({ ...h, real: false }));

  // ── Colour helpers ─────────────────────────────────────────────────────────
  const groupBg     = T.isDark ? "rgba(255,255,255,0.055)" : "#FFFFFF";
  const groupBorder = T.isDark ? "rgba(255,255,255,0.08)"  : "transparent";
  const divider     = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.055)";
  const iconBg      = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.04)";
  const groupShadow = T.isDark ? 0 : 0.04;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: T.isDark ? "rgba(0,0,0,0.70)" : "rgba(0,0,0,0.14)", zIndex: 200 },
          backdropStyle,
        ]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: T.bg, zIndex: 201 }, panelStyle]}
        pointerEvents={visible ? "box-none" : "none"}
      >

        {/* ════════ HEADER ════════ */}
        <View style={[ss.header, { paddingTop: topPad + 14, borderBottomColor: divider }]}>

          {/* Close — top-left */}
          <TouchableOpacity
            style={[ss.hBtn, {
              backgroundColor: groupBg,
              borderColor:     groupBorder,
              borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            }]}
            onPress={onClose} hitSlop={16} activeOpacity={0.60}
          >
            <Feather name="x" size={15} color={T.fgSoft} />
          </TouchableOpacity>

          {/* Logo — top-right */}
          <TouchableOpacity style={ss.logoWrap} hitSlop={10} activeOpacity={0.80}>
            <Image source={leafLogo} style={[ss.logoImg, { tintColor: T.logoTint }]} resizeMode="contain" />
            <Text style={[ss.logoText, { color: T.fg }]}>AkılCEP</Text>
          </TouchableOpacity>

        </View>

        {/* ════════ BODY ════════ */}
        <RNAnimated.ScrollView
          style={ss.scroll}
          contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 100 }]}
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
            style={[ss.profileCard, {
              backgroundColor: groupBg,
              borderColor:     groupBorder,
              borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
              shadowOpacity:   groupShadow,
            }]}
            onPress={() => go("/profile")}
            activeOpacity={0.82}
          >
            <View style={ss.profileLeft}>
              <View style={ss.avatarFrame}>
                <Image
                  source={avatar}
                  style={[ss.avatarImg, { borderColor: T.isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.95)" }]}
                />
                <View style={[ss.onlineDot, { backgroundColor: T.onlineDot, borderColor: groupBg }]} />
              </View>
              <View style={ss.profileText}>
                <Text style={[ss.profileName, { color: T.fg }]}>Kullanıcı</Text>
                <View style={ss.profileSubRow}>
                  <View style={[ss.planChip, { backgroundColor: T.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.048)" }]}>
                    <Text style={[ss.planChipLabel, { color: T.isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.50)" }]}>Ücretsiz</Text>
                  </View>
                  <Text style={[ss.planSub, { color: T.muted }]}>AkılCEP</Text>
                </View>
              </View>
            </View>
            <View style={[ss.profileArrow, { backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
              <Feather name="chevron-right" size={13} color={T.zinc} />
            </View>
          </TouchableOpacity>

          {/* ── SABİTLENENLER ── */}
          <SectionHeader title="SABİTLENENLER" T={T} />
          <View style={[ss.listCard, {
            backgroundColor: groupBg,
            borderColor:     groupBorder,
            borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:   groupShadow,
          }]}>
            {PINNED.map((item, idx) => (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={ss.histRow}
                  activeOpacity={0.62}
                  onPress={() => Haptics.selectionAsync()}
                >
                  <View style={[ss.histIcon, { backgroundColor: iconBg }]}>
                    <Feather name="bookmark" size={11} color={T.muted} />
                  </View>
                  <Text style={[ss.histTitle, { color: T.fg }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TouchableOpacity
                    hitSlop={14}
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <Feather name="more-horizontal" size={13} color={T.isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)"} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {idx < PINNED.length - 1 && (
                  <View style={[ss.div, { backgroundColor: divider, marginLeft: 16 }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── GEÇMİŞ SOHBETLER ── */}
          <SectionHeader title="GEÇMİŞ SOHBETLER" T={T} action="Tümünü Gör" />
          <View style={[ss.listCard, {
            backgroundColor: groupBg,
            borderColor:     groupBorder,
            borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:   groupShadow,
          }]}>
            {displayHistory.map((item, idx) => {
              const active = currentConversation?.id === item.id;
              return (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    style={[ss.histRow, active && {
                      backgroundColor: T.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.042)",
                    }]}
                    activeOpacity={0.62}
                    onPress={() => {
                      if (item.real) {
                        Haptics.selectionAsync();
                        loadConversation(item.id);
                        onClose();
                        router.push("/chat");
                      } else {
                        Haptics.selectionAsync();
                      }
                    }}
                  >
                    <View style={[ss.histIcon, {
                      backgroundColor: active
                        ? (T.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)")
                        : iconBg,
                    }]}>
                      <Feather
                        name="message-square"
                        size={11}
                        color={active ? (T.isDark ? "rgba(255,255,255,0.65)" : "rgba(60,60,67,0.62)") : T.muted}
                      />
                    </View>
                    <Text style={[ss.histTitle, { color: T.fg, flex: 1 }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[ss.histTime, { color: T.zinc }]}>{item.time}</Text>
                    <TouchableOpacity
                      hitSlop={14}
                      onPress={() => {
                        if (item.real) deleteConversation(item.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Feather name="more-horizontal" size={13} color={T.isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)"} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {idx < displayHistory.length - 1 && (
                    <View style={[ss.div, { backgroundColor: divider, marginLeft: 16 }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Primary menu group — text only, no icons ── */}
          <View style={[ss.listCard, {
            backgroundColor: groupBg,
            borderColor:     groupBorder,
            borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:   groupShadow,
          }]}>
            {GROUP_PRIMARY.map((item, idx) => (
              <React.Fragment key={item.label}>
                <MenuItem
                  item={item}
                  T={T}
                  onPress={() => { Haptics.selectionAsync(); if (item.route) go(item.route); }}
                />
                {idx < GROUP_PRIMARY.length - 1 && (
                  <View style={[ss.div, { backgroundColor: divider, marginLeft: 16 }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── Secondary menu group — text only, no icons ── */}
          <View style={[ss.listCard, {
            backgroundColor: groupBg,
            borderColor:     groupBorder,
            borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:   groupShadow,
          }]}>
            {GROUP_SECONDARY.map((item, idx) => (
              <React.Fragment key={item.label}>
                <MenuItem
                  item={item}
                  T={T}
                  onPress={() => { Haptics.selectionAsync(); if (item.route) go(item.route); }}
                />
                {idx < GROUP_SECONDARY.length - 1 && (
                  <View style={[ss.div, { backgroundColor: divider, marginLeft: 16 }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── Çıkış Yap — soft red text, no icon ── */}
          <View style={[ss.listCard, {
            backgroundColor: groupBg,
            borderColor:     groupBorder,
            borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
            shadowOpacity:   groupShadow,
          }]}>
            <TouchableOpacity
              style={ss.menuRow}
              activeOpacity={0.60}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
            >
              <Text style={[ss.menuLabel, {
                color: T.isDark ? "rgba(255,80,70,0.72)" : "rgba(220,38,30,0.82)",
              }]}>
                Çıkış Yap
              </Text>
            </TouchableOpacity>
          </View>

        </RNAnimated.ScrollView>

        {/* ════════ BOTTOM BAR ════════ */}
        <View style={[ss.bottomBar, { paddingBottom: btmPad + 14, borderTopColor: divider }]}>

          {/* Sliding capsule — bottom-left */}
          <ThemeToggle />

          <View style={{ flex: 1 }} />

          {/* Circular FAB — bottom-right */}
          <RNAnimated.View style={{ transform: [{ scale: fabScale }] }}>
            <TouchableOpacity
              style={[ss.fab, {
                backgroundColor: T.isDark ? "rgba(255,255,255,0.12)" : "#0A0A0A",
                shadowOpacity:   T.isDark ? 0 : 0.22,
                borderWidth:     T.isDark ? StyleSheet.hairlineWidth : 0,
                borderColor:     "rgba(255,255,255,0.12)",
              }]}
              onPress={handleNewChat}
              activeOpacity={0.78}
            >
              <Feather name="edit-3" size={18} color={T.isDark ? "rgba(237,235,231,0.80)" : "#FFFFFF"} />
            </TouchableOpacity>
          </RNAnimated.View>

        </View>

      </Animated.View>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title, T, action }: { title: string; T: any; action?: string }) {
  return (
    <View style={ss.sectionHeader}>
      <Text style={[ss.sectionTitle, { color: T.zinc }]}>{title}</Text>
      {action && (
        <TouchableOpacity hitSlop={10} onPress={() => Haptics.selectionAsync()}>
          <Text style={[ss.sectionAction, {
            color: T.isDark ? "rgba(255,255,255,0.32)" : "rgba(60,60,67,0.52)",
          }]}>
            {action}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Icon-free menu row — label left, chevron or PRO badge right
function MenuItem({
  item,
  T,
  onPress,
}: {
  item: { label: string; accent: boolean };
  T: any;
  onPress: () => void;
}) {
  const chevronClr = T.isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";
  return (
    <TouchableOpacity style={ss.menuRow} activeOpacity={0.60} onPress={onPress}>
      <Text style={[ss.menuLabel, { color: T.fg }]}>
        {item.label}
      </Text>
      {item.accent ? (
        <View style={[ss.proBadge, { backgroundColor: T.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <Text style={[ss.proBadgeText, { color: T.isDark ? "rgba(237,235,231,0.65)" : "rgba(0,0,0,0.55)" }]}>PRO</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={12} color={chevronClr} />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const FAB_SIZE = 50;

const ss = StyleSheet.create({

  // ── Header (invisible — no border, no background bar)
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  hBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  logoImg:  { width: 18, height: 18 },
  logoText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 3.0 },

  // ── Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, gap: 8 },

  // ── Profile card
  profileCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 18, padding: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowRadius: 12, elevation: 3,
    marginBottom: 2,
  },
  profileLeft:   { flexDirection: "row", alignItems: "center", gap: 13, flex: 1 },
  avatarFrame:   { width: 48, height: 48 },
  avatarImg:     { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  onlineDot:     { position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  profileText:   { flex: 1, gap: 5 },
  profileName:   { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: -0.3 },
  profileSubRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  planChip:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  planChipLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.1 },
  planSub:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  profileArrow:  { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  // ── Section headers
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 4, paddingTop: 6, paddingBottom: 6,
  },
  sectionTitle:  { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.0, textTransform: "uppercase" },
  sectionAction: { fontSize: 12, fontFamily: "Inter_400Regular", letterSpacing: -0.1 },

  // ── List cards (pinned / history / menu)
  listCard: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },

  // ── History rows (keep icon for bookmark + message-square)
  histRow:  {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 14, gap: 10,
  },
  histIcon:  { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  histTitle: { fontSize: 14, fontFamily: "Inter_400Regular", letterSpacing: -0.05 },
  histTime:  { fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 0.1, marginRight: 4 },

  // ── Menu rows — icon-free, generous horizontal padding
  menuRow:   {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 15, paddingHorizontal: 18,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: -0.15 },
  proBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  proBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },

  // ── Divider
  div: { height: StyleSheet.hairlineWidth },

  // ── Bottom bar
  bottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // ── FAB
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8,
  },
});
