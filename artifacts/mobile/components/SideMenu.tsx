/**
 * SideMenu — Premium AkılCEP side drawer.
 *
 * Layout (sticky → scrollable → sticky):
 *   [HEADER]   logo + brand + theme/search icons
 *   [SEARCH]   collapsible instant-filter row
 *   [PROFILE]  card — avatar, name, online status
 *   [HISTORY]  date-grouped conversation list
 *   [FAB]      "Yeni Sohbet" pill button
 *
 * Visual: Glassmorphism panel (BlurView) over a blurred backdrop.
 * Gesture: Swipe-left closes the drawer.
 */
import { BlurView }  from "expo-blur";
import { Feather }   from "@expo/vector-icons";
import * as Haptics  from "expo-haptics";
import { router }    from "expo-router";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat }     from "@/context/ChatContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme }    from "@/context/ThemeContext";

// ─── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const MENU_W = Math.min(Math.round(SCREEN_W * 0.82), 340);

const leafLogo      = require("@/assets/images/leaf-only-transparent.png");
const defaultAvatar = require("@/assets/images/avatar.png");

// ─── Date grouping helpers (createdAt is a number/ms timestamp) ────────────────
function getDateGroup(ts: number, t: (k: string) => string): string {
  const now  = new Date();
  const date = new Date(ts);
  const isSameDay =
    now.getDate()     === date.getDate()     &&
    now.getMonth()    === date.getMonth()    &&
    now.getFullYear() === date.getFullYear();
  if (isSameDay) return t("sidebar.today");
  const diffDays = (now.getTime() - date.getTime()) / 86_400_000;
  if (diffDays < 2)  return t("sidebar.yesterday");
  if (diffDays < 7)  return t("sidebar.thisWeek");
  if (diffDays < 30) return t("sidebar.thisMonth");
  return t("sidebar.earlier");
}

// ─── Main component ─────────────────────────────────────────────────────────────
interface Props { visible: boolean; onClose: () => void; }

export default function SideMenu({ visible, onClose }: Props) {
  const { theme: T, toggle } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isDark = T.isDark;

  const GROUP_ORDER = [t("sidebar.today"), t("sidebar.yesterday"), t("sidebar.thisWeek"), t("sidebar.thisMonth"), t("sidebar.earlier")];

  const { conversations, currentConversation, loadConversation, startNewConversation } = useChat();

  // UI state
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Slide-in animation ────────────────────────────────────────────────────────
  const translateX = useSharedValue(-MENU_W);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 26, stiffness: 200, mass: 0.9 });
      backdropOp.value = withTiming(1, { duration: 280 });
    } else {
      setSearchOpen(false);
      setSearchQuery("");
      translateX.value = withTiming(-MENU_W, { duration: 260, easing: Easing.in(Easing.ease) });
      backdropOp.value = withTiming(0, { duration: 230 });
    }
  }, [visible]);

  const panelAnim    = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  // ── Swipe-left-to-close gesture ───────────────────────────────────────────────
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.8,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) translateX.value = dx;
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -(MENU_W * 0.28) || vx < -0.55) {
          onCloseRef.current();
        } else {
          translateX.value = withSpring(0, { damping: 26, stiffness: 220 });
        }
      },
    })
  ).current;

  // ── Filtered & grouped conversations ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof conversations> = {};
    for (const conv of filtered) {
      const g = getDateGroup(conv.createdAt, t);
      if (!map[g]) map[g] = [];
      map[g].push(conv);
    }
    return GROUP_ORDER
      .filter(g => map[g]?.length)
      .map(g => ({ label: g, items: map[g] }));
  }, [filtered]);

  // ── Navigate helpers ──────────────────────────────────────────────────────────
  function go(path: string) {
    onClose();
    setTimeout(() => router.push(path as any), 180);
  }

  function handleNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startNewConversation();
    onClose();
    setTimeout(() => router.push("/chat"), 180);
  }

  // ── Derived color tokens ──────────────────────────────────────────────────────
  const panelOverlay  = isDark ? "rgba(8,8,10,0.82)"       : "rgba(253,253,251,0.88)";
  const divider       = isDark ? "rgba(255,255,255,0.07)"   : "rgba(0,0,0,0.06)";
  const muted         = isDark ? "rgba(237,235,231,0.38)"   : "rgba(12,12,12,0.38)";
  const rowActiveBg   = isDark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.055)";
  const profileBg     = isDark ? "rgba(255,255,255,0.05)"   : "rgba(0,0,0,0.032)";
  const profileBorder = isDark ? "rgba(255,255,255,0.09)"   : "rgba(0,0,0,0.07)";
  const inputBg       = isDark ? "rgba(255,255,255,0.07)"   : "rgba(0,0,0,0.05)";
  const iconIdleBg    = isDark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.055)";
  const themeIconName: React.ComponentProps<typeof Feather>["name"] = isDark ? "moon" : "sun";

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[ss.backdrop, backdropAnim]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Panel ─────────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[ss.panel, { width: MENU_W }, panelAnim]}
        pointerEvents={visible ? "box-none" : "none"}
        {...panResponder.panHandlers}
      >
        {/* Glassmorphism fill */}
        <BlurView
          intensity={isDark ? 60 : 85}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: panelOverlay }]} />

        {/* Right-edge separator */}
        <View style={[ss.edgeLine, { backgroundColor: divider }]} />

        {/* ═══ STICKY TOP — header + search bar ═══════════════════════════════ */}
        <View style={[ss.stickyTop, { borderBottomColor: divider }]}>

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <View style={[ss.header, { paddingTop: topPad + 18 }]}>
            {/* Brand */}
            <View style={ss.brandBlock}>
              <View style={ss.brandRow}>
                <Image
                  source={leafLogo}
                  style={[ss.brandLogo, { tintColor: T.logoTint }]}
                  resizeMode="contain"
                />
                <Text style={[ss.brandName, { color: T.fg }]}>AkılCEP</Text>
              </View>
            </View>

            {/* Action icons */}
            <View style={ss.headerIcons}>
              {/* Theme toggle — single tap Light ↔ Dark */}
              <TouchableOpacity
                style={[ss.iconBtn, { backgroundColor: iconIdleBg }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggle();
                }}
                hitSlop={10}
                activeOpacity={0.65}
              >
                <Feather name={themeIconName} size={15} color={T.fg} style={{ opacity: 0.70 }} />
              </TouchableOpacity>

              {/* Search toggle */}
              <TouchableOpacity
                style={[ss.iconBtn, { backgroundColor: searchOpen ? "rgba(0,0,0,0.09)" : iconIdleBg }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchOpen(v => !v);
                  if (searchOpen) setSearchQuery("");
                }}
                hitSlop={10}
                activeOpacity={0.65}
              >
                <Feather name={searchOpen ? "x" : "search"} size={15} color={T.fg} style={{ opacity: 0.70 }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Search bar (collapsible) ─────────────────────────────────────── */}
          {searchOpen && (
            <View style={[ss.searchBar, { borderTopColor: divider }]}>
              <Feather name="search" size={14} color={muted} />
              <TextInput
                style={[ss.searchInput, { color: T.fg, backgroundColor: inputBg }]}
                placeholder={t("sidebar.searchPlaceholder")}
                placeholderTextColor={muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={10}>
                  <Feather name="x-circle" size={15} color={muted} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ═══ PROFILE CARD ════════════════════════════════════════════════════ */}
        <TouchableOpacity
          style={[ss.profileCard, { backgroundColor: profileBg, borderColor: profileBorder }]}
          onPress={() => go("/profile")}
          activeOpacity={0.72}
        >
          <Image source={defaultAvatar} style={ss.profileAvatar} resizeMode="cover" />
          <View style={ss.profileInfo}>
            <Text style={[ss.profileName, { color: T.fg }]}>SERDAR</Text>
          </View>
          <Feather name="chevron-right" size={16} color={muted} style={{ opacity: 0.60 }} />
        </TouchableOpacity>

        {/* Divider after profile */}
        <View style={[ss.fullDivider, { backgroundColor: divider }]} />

        {/* ═══ CHAT HISTORY — scrollable ═══════════════════════════════════════ */}
        <ScrollView
          style={ss.scroll}
          contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 110 }]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {grouped.length === 0 ? (
            <Text style={[ss.emptyText, { color: muted }]}>
              {searchQuery.trim() ? t("sidebar.noResults") : t("sidebar.emptyHistory")}
            </Text>
          ) : (
            grouped.map(({ label, items }) => (
              <View key={label} style={ss.group}>
                {/* Date group label */}
                <Text style={[ss.groupLabel, { color: muted }]}>{label}</Text>

                {/* Conversation rows */}
                {items.map(conv => {
                  const isActive = conv.id === currentConversation?.id;
                  return (
                    <TouchableOpacity
                      key={conv.id}
                      style={[
                        ss.convRow,
                        isActive && { backgroundColor: rowActiveBg },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        loadConversation(conv.id);
                        onClose();
                        setTimeout(() => router.push("/chat"), 160);
                      }}
                      activeOpacity={0.68}
                    >
                      {/* Active bar */}
                      {isActive && (
                        <View style={[ss.activeBar, { backgroundColor: T.fg }]} />
                      )}
                      <Feather
                        name="message-square"
                        size={12}
                        color={T.fg}
                        style={{ opacity: isActive ? 0.65 : 0.35, flexShrink: 0 }}
                      />
                      <Text
                        style={[ss.convTitle, { color: T.fg, opacity: isActive ? 1 : 0.72 }]}
                        numberOfLines={1}
                      >
                        {conv.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        {/* ═══ BOTTOM AREA — sticky ═════════════════════════════════════════════ */}
        <View
          style={[ss.bottomArea, { paddingBottom: btmPad + 18, borderTopColor: divider }]}
        >
          {/* ── Bottom nav items ────────────────────────────────────────────── */}
          <TouchableOpacity
            style={ss.bottomNavRow}
            onPress={() => go("/settings")}
            activeOpacity={0.68}
          >
            <Feather name="settings" size={16} color={T.fg} style={{ opacity: 0.55 }} />
            <Text style={[ss.bottomNavLabel, { color: T.fg }]}>{t("sidebar.settings")}</Text>
            <Feather name="chevron-right" size={14} color={T.fg} style={{ opacity: 0.28 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={ss.bottomNavRow}
            onPress={() => go("/about")}
            activeOpacity={0.68}
          >
            <Feather name="info" size={16} color={T.fg} style={{ opacity: 0.55 }} />
            <Text style={[ss.bottomNavLabel, { color: T.fg }]}>{t("sidebar.about")}</Text>
            <Feather name="chevron-right" size={14} color={T.fg} style={{ opacity: 0.28 }} />
          </TouchableOpacity>

          {/* Thin divider */}
          <View style={[ss.bottomDivider, { backgroundColor: divider }]} />

          {/* ── New Chat FAB ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[ss.fab, { backgroundColor: T.primary }]}
            onPress={handleNewChat}
            activeOpacity={0.82}
          >
            <Feather name="plus" size={16} color={T.primaryForeground} />
            <Text style={[ss.fabLabel, { color: T.primaryForeground }]}>{t("sidebar.newChat")}</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 400,
  },

  // Panel
  panel: {
    position:  "absolute",
    top:       0,
    bottom:    0,
    left:      0,
    zIndex:    401,
    overflow:  "hidden",
  },

  // Right-edge separator line
  edgeLine: {
    position: "absolute",
    top:      0,
    bottom:   0,
    right:    0,
    width:    StyleSheet.hairlineWidth,
    zIndex:   1,
  },

  // ── Header area ─────────────────────────────────────────────────────────────
  stickyTop: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex:            2,
  },

  header: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingBottom:     16,
  },

  brandBlock: {
    flex: 1,
    gap:  3,
  },

  brandRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           14,
  },

  brandLogo: {
    width:  38,
    height: 38,
  },

  brandName: {
    fontSize:      18,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 1.8,
  },

  brandSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
    marginLeft:    30,
  },

  headerIcons: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    paddingTop:    2,
  },

  iconBtn: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Search bar ───────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderTopWidth:    StyleSheet.hairlineWidth,
    gap:               8,
  },

  searchInput: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    paddingHorizontal: 10,
    paddingVertical:   7,
    borderRadius:  10,
  },

  // ── Profile card ─────────────────────────────────────────────────────────────
  profileCard: {
    flexDirection:     "row",
    alignItems:        "center",
    marginHorizontal:  14,
    marginTop:         14,
    marginBottom:      4,
    paddingHorizontal: 14,
    paddingVertical:   13,
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    gap:               12,
    zIndex:            2,
  },

  profileAvatar: {
    width:        44,
    height:       44,
    borderRadius: 22,
    flexShrink:   0,
  },

  profileInfo: {
    flex:            1,
    justifyContent:  "center",
  },

  profileName: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.2,
  },

  statusRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },

  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },

  statusLabel: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
  },

  // Full-width hairline
  fullDivider: {
    height:          StyleSheet.hairlineWidth,
    marginTop:       12,
    marginBottom:    2,
  },

  // ── Scroll area ──────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    zIndex: 2,
  },

  scrollContent: {
    paddingTop: 6,
  },

  // Group
  group: {
    marginBottom: 4,
  },

  groupLabel: {
    fontSize:          11,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.6,
    textTransform:     "uppercase",
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     4,
  },

  // Conversation row
  convRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               10,
    borderRadius:      10,
    marginHorizontal:  8,
    position:          "relative",
  },

  activeBar: {
    position:     "absolute",
    left:         10,
    top:          "50%",
    marginTop:    -8,
    width:        3,
    height:       16,
    borderRadius: 2,
  },

  convTitle: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },

  // Empty state
  emptyText: {
    fontSize:          14,
    fontFamily:        "Inter_400Regular",
    letterSpacing:     -0.1,
    paddingHorizontal: 20,
    paddingTop:        24,
    fontStyle:         "italic",
  },

  // ── Bottom area (nav items + FAB) ────────────────────────────────────────────
  bottomArea: {
    paddingHorizontal: 16,
    paddingTop:        8,
    borderTopWidth:    StyleSheet.hairlineWidth,
    zIndex:            2,
  },

  bottomNavRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 4,
    paddingVertical:   12,
    gap:               12,
  },

  bottomNavLabel: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    opacity:       0.72,
  },

  bottomDivider: {
    height:        StyleSheet.hairlineWidth,
    marginVertical: 8,
  },

  fab: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    999,
    paddingVertical: 16,
    gap:             8,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.16,
    shadowRadius:    18,
    elevation:       8,
  },

  fabLabel: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
  },

});
