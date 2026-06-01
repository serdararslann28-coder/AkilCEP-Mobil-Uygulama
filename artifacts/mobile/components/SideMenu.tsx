/**
 * SideMenu — ChatGPT-inspired sliding side drawer.
 * Slides in from the left at ~82 % of screen width.
 * Sections: Quick Access, Sabitlenenler, Yakın Zamandakiler (grouped by date).
 * Bottom: large FAB "Yeni Sohbet".
 * Fully reactive to PURE (white) / VOID (dark) theme.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Conversation, useChat } from "@/context/ChatContext";
import { useTheme }              from "@/context/ThemeContext";

const { width: SCREEN_W } = Dimensions.get("window");
const MENU_W = Math.min(Math.round(SCREEN_W * 0.82), 360);

const leafLogo = require("@/assets/images/leaf-only-transparent.png");
const avatar   = require("@/assets/images/avatar.png");

// ─── Quick access tiles ────────────────────────────────────────────────────────
const QUICK_ACCESS = [
  { label: "Görseller",    icon: "image",  route: "/chat",   desc: "Görsel üret"      },
  { label: "Vision",       icon: "camera", route: "/vision", desc: "Fotoğraf analiz"  },
  { label: "Sesli Sohbet", icon: "mic",    route: "/voice",  desc: "Sesli asistan"    },
  { label: "Daha Fazla",   icon: "grid",   route: null,      desc: "Tüm araçlar"      },
] as const;

// ─── Static pinned items (no pin data model yet) ───────────────────────────────
const STATIC_PINNED = [
  { id: "p1", title: "AKILCEP UI Tasarımı"     },
  { id: "p2", title: "Ses Asistanı Deneyimi"   },
];

// ─── Date grouping helpers ─────────────────────────────────────────────────────
function getGroup(ts: number): string {
  const diff = Date.now() - ts;
  const d    = 86_400_000;
  if (diff < d)       return "Bugün";
  if (diff < 2 * d)   return "Dün";
  if (diff < 7 * d)   return "Bu Hafta";
  if (diff < 30 * d)  return "Bu Ay";
  return "Daha Önce";
}

const GROUP_ORDER = ["Bugün", "Dün", "Bu Hafta", "Bu Ay", "Daha Önce"] as const;

function groupByDate(convs: Conversation[]) {
  const map: Record<string, Conversation[]> = {};
  for (const c of convs) {
    const g = getGroup(c.createdAt);
    (map[g] ??= []).push(c);
  }
  return GROUP_ORDER.flatMap((lbl) =>
    map[lbl]?.length ? [{ label: lbl, items: map[lbl]! }] : [],
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[ss.sectionLbl, { color }]}>{label.toUpperCase()}</Text>;
}

function DateLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[ss.dateLbl, { color }]}>{label}</Text>;
}

interface ConvRowProps {
  title:          string;
  active:         boolean;
  icon:           React.ComponentProps<typeof Feather>["name"];
  fg:             string;
  activeBg:       string;
  iconBg:         string;
  moreBg:         string;
  moreClr:        string;
  dividerColor:   string;
  onPress:        () => void;
}

function ConvRow({
  title, active, icon, fg, activeBg, iconBg, moreBg, moreClr, onPress,
}: ConvRowProps) {
  return (
    <TouchableOpacity
      style={[ss.convRow, active && { backgroundColor: activeBg }]}
      activeOpacity={0.65}
      onPress={onPress}
    >
      <View style={[ss.convIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={12} color={fg} style={{ opacity: 0.60 }} />
      </View>
      <Text style={[ss.convTitle, { color: fg }]} numberOfLines={1}>{title}</Text>
      <TouchableOpacity
        hitSlop={14}
        style={[ss.moreBtn, { backgroundColor: moreBg }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Feather name="more-horizontal" size={13} color={moreClr} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props { visible: boolean; onClose: () => void; }

export default function SideMenu({ visible, onClose }: Props) {
  const { theme: T }  = useTheme();
  const insets        = useSafeAreaInsets();
  const topPad        = Platform.OS === "web" ? 20 : insets.top;
  const btmPad        = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    conversations,
    currentConversation,
    loadConversation,
    startNewConversation,
  } = useChat();

  // ── Animations ───────────────────────────────────────────────────────────────
  const translateX = useSharedValue(-MENU_W);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.85 });
      backdropOp.value = withTiming(1, { duration: 300 });
    } else {
      translateX.value = withTiming(-MENU_W, { duration: 240, easing: Easing.in(Easing.ease) });
      backdropOp.value = withTiming(0, { duration: 220 });
    }
  }, [visible]);

  const panelStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const go = (route: string | null) => {
    if (!route) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
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

  const handleLoadConv = (id: string) => {
    Haptics.selectionAsync();
    loadConversation(id);
    onClose();
    router.push("/chat");
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const groups = useMemo(() => groupByDate(conversations), [conversations]);

  // ── Color tokens ─────────────────────────────────────────────────────────────
  const panelBg       = T.isDark ? "#0D0D0D"                        : "#FFFFFF";
  const sectionClr    = T.isDark ? "rgba(255,255,255,0.30)"         : "rgba(0,0,0,0.32)";
  const divider       = T.isDark ? "rgba(255,255,255,0.07)"         : "rgba(0,0,0,0.07)";
  const quickCardBg   = T.isDark ? "rgba(255,255,255,0.055)"        : "rgba(0,0,0,0.038)";
  const quickIconBg   = T.isDark ? "rgba(255,255,255,0.08)"         : "rgba(0,0,0,0.06)";
  const activeConvBg  = T.isDark ? "rgba(255,255,255,0.085)"        : "rgba(0,0,0,0.055)";
  const convIconBg    = T.isDark ? "rgba(255,255,255,0.07)"         : "rgba(0,0,0,0.05)";
  const moreBg        = T.isDark ? "rgba(255,255,255,0.06)"         : "rgba(0,0,0,0.04)";
  const moreClr       = T.isDark ? "rgba(255,255,255,0.22)"         : "rgba(0,0,0,0.20)";
  const avatarBorder  = T.isDark ? "rgba(255,255,255,0.14)"         : "rgba(0,0,0,0.10)";
  const hBtnBg        = T.isDark ? "rgba(255,255,255,0.07)"         : "rgba(0,0,0,0.05)";
  const fabBg         = T.isDark ? "#FFFFFF"                        : "#0A0A0A";
  const fabClr        = T.isDark ? "#000000"                        : "#FFFFFF";

  // ── Quick tile width — two tiles per row with gap ────────────────────────────
  const tileW = Math.floor((MENU_W - 40 - 8) / 2);

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[ss.backdrop, backdropStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Panel ─────────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[ss.panel, { backgroundColor: panelBg, width: MENU_W }, panelStyle]}
        pointerEvents={visible ? "box-none" : "none"}
      >

        {/* ════ HEADER ════ */}
        <View style={[ss.header, { paddingTop: topPad + 18, borderBottomColor: divider }]}>
          {/* Left — branding */}
          <View style={ss.headerLeft}>
            <View style={ss.brandRow}>
              <Image
                source={leafLogo}
                style={[ss.brandLogo, { tintColor: T.logoTint }]}
                resizeMode="contain"
              />
              <Text style={[ss.appTitle, { color: T.fg }]}>AKILCEP</Text>
            </View>
            <Text style={[ss.appSub, { color: sectionClr }]}>Cebindeki Akıl</Text>
          </View>

          {/* Right — search + avatar */}
          <View style={ss.headerRight}>
            <TouchableOpacity
              style={[ss.hIconBtn, { backgroundColor: hBtnBg }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.65}
              hitSlop={10}
            >
              <Feather name="search" size={15} color={T.fg} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => go("/profile")}
              activeOpacity={0.75}
              hitSlop={10}
            >
              <Image
                source={avatar}
                style={[ss.headerAvatar, { borderColor: avatarBorder }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ════ SCROLL BODY ════ */}
        <ScrollView
          style={ss.scroll}
          contentContainerStyle={[ss.scrollContent, { paddingBottom: btmPad + 100 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── Quick Access ────────────────────────────────────────────────── */}
          <SectionLabel label="Hızlı Erişim" color={sectionClr} />
          <View style={ss.quickGrid}>
            {QUICK_ACCESS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[ss.quickCard, { backgroundColor: quickCardBg, width: tileW }]}
                onPress={() => go(item.route ?? null)}
                activeOpacity={0.68}
              >
                <View style={[ss.quickIconWrap, { backgroundColor: quickIconBg }]}>
                  <Feather name={item.icon as any} size={17} color={T.fg} />
                </View>
                <Text style={[ss.quickLabel, { color: T.fg }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[ss.quickDesc, { color: sectionClr }]} numberOfLines={1}>
                  {item.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Sabitlenenler ───────────────────────────────────────────────── */}
          <SectionLabel label="Sabitlenenler" color={sectionClr} />
          {STATIC_PINNED.map((item) => (
            <ConvRow
              key={item.id}
              title={item.title}
              active={false}
              icon="bookmark"
              fg={T.fg}
              activeBg={activeConvBg}
              iconBg={convIconBg}
              moreBg={moreBg}
              moreClr={moreClr}
              dividerColor={divider}
              onPress={() => Haptics.selectionAsync()}
            />
          ))}

          {/* ── Yakın Zamandakiler ──────────────────────────────────────────── */}
          <SectionLabel label="Yakın Zamandakiler" color={sectionClr} />

          {groups.length > 0
            ? groups.map(({ label, items }) => (
                <React.Fragment key={label}>
                  <DateLabel label={label} color={sectionClr} />
                  {items.map((c) => (
                    <ConvRow
                      key={c.id}
                      title={c.title}
                      active={currentConversation?.id === c.id}
                      icon="message-circle"
                      fg={T.fg}
                      activeBg={activeConvBg}
                      iconBg={convIconBg}
                      moreBg={moreBg}
                      moreClr={moreClr}
                      dividerColor={divider}
                      onPress={() => handleLoadConv(c.id)}
                    />
                  ))}
                </React.Fragment>
              ))
            : (
              <View style={ss.emptyWrap}>
                <Text style={[ss.emptyText, { color: sectionClr }]}>
                  Henüz sohbet yok
                </Text>
              </View>
            )
          }
        </ScrollView>

        {/* ════ BOTTOM FAB ════ */}
        <View style={[ss.fabWrap, { paddingBottom: btmPad + 12, borderTopColor: divider }]}>
          <TouchableOpacity
            style={[ss.fab, { backgroundColor: fabBg }]}
            onPress={handleNewChat}
            activeOpacity={0.80}
          >
            <Feather name="plus" size={15} color={fabClr} />
            <Text style={[ss.fabLabel, { color: fabClr }]}>Yeni Sohbet</Text>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.46)",
    zIndex:          400,
  },

  // Panel
  panel: {
    position:      "absolute",
    top:           0,
    left:          0,
    bottom:        0,
    zIndex:        401,
    shadowColor:   "#000",
    shadowOffset:  { width: 10, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius:  28,
    elevation:     24,
  },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: 20,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  brandRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           7,
  },
  brandLogo: {
    width:  20,
    height: 20,
  },
  appTitle: {
    fontSize:      22,
    fontFamily:    "Inter_700Bold",
    letterSpacing: -0.7,
    lineHeight:    26,
  },
  appSub: {
    fontSize:      12,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
    marginTop:     3,
    marginLeft:    27,
  },
  headerRight: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    paddingTop:     2,
  },
  hIconBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerAvatar: {
    width:        34,
    height:       34,
    borderRadius: 17,
    borderWidth:  1.5,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 4 },

  // Section label — uppercase small caps
  sectionLbl: {
    fontSize:          10.5,
    fontFamily:        "Inter_600SemiBold",
    letterSpacing:     1.0,
    paddingHorizontal: 20,
    paddingTop:        22,
    paddingBottom:     8,
  },

  // Date group label
  dateLbl: {
    fontSize:          11.5,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.1,
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     2,
  },

  // Quick access 2x2 grid
  quickGrid: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: 16,
    gap:               8,
  },
  quickCard: {
    borderRadius: 16,
    padding:      14,
    gap:          7,
  },
  quickIconWrap: {
    width:          38,
    height:         38,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize:      13.5,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.2,
    marginTop:     1,
  },
  quickDesc: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.05,
  },

  // Conversation row
  convRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 12,
    paddingVertical:   9,
    marginHorizontal:  8,
    borderRadius:      12,
    gap:               10,
  },
  convIcon: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  convTitle: {
    flex:          1,
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },
  moreBtn: {
    width:          26,
    height:         26,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  // Empty state
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  emptyText: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    fontStyle:     "italic",
  },

  // Bottom FAB
  fabWrap: {
    paddingHorizontal: 16,
    paddingTop:        12,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  fab: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    borderRadius:   28,
    paddingVertical: 15,
    gap:            8,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.18,
    shadowRadius:   14,
    elevation:      7,
  },
  fabLabel: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
});
