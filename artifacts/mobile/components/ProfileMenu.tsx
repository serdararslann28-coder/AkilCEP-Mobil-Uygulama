/**
 * ProfileMenu — Apple-style bottom sheet, fully theme-aware.
 * PURE: soft white glass. VOID: cinematic black glass.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/context/LanguageContext";
import { useTheme }    from "@/context/ThemeContext";

const SCREEN_H = Dimensions.get("window").height;
const avatar   = require("@/assets/images/avatar.png");

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const insets = useSafeAreaInsets();
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;
  const { theme } = useTheme();
  const T = theme;
  const { t } = useLanguage();

  const SECTIONS = [
    [
      { icon: "user",     label: t("profileMenu.profile"),  action: "profile" },
      { icon: "cpu",      label: t("profileMenu.memory"),   action: "" },
      { icon: "mic",      label: t("profileMenu.voiceMode"),action: "voice" },
    ],
    [
      { icon: "star",     label: t("profileMenu.premium"),  action: "" },
      { icon: "settings", label: t("profileMenu.settings"), action: "settings" },
      { icon: "shield",   label: t("settings.privacyItem"), action: "privacy" },
      { icon: "info",     label: t("sidebar.about"),        action: "about" },
    ],
  ];

  const translateY     = useSharedValue(SCREEN_H);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1,       { duration: 280 });
      translateY.value     = withSpring(0,        { damping: 26, stiffness: 200 });
    } else {
      overlayOpacity.value = withTiming(0,       { duration: 220 });
      translateY.value     = withSpring(SCREEN_H, { damping: 28, stiffness: 260 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity:       overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? "auto" : "none",
  } as any));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleItem = (action?: string) => {
    Haptics.selectionAsync();
    onClose();
    if (action === "voice")   setTimeout(() => router.push("/voice"),   300);
    if (action === "profile") setTimeout(() => router.push("/profile"), 300);
    if (action === "settings") setTimeout(() => router.push("/settings"), 300);
    if (action === "privacy")  setTimeout(() => router.push("/privacy"),  300);
    if (action === "about")    setTimeout(() => router.push("/about"),    300);
  };

  const sheetBg    = T.isDark ? "#0E0E0E" : "#F5F5F7";
  const sectionBg  = T.isDark ? "rgba(255,255,255,0.055)" : "#FFFFFF";
  const iconBg     = T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.045)";
  const handleClr  = T.isDark ? "rgba(255,255,255,0.12)"  : "rgba(0,0,0,0.12)";
  const pillBg     = T.isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.06)";
  const featurePill= T.isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.055)";

  const gradColors: [string, string, string] = T.isDark
    ? ["#161616", "#111111", "#0C0C0C"]
    : ["#FFFFFF", "#F0F0F2", "#E8E8EC"];

  return (
    <>
      <Animated.View style={[ss.overlay, { backgroundColor: T.isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.18)" }, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[ss.sheet, { backgroundColor: sheetBg, borderTopColor: T.border }, panelStyle]}>
        <View style={[ss.handle, { backgroundColor: handleClr }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ss.scroll, { paddingBottom: btmPad + 12 }]}
          bounces={false}
        >
          {/* Identity row */}
          <View style={ss.identityRow}>
            <View style={ss.avatarWrap}>
              <Image source={avatar} style={[ss.avatarImg, { borderColor: T.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.80)" }]} />
              <View style={[ss.onlineDot, { backgroundColor: T.onlineDot, borderColor: sheetBg }]} />
            </View>
            <View style={ss.identityText}>
              <Text style={[ss.userName, { color: T.fg }]}>{t("profileMenu.user")}</Text>
              <Text style={[ss.userSub,  { color: T.muted }]}>{t("profileMenu.freePlanSub")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
              <Feather name="x" size={18} color={T.zinc} />
            </TouchableOpacity>
          </View>

          {/* Premium card */}
          <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[ss.premiumCard, { borderColor: T.border }]}>
            <View style={[ss.premiumBadge, { backgroundColor: pillBg }]}>
              <Feather name="star" size={11} color={T.isDark ? T.green : T.fgSoft} />
              <Text style={[ss.premiumBadgeText, { color: T.isDark ? T.green : T.fgSoft }]}>PREMIUM</Text>
            </View>
            <Text style={[ss.premiumTitle, { color: T.fg }]}>{t("profileMenu.premiumTitle")}</Text>
            <Text style={[ss.premiumSub,   { color: T.muted }]}>{t("profileMenu.premiumSub")}</Text>
            <View style={ss.featurePills}>
              {[t("profileMenu.feat1"), t("profileMenu.feat2"), t("profileMenu.feat3"), t("profileMenu.feat4"), t("profileMenu.feat5")].map(f => (
                <View key={f} style={[ss.pill, { backgroundColor: featurePill }]}>
                  <Text style={[ss.pillText, { color: T.fgSoft }]}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[ss.premiumCTA, { backgroundColor: T.isDark ? T.green : T.fg }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClose(); }}
              activeOpacity={0.80}
            >
              <Text style={[ss.premiumCTAText, { color: T.isDark ? "#050505" : "#FFFFFF" }]}>{t("profileMenu.upgradePremium")}</Text>
              <Feather name="arrow-right" size={14} color={T.isDark ? "#050505" : "#FFFFFF"} />
            </TouchableOpacity>
          </LinearGradient>

          {/* Menu sections */}
          {SECTIONS.map((section, si) => (
            <View key={si} style={[ss.section, { backgroundColor: sectionBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0 }]}>
              {section.map((item, ii) => (
                <TouchableOpacity
                  key={item.label}
                  style={[ss.menuRow, ii < section.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }]}
                  onPress={() => handleItem(item.action)}
                  activeOpacity={0.6}
                >
                  <View style={[ss.menuIcon, { backgroundColor: iconBg }]}>
                    <Feather name={item.icon as any} size={16} color={T.fg} />
                  </View>
                  <Text style={[ss.menuLabel, { color: T.fg }]}>{item.label}</Text>
                  <Feather name="chevron-right" size={14} color={T.zinc} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Logout */}
          <View style={[ss.section, { backgroundColor: sectionBg, borderColor: T.border, borderWidth: T.isDark ? StyleSheet.hairlineWidth : 0, marginTop: 0 }]}>
            <TouchableOpacity
              style={ss.menuRow}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
              activeOpacity={0.6}
            >
              <View style={[ss.menuIcon, { backgroundColor: "rgba(255,59,48,0.10)" }]}>
                <Feather name="log-out" size={16} color="#FF3B30" />
              </View>
              <Text style={[ss.menuLabel, { color: "#FF3B30" }]}>{t("profileMenu.logout")}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000 },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    zIndex: 1001, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: "90%",
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },

  identityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  avatarWrap:  { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  avatarImg:   { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5 },
  onlineDot:   { position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  identityText:{ flex: 1 },
  userName:    { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.3 },
  userSub:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  premiumCard: { borderRadius: 22, padding: 22, gap: 10, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  premiumBadge:     { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, marginBottom: 2 },
  premiumBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1.6 },
  premiumTitle:     { fontSize: 20, fontFamily: "Inter_600SemiBold", letterSpacing: -0.5 },
  premiumSub:       { fontSize: 13, fontFamily: "Inter_400Regular" },
  featurePills:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill:             { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20 },
  pillText:         { fontSize: 11, fontFamily: "Inter_400Regular" },
  premiumCTA:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, paddingVertical: 14, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 5 },
  premiumCTAText:   { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },

  section:   { backgroundColor: "#FFFFFF", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  menuRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: -0.1 },
});
