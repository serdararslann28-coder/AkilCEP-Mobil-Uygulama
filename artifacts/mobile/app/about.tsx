/**
 * About — AkılCEP about screen.
 * Shows brand identity, feature list, version and copyright.
 * Fully theme-aware: PURE / VOID.
 */
import { Feather }  from "@expo/vector-icons";
import { router }   from "expo-router";
import React        from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";

const leafLogo = require("@/assets/images/leaf-only-transparent.png");

// ─── Feature list ──────────────────────────────────────────────────────────────
const FEATURES: {
  icon:  React.ComponentProps<typeof Feather>["name"];
  label: string;
  desc:  string;
}[] = [
  { icon: "message-circle", label: "Yapay Zeka Sohbet",  desc: "Türkçe ile sınırsız sohbet"       },
  { icon: "camera",         label: "AkılCEP Vision",     desc: "Fotoğraf ve görsel analizi"        },
  { icon: "mic",            label: "Sesli Sohbet",       desc: "Doğal ses asistanı"               },
  { icon: "image",          label: "Görsel Üretme",      desc: "Yapay zeka ile görsel oluşturma"  },
  { icon: "globe",          label: "Web Arama",          desc: "Güncel bilgiye erişim"            },
];

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isDark = T.isDark;

  const divider    = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)";
  const cardBg     = isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.030)";
  const cardBorder = isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)";
  const muted      = isDark ? "rgba(237,235,231,0.38)"  : "rgba(12,12,12,0.38)";
  const iconBg     = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.05)";

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[ss.header, { paddingTop: topPad + 10, borderBottomColor: divider }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} hitSlop={14}>
          <Feather name="chevron-left" size={24} color={T.fg} />
        </TouchableOpacity>
        <Text style={[ss.headerTitle, { color: T.fg }]}>Hakkımızda</Text>
        <View style={ss.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: btmPad + 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero / Brand ─────────────────────────────────────────────────── */}
        <View style={ss.hero}>
          <View style={[ss.logoWrap, { backgroundColor: T.bgAlt }]}>
            <Image
              source={leafLogo}
              style={[ss.logo, { tintColor: T.logoTint }]}
              resizeMode="contain"
            />
          </View>
          <Text style={[ss.heroTitle, { color: T.fg }]}>AkılCEP</Text>
          <Text style={[ss.heroSub, { color: muted }]}>Cebindeki Akıl</Text>
          <Text style={[ss.heroDesc, { color: T.fgSoft }]}>
            Türkçe konuşan yapay zeka asistanı.
          </Text>
        </View>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>Özellikler</Text>
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {FEATURES.map((f, idx) => (
            <View
              key={f.icon}
              style={[
                ss.featureRow,
                idx < FEATURES.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: divider,
                },
              ]}
            >
              <View style={[ss.featureIcon, { backgroundColor: iconBg }]}>
                <Feather name={f.icon} size={15} color={T.fg} style={{ opacity: 0.65 }} />
              </View>
              <View style={ss.featureText}>
                <Text style={[ss.featureLabel, { color: T.fg }]}>{f.label}</Text>
                <Text style={[ss.featureDesc, { color: muted }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Version + Copyright ──────────────────────────────────────────── */}
        <View style={ss.footer}>
          <Text style={[ss.version, { color: muted }]}>v1.0</Text>
          <View style={[ss.footerDivider, { backgroundColor: divider }]} />
          <Text style={[ss.copyright, { color: muted }]}>© AkılCEP</Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 8,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backBtn: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.3,
  },

  headerSpacer: {
    width: 44,
  },

  // Section label
  sectionLabel: {
    fontSize:          11,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.6,
    textTransform:     "uppercase",
    paddingHorizontal: 20,
    paddingTop:        28,
    paddingBottom:     8,
  },

  // Card
  card: {
    marginHorizontal: 16,
    borderRadius:     16,
    borderWidth:      StyleSheet.hairlineWidth,
    overflow:         "hidden",
  },

  // Hero section
  hero: {
    alignItems: "center",
    paddingTop: 44,
    paddingBottom: 8,
    gap: 8,
  },

  logoWrap: {
    width:          80,
    height:         80,
    borderRadius:   24,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   8,
  },

  logo: {
    width:  48,
    height: 48,
  },

  heroTitle: {
    fontSize:      28,
    fontFamily:    "Inter_700Bold",
    letterSpacing: 2.4,
  },

  heroSub: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    letterSpacing: 0.1,
  },

  heroDesc: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
    textAlign:     "center",
    paddingHorizontal: 40,
    marginTop:     4,
    lineHeight:    22,
  },

  // Feature row
  featureRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               14,
  },

  featureIcon: {
    width:          38,
    height:         38,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  featureText: {
    flex: 1,
    gap:  3,
  },

  featureLabel: {
    fontSize:      15,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.2,
  },

  featureDesc: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },

  // Footer
  footer: {
    alignItems:   "center",
    paddingTop:   40,
    paddingBottom: 16,
    gap:           10,
  },

  version: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
  },

  footerDivider: {
    width:  32,
    height: StyleSheet.hairlineWidth,
  },

  copyright: {
    fontSize:      13,
    fontFamily:    "Inter_500Medium",
    letterSpacing: 0.2,
  },
});
