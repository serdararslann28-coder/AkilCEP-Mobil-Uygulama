/**
 * FullscreenMenu — premium full-screen navigation overlay.
 * ChatGPT × Apple luxury minimalism × AKILCEP branding.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

import { useChat } from "@/context/ChatContext";

const { width: W, height: H } = Dimensions.get("window");
const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          "#F5F5F3",
  card:        "#FFFFFF",
  cardAlt:     "#F8F8F6",
  border:      "rgba(0,0,0,0.055)",
  fg:          "#1C1C1E",
  charcoal:    "#3A3A3C",
  muted:       "#8E8E93",
  zinc:        "#AEAEB2",
  green:       "#6BCB8E",
  greenLight:  "rgba(107,203,142,0.13)",
  greenDark:   "#4BAE72",
  black:       "#111111",
};

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

// ─── Pinned mock ──────────────────────────────────────────────────────────────
const PINNED = [
  { id: "p1", title: "Proje planlaması nasıl yapılır?" },
  { id: "p2", title: "React Native animasyonları" },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FullscreenMenu({ visible, onClose }: Props) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top;
  const btmPad  = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    conversations,
    currentConversation,
    loadConversation,
    startNewConversation,
    deleteConversation,
  } = useChat();

  const [darkMode, setDarkMode] = useState(false);

  // ── Animation ──
  const opacity   = useSharedValue(0);
  const scale     = useSharedValue(0.96);
  const translateY = useSharedValue(24);

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

  // ── Actions ──
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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Backdrop ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.backdrop, backdropStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Panel ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ss.panel, panelStyle]}
        pointerEvents={visible ? "box-none" : "none"}
      >

        {/* ════════════════════════════════
            HEADER
        ════════════════════════════════ */}
        <View style={[ss.header, { paddingTop: topPad + 12 }]}>

          {/* Left — close */}
          <TouchableOpacity style={ss.headerBtn} onPress={onClose} hitSlop={14} activeOpacity={0.6}>
            <Feather name="x" size={18} color={C.charcoal} />
          </TouchableOpacity>

          {/* Center — logo + wordmark */}
          <View style={ss.headerCenter}>
            <Image source={leafLogo} style={ss.headerLogo} resizeMode="contain" />
            <Text style={ss.headerBrand}>A K I L C E P</Text>
          </View>

          {/* Right — search + avatar */}
          <View style={ss.headerRight}>
            <TouchableOpacity style={ss.headerBtn} hitSlop={14} activeOpacity={0.6}>
              <Feather name="search" size={17} color={C.charcoal} />
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.avatarWrap}
              onPress={() => go("/profile")}
              hitSlop={10}
              activeOpacity={0.8}
            >
              <Image source={avatar} style={ss.avatarImg} />
              <View style={ss.headerOnlineDot} />
            </TouchableOpacity>
          </View>

        </View>

        {/* ════════════════════════════════
            SCROLLABLE BODY
        ════════════════════════════════ */}
        <ScrollView
          style={ss.scroll}
          contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Profile card ── */}
          <TouchableOpacity
            style={ss.profileCard}
            onPress={() => go("/profile")}
            activeOpacity={0.84}
          >
            <View style={ss.profileLeft}>
              <View style={ss.profileAvatarWrap}>
                <Image source={avatar} style={ss.profileAvatar} />
                <View style={ss.profileOnlineDot} />
              </View>
              <View style={ss.profileInfo}>
                <Text style={ss.profileName}>Kullanıcı</Text>
                <View style={ss.planRow}>
                  <View style={ss.planBadge}>
                    <Text style={ss.planText}>Ücretsiz Plan</Text>
                  </View>
                </View>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={C.zinc} />
          </TouchableOpacity>

          {/* ── Menu items ── */}
          <View style={ss.menuCard}>
            {MENU_ITEMS.map((item, idx) => {
              const isLast  = idx === MENU_ITEMS.length - 1;
              return (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={ss.menuRow}
                    activeOpacity={0.62}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (item.route) go(item.route);
                    }}
                  >
                    {/* Icon pill */}
                    <View style={[ss.menuIcon, item.accent && ss.menuIconGreen]}>
                      <Feather
                        name={item.icon as any}
                        size={15}
                        color={item.accent ? C.greenDark : C.charcoal}
                      />
                    </View>

                    <Text style={[ss.menuLabel, item.accent && ss.menuLabelGreen]}>
                      {item.label}
                    </Text>

                    {item.accent ? (
                      <View style={ss.premiumBadge}>
                        <Text style={ss.premiumBadgeText}>PRO</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={14} color={C.zinc} />
                    )}
                  </TouchableOpacity>

                  {!isLast && <View style={ss.divider} />}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Pinned chats ── */}
          <View style={ss.section}>
            <View style={ss.sectionHeader}>
              <Feather name="bookmark" size={11} color={C.zinc} />
              <Text style={ss.sectionTitle}>Sabitlendi</Text>
            </View>
            <View style={ss.chatCard}>
              {PINNED.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <TouchableOpacity style={ss.chatRow} activeOpacity={0.65}>
                    <View style={ss.chatIconWrap}>
                      <Feather name="message-square" size={13} color={C.muted} />
                    </View>
                    <Text style={ss.chatTitle} numberOfLines={1}>{p.title}</Text>
                    <TouchableOpacity hitSlop={12}>
                      <Feather name="more-horizontal" size={14} color={C.zinc} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {idx < PINNED.length - 1 && <View style={ss.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── Recent chats ── */}
          {recentConvs.length > 0 && (
            <View style={ss.section}>
              <View style={ss.sectionHeader}>
                <Feather name="clock" size={11} color={C.zinc} />
                <Text style={ss.sectionTitle}>Yakın Zamandakiler</Text>
              </View>
              <View style={ss.chatCard}>
                {recentConvs.map((conv, idx) => {
                  const active = currentConversation?.id === conv.id;
                  return (
                    <React.Fragment key={conv.id}>
                      <TouchableOpacity
                        style={[ss.chatRow, active && ss.chatRowActive]}
                        activeOpacity={0.65}
                        onPress={() => {
                          Haptics.selectionAsync();
                          loadConversation(conv.id);
                          onClose();
                          router.push("/chat");
                        }}
                      >
                        <View style={[ss.chatIconWrap, active && ss.chatIconActive]}>
                          <Feather
                            name="message-square"
                            size={13}
                            color={active ? C.greenDark : C.muted}
                          />
                        </View>
                        <View style={ss.chatMeta}>
                          <Text
                            style={[ss.chatTitle, active && ss.chatTitleActive]}
                            numberOfLines={1}
                          >
                            {conv.title}
                          </Text>
                          <Text style={ss.chatTime}>Az önce</Text>
                        </View>
                        <TouchableOpacity
                          hitSlop={12}
                          onPress={() => {
                            deleteConversation(conv.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <Feather name="more-horizontal" size={14} color={C.zinc} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {idx < recentConvs.length - 1 && <View style={ss.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}

        </ScrollView>

        {/* ════════════════════════════════
            BOTTOM BAR — dark mode toggle
        ════════════════════════════════ */}
        <View style={[ss.bottomBar, { paddingBottom: btmPad + 10 }]}>
          <TouchableOpacity
            style={ss.darkRow}
            onPress={() => {
              Haptics.selectionAsync();
              setDarkMode(d => !d);
            }}
            activeOpacity={0.75}
          >
            <View style={ss.darkIconWrap}>
              <Feather name={darkMode ? "moon" : "sun"} size={14} color={C.muted} />
            </View>
            <Text style={ss.darkLabel}>{darkMode ? "Koyu Tema" : "Açık Tema"}</Text>
            <Switch
              value={darkMode}
              onValueChange={v => {
                Haptics.selectionAsync();
                setDarkMode(v);
              }}
              trackColor={{ false: "#E5E5EA", true: C.green }}
              thumbColor="#FFFFFF"
              style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
            />
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════
            FLOATING NEW CHAT BUTTON
        ════════════════════════════════ */}
        <TouchableOpacity
          style={[ss.fab, { bottom: btmPad + 22 }]}
          onPress={handleNewChat}
          activeOpacity={0.82}
        >
          <Feather name="edit-3" size={16} color="#FFFFFF" />
          <Text style={ss.fabLabel}>Yeni Sohbet</Text>
        </TouchableOpacity>

      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({

  backdrop: {
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex: 200,
  },

  panel: {
    zIndex:          201,
    backgroundColor: C.bg,
    overflow:        "hidden",
  },

  // ── Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingBottom:     16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: C.card,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    6,
    elevation:       2,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  headerLogo: {
    width:  22,
    height: 22,
    tintColor: C.fg,
  },
  headerBrand: {
    fontSize:      11,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 3.2,
    color:         C.fg,
  },
  headerRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  avatarWrap: {
    width:        38,
    height:       38,
    borderRadius: 19,
  },
  avatarImg: {
    width:        38,
    height:       38,
    borderRadius: 19,
    borderWidth:  1.5,
    borderColor:  "rgba(255,255,255,0.9)",
  },
  headerOnlineDot: {
    position:        "absolute",
    bottom:          0,
    right:           0,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: C.green,
    borderWidth:     2,
    borderColor:     C.bg,
  },

  // ── Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 24 },

  // ── Profile card
  profileCard: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    backgroundColor:   C.card,
    borderRadius:      20,
    padding:           18,
    marginBottom:      14,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.07,
    shadowRadius:      16,
    elevation:         4,
  },
  profileLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           14,
  },
  profileAvatarWrap: {
    position: "relative",
  },
  profileAvatar: {
    width:        54,
    height:       54,
    borderRadius: 27,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.95)",
  },
  profileOnlineDot: {
    position:        "absolute",
    bottom:          1,
    right:           1,
    width:           13,
    height:          13,
    borderRadius:    7,
    backgroundColor: C.green,
    borderWidth:     2.5,
    borderColor:     C.card,
  },
  profileInfo: { gap: 5 },
  profileName: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
    color:         C.fg,
  },
  planRow: { flexDirection: "row" },
  planBadge: {
    paddingHorizontal: 9,
    paddingVertical:   3,
    borderRadius:      20,
    backgroundColor:   C.cardAlt,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       C.border,
  },
  planText: {
    fontSize:      11,
    fontFamily:    "Inter_500Medium",
    letterSpacing: 0.1,
    color:         C.muted,
  },

  // ── Menu card
  menuCard: {
    backgroundColor: C.card,
    borderRadius:    18,
    marginBottom:    14,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.06,
    shadowRadius:    14,
    elevation:       3,
  },
  menuRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   13,
    paddingHorizontal: 16,
    gap:               13,
  },
  menuIcon: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: C.cardAlt,
    alignItems:      "center",
    justifyContent:  "center",
  },
  menuIconGreen: {
    backgroundColor: C.greenLight,
  },
  menuLabel: {
    flex:          1,
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    color:         C.fg,
  },
  menuLabelGreen: {
    fontFamily: "Inter_500Medium",
    color:      C.greenDark,
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      8,
    backgroundColor:   C.greenLight,
  },
  premiumBadgeText: {
    fontSize:      10,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 0.8,
    color:         C.greenDark,
  },

  // ── Sections
  section: { marginBottom: 14 },
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            6,
    paddingLeft:    4,
    marginBottom:   8,
  },
  sectionTitle: {
    fontSize:      11,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 0.8,
    color:         C.zinc,
    textTransform: "uppercase",
  },

  // ── Chat cards
  chatCard: {
    backgroundColor: C.card,
    borderRadius:    16,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    10,
    elevation:       2,
  },
  chatRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   12,
    paddingHorizontal: 14,
    gap:               10,
  },
  chatRowActive: {
    backgroundColor: C.greenLight,
  },
  chatIconWrap: {
    width:           30,
    height:          30,
    borderRadius:    8,
    backgroundColor: C.cardAlt,
    alignItems:      "center",
    justifyContent:  "center",
  },
  chatIconActive: {
    backgroundColor: "rgba(107,203,142,0.18)",
  },
  chatMeta:       { flex: 1, gap: 2 },
  chatTitle: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.05,
    color:         C.charcoal,
  },
  chatTitleActive: {
    fontFamily: "Inter_500Medium",
    color:      C.greenDark,
  },
  chatTime: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
    color:         C.zinc,
  },

  // ── Divider
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 14,
  },

  // ── Bottom bar
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop:        14,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    C.border,
  },
  darkRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  darkIconWrap: {
    width:           32,
    height:          32,
    borderRadius:    9,
    backgroundColor: C.card,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       1,
  },
  darkLabel: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    color:         C.muted,
  },

  // ── FAB
  fab: {
    position:          "absolute",
    right:             20,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingVertical:   13,
    paddingHorizontal: 20,
    borderRadius:      28,
    backgroundColor:   C.black,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.22,
    shadowRadius:      20,
    elevation:         10,
  },
  fabLabel: {
    fontSize:      14,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.1,
    color:         "#FFFFFF",
  },

});
