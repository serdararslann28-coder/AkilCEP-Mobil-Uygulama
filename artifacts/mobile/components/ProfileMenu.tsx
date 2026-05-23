/**
 * ProfileMenu — floating Apple-style profile & monetisation panel.
 * Slides up from bottom as a glass bottom-sheet.
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

const SCREEN_H = Dimensions.get("window").height;
const avatar   = require("@/assets/images/avatar.png");

// ─── Palette (mirrors home screen) ────────────────────────────────────────────
const C = {
  bg:         "#EBEBEC",
  panel:      "#F5F5F7",
  fg:         "#1C1C1E",
  muted:      "#8E8E93",
  zinc400:    "#AEAEB2",
  border:     "rgba(0,0,0,0.06)",
  itemHover:  "rgba(0,0,0,0.04)",
  green:      "#34C759",
};

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Menu sections ────────────────────────────────────────────────────────────
const SECTIONS = [
  [
    { icon: "user",     label: "Profil" },
    { icon: "cpu",      label: "Hafıza" },
    { icon: "mic",      label: "Voice Mode",   action: "voice" },
  ],
  [
    { icon: "sun",      label: "Görünüm" },
    { icon: "globe",    label: "Dil" },
    { icon: "bell",     label: "Bildirimler" },
    { icon: "lock",     label: "Gizlilik" },
    { icon: "settings", label: "Ayarlar" },
  ],
];

export default function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const insets = useSafeAreaInsets();
  const btmPad = Platform.OS === "web" ? 32 : insets.bottom;

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
    if (action === "voice") {
      setTimeout(() => router.push("/voice"), 300);
    }
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Sheet panel ── */}
      <Animated.View style={[styles.sheet, panelStyle]}>

        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: btmPad + 12 }]}
          bounces={false}
        >

          {/* ── User identity row ── */}
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              <Image source={avatar} style={styles.avatarImg} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.identityText}>
              <Text style={styles.userName}>Kullanıcı</Text>
              <Text style={styles.userSub}>Ücretsiz Plan · AkılCEP</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              activeOpacity={0.6}
            >
              <Feather name="x" size={18} color={C.zinc400} />
            </TouchableOpacity>
          </View>

          {/* ── Premium card ── */}
          <LinearGradient
            colors={["#FFFFFF", "#F0F0F2", "#E8E8EC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}
          >
            {/* Star badge */}
            <View style={styles.premiumBadge}>
              <Feather name="star" size={11} color={C.fg} />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>

            <Text style={styles.premiumTitle}>AKILCEP Premium</Text>
            <Text style={styles.premiumSub}>Daha güçlü yapay zeka deneyimi</Text>

            {/* Feature pills */}
            <View style={styles.featurePills}>
              {[
                "Sınırsız Voice Mode",
                "Gelişmiş AI Modeller",
                "Akıllı Hafıza",
                "PDF Analizi",
                "Hızlı Yanıtlar",
              ].map((f) => (
                <View key={f} style={styles.pill}>
                  <Text style={styles.pillText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={styles.premiumCTA}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onClose();
              }}
              activeOpacity={0.80}
            >
              <Text style={styles.premiumCTAText}>Premium'a Geç</Text>
              <Feather name="arrow-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          {/* ── Menu sections ── */}
          {SECTIONS.map((section, si) => (
            <View key={si} style={styles.section}>
              {section.map((item, ii) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuRow,
                    ii < section.length - 1 && styles.menuRowBorder,
                  ]}
                  onPress={() => handleItem(item.action)}
                  activeOpacity={0.6}
                >
                  <View style={styles.menuIcon}>
                    <Feather
                      name={item.icon as any}
                      size={16}
                      color={C.fg}
                    />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Feather name="chevron-right" size={14} color={C.zinc400} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* ── Logout ── */}
          <View style={[styles.section, { marginTop: 0 }]}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              activeOpacity={0.6}
            >
              <View style={styles.menuIcon}>
                <Feather name="log-out" size={16} color="#FF3B30" />
              </View>
              <Text style={[styles.menuLabel, { color: "#FF3B30" }]}>
                Çıkış Yap
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex: 200,
  },

  sheet: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    zIndex:          201,
    backgroundColor: C.panel,
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    maxHeight:       "90%",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: -6 },
    shadowOpacity:   0.08,
    shadowRadius:    32,
    elevation:       24,
  },

  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf:       "center",
    marginTop:       12,
    marginBottom:    4,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
    gap:               14,
  },

  /* ── Identity row ── */
  identityRow: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical: 12,
    gap:             14,
  },
  avatarWrap: {
    width:        52,
    height:       52,
    borderRadius: 26,
    flexShrink:   0,
  },
  avatarImg: {
    width:        52,
    height:       52,
    borderRadius: 26,
    borderWidth:  1.5,
    borderColor:  "rgba(255,255,255,0.80)",
  },
  onlineDot: {
    position:        "absolute",
    bottom:          1,
    right:           1,
    width:           13,
    height:          13,
    borderRadius:    7,
    backgroundColor: C.green,
    borderWidth:     2.5,
    borderColor:     C.panel,
  },
  identityText: { flex: 1 },
  userName: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         C.fg,
    letterSpacing: -0.3,
  },
  userSub: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      C.muted,
    marginTop:  2,
  },

  /* ── Premium card ── */
  premiumCard: {
    borderRadius:   22,
    padding:        22,
    gap:            10,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.08,
    shadowRadius:   16,
    elevation:      6,
    borderWidth:    StyleSheet.hairlineWidth,
    borderColor:    "rgba(0,0,0,0.06)",
  },
  premiumBadge: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            5,
    alignSelf:      "flex-start",
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingVertical:   4,
    paddingHorizontal: 10,
    borderRadius:   20,
    marginBottom:   2,
  },
  premiumBadgeText: {
    fontSize:      9,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: 1.6,
    color:         C.fg,
  },
  premiumTitle: {
    fontSize:      20,
    fontFamily:    "Inter_600SemiBold",
    color:         C.fg,
    letterSpacing: -0.5,
  },
  premiumSub: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
    color:      C.muted,
  },
  featurePills: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    gap:            6,
    marginTop:      4,
  },
  pill: {
    backgroundColor:   "rgba(0,0,0,0.055)",
    paddingVertical:   5,
    paddingHorizontal: 11,
    borderRadius:      20,
  },
  pillText: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
    color:      C.fg,
  },
  premiumCTA: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    marginTop:         6,
    backgroundColor:   C.fg,
    paddingVertical:   14,
    borderRadius:      16,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 3 },
    shadowOpacity:     0.16,
    shadowRadius:      10,
    elevation:         5,
  },
  premiumCTAText: {
    fontSize:      15,
    fontFamily:    "Inter_600SemiBold",
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },

  /* ── Menu sections ── */
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius:    18,
    overflow:        "hidden",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.04,
    shadowRadius:    8,
    elevation:       2,
  },
  menuRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    paddingHorizontal: 16,
    gap:               14,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  menuIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: "rgba(0,0,0,0.045)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  menuLabel: {
    flex:          1,
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         C.fg,
    letterSpacing: -0.1,
  },

});
