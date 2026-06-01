/**
 * Settings — AkılCEP app settings.
 * Sections: Görünüm (theme), Dil, Bildirimler, Hesap, Gizlilik, Çıkış Yap.
 * Fully theme-aware: PURE / VOID.
 */
import { Feather }  from "@expo/vector-icons";
import { router }   from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeMode, useTheme } from "@/context/ThemeContext";

// ─── Theme options ─────────────────────────────────────────────────────────────
const THEME_OPTIONS: {
  mode:  ThemeMode;
  label: string;
  icon:  React.ComponentProps<typeof Feather>["name"];
}[] = [
  { mode: "light", label: "Açık",  icon: "sun"  },
  { mode: "dark",  label: "Koyu",  icon: "moon" },
];

// ─── Reusable row components ───────────────────────────────────────────────────
function Row({
  icon, label, value, onPress, divider, fg, muted, last,
}: {
  icon:     React.ComponentProps<typeof Feather>["name"];
  label:    string;
  value?:   string;
  onPress?: () => void;
  divider:  string;
  fg:       string;
  muted:    string;
  last?:    boolean;
}) {
  return (
    <TouchableOpacity
      style={[ss.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={ss.rowIcon}>
        <Feather name={icon} size={16} color={fg} style={{ opacity: 0.55 }} />
      </View>
      <Text style={[ss.rowLabel, { color: fg }]}>{label}</Text>
      <View style={ss.rowRight}>
        {value ? <Text style={[ss.rowValue, { color: muted }]}>{value}</Text> : null}
        {onPress ? <Feather name="chevron-right" size={15} color={muted} style={{ opacity: 0.55 }} /> : null}
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon, label, value, onToggle, divider, fg, trackOn, last,
}: {
  icon:      React.ComponentProps<typeof Feather>["name"];
  label:     string;
  value:     boolean;
  onToggle:  (v: boolean) => void;
  divider:   string;
  fg:        string;
  trackOn:   string;
  last?:     boolean;
}) {
  return (
    <View style={[ss.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}>
      <View style={ss.rowIcon}>
        <Feather name={icon} size={16} color={fg} style={{ opacity: 0.55 }} />
      </View>
      <Text style={[ss.rowLabel, { color: fg }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: trackOn, false: "rgba(120,120,128,0.28)" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="rgba(120,120,128,0.28)"
      />
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { theme: T, themeMode, setThemeMode, showToast } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isDark = T.isDark;

  const [notifications, setNotifications] = useState(true);

  const divider      = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)";
  const cardBg       = isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.030)";
  const cardBorder   = isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)";
  const muted        = isDark ? "rgba(237,235,231,0.38)"  : "rgba(12,12,12,0.38)";
  const themeActiveBg = T.primary;

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[ss.header, { paddingTop: topPad + 10, borderBottomColor: divider }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} hitSlop={14}>
          <Feather name="chevron-left" size={24} color={T.fg} />
        </TouchableOpacity>
        <Text style={[ss.headerTitle, { color: T.fg }]}>Ayarlar</Text>
        <View style={ss.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: btmPad + 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Görünüm ──────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>Görünüm</Text>
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={ss.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    ss.themeOption,
                    {
                      borderColor:     active ? themeActiveBg : cardBorder,
                      backgroundColor: active ? themeActiveBg : "transparent",
                    },
                  ]}
                  onPress={() => {
                setThemeMode(opt.mode);
                showToast(opt.mode === "light" ? "☀️  Açık Tema Aktif" : "🌙  Koyu Tema Aktif");
              }}
                  activeOpacity={0.72}
                >
                  <Feather
                    name={opt.icon}
                    size={15}
                    color={active ? T.primaryForeground : T.fg}
                    style={{ opacity: active ? 1 : 0.55 }}
                  />
                  <Text
                    style={[
                      ss.themeLabel,
                      {
                        color:      active ? T.primaryForeground : T.fg,
                        opacity:    active ? 1 : 0.65,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Dil ──────────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>Dil</Text>
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Row
            icon="globe"
            label="Uygulama Dili"
            value="Türkçe"
            divider={divider}
            fg={T.fg}
            muted={muted}
            last
          />
        </View>

        {/* ── Bildirimler ──────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>Bildirimler</Text>
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ToggleRow
            icon="bell"
            label="Bildirimler"
            value={notifications}
            onToggle={setNotifications}
            divider={divider}
            fg={T.fg}
            trackOn={T.primary}
            last
          />
        </View>

        {/* ── Hesap ────────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>Hesap</Text>
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Row
            icon="user"
            label="Profil"
            onPress={() => router.push("/profile")}
            divider={divider}
            fg={T.fg}
            muted={muted}
          />
          <Row
            icon="shield"
            label="Gizlilik"
            onPress={() => {}}
            divider={divider}
            fg={T.fg}
            muted={muted}
          />
          <Row
            icon="help-circle"
            label="Destek"
            onPress={() => {}}
            divider={divider}
            fg={T.fg}
            muted={muted}
            last
          />
        </View>

        {/* ── Çıkış Yap ────────────────────────────────────────────────────── */}
        <View style={ss.logoutWrap}>
          <TouchableOpacity
            style={[ss.logoutBtn, { borderColor: cardBorder }]}
            onPress={() =>
              Alert.alert(
                "Çıkış Yap",
                "Hesabınızdan çıkmak istediğinizden emin misiniz?",
                [
                  { text: "İptal",     style: "cancel"      },
                  { text: "Çıkış Yap", style: "destructive" },
                ]
              )
            }
            activeOpacity={0.72}
          >
            <Feather name="log-out" size={16} color="#FF3B30" />
            <Text style={ss.logoutLabel}>Çıkış Yap</Text>
          </TouchableOpacity>
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

  // Card container
  card: {
    marginHorizontal: 16,
    borderRadius:     16,
    borderWidth:      StyleSheet.hairlineWidth,
    overflow:         "hidden",
  },

  // Theme selector
  themeRow: {
    flexDirection:     "row",
    gap:               8,
    padding:           12,
  },

  themeOption: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 11,
    borderRadius:    12,
    borderWidth:     StyleSheet.hairlineWidth,
  },

  themeLabel: {
    fontSize:      13,
    letterSpacing: -0.1,
  },

  // Row
  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },

  rowIcon: {
    width:          26,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  rowLabel: {
    flex:          1,
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },

  rowRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },

  rowValue: {
    fontSize:   14,
    fontFamily: "Inter_400Regular",
  },

  // Logout
  logoutWrap: {
    paddingHorizontal: 16,
    paddingTop:        28,
  },

  logoutBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    paddingVertical: 15,
    borderRadius:    16,
    borderWidth:     StyleSheet.hairlineWidth,
  },

  logoutLabel: {
    fontSize:   15,
    fontFamily: "Inter_500Medium",
    color:      "#FF3B30",
  },
});
