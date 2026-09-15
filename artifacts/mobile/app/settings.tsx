/**
 * Settings — AkılCEP app settings.
 * Sections: Görünüm (theme), Dil, Bildirimler, Hesap, Gizlilik, Çıkış Yap.
 * Fully theme-aware: PURE / VOID.
 */
import { Feather }  from "@expo/vector-icons";
import { router }   from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChat }            from "@/context/ChatContext";
import { useLanguage }        from "@/context/LanguageContext";
import { ThemeMode, useTheme } from "@/context/ThemeContext";
import { LANGUAGE_REGISTRY }  from "@/constants/locales";

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
      style={[ss.row, !last && { borderBottomWidth: 0, borderBottomColor: "transparent" }]}
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
    <View style={[ss.row, !last && { borderBottomWidth: 0, borderBottomColor: "transparent" }]}>
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
  const { lang, t } = useLanguage();
  const { conversations, deleteAllConversations } = useChat();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const btmPad = Platform.OS === "web" ? 16 : insets.bottom;
  const isDark = T.isDark;
  const selectedLanguage = LANGUAGE_REGISTRY.find((option) => option.code === lang);

  const [notifications, setNotifications] = useState(true);
  const [deleteAllPromptOpen, setDeleteAllPromptOpen] = useState(false);

  const divider      = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)";
  const cardBorder   = isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)";
  const muted        = isDark ? "rgba(237,235,231,0.38)"  : "rgba(12,12,12,0.38)";
  const themeActiveBg = "#111111";

  return (
    <View style={[ss.root, { backgroundColor: isDark ? "#000000" : "#FFFFFF" }]}>

      {/* ── Floating back button (invisible header) ───────────────────────── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[ss.floatBack, { top: topPad + 10, backgroundColor: "transparent" }]}
        hitSlop={14}
        activeOpacity={0.60}
      >
        <Feather name="chevron-left" size={18} color={T.fg} />
      </TouchableOpacity>

      <View
        style={[
          ss.content,
          {
            paddingTop: topPad + 48,
            paddingBottom: btmPad + 8,
          },
        ]}
      >

        {/* ── Page title ───────────────────────────────────────────────────── */}
        <Text style={[ss.pageTitle, { color: T.fg }]}>{t("settings.title")}</Text>

        {/* ── Görünüm ──────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>{t("settings.appearance")}</Text>
        <View style={ss.card}>
          <View style={ss.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    ss.themeOption,
                    {
                      borderColor:     active ? themeActiveBg : "transparent",
                      backgroundColor: active ? themeActiveBg : "transparent",
                    },
                  ]}
                  onPress={() => {
                setThemeMode(opt.mode);
                showToast(opt.mode === "light" ? t("settings.themeToastLight") : t("settings.themeToastDark"));
              }}
                  activeOpacity={0.72}
                >
                  <Feather
                    name={opt.icon}
                    size={15}
                    color={active ? "#FFFFFF" : T.fg}
                    style={{ opacity: active ? 1 : 0.55 }}
                  />
                  <Text
                    style={[
                      ss.themeLabel,
                      {
                        color:      active ? "#FFFFFF" : T.fg,
                        opacity:    active ? 1 : 0.65,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {opt.mode === "light" ? t("settings.themeLight") : t("settings.themeDark")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Dil ──────────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>{t("settings.language")}</Text>
        <View style={ss.card}>
          <Row
            icon="globe"
            label={t("settings.appLanguage")}
            value={selectedLanguage?.nativeName ?? lang}
            onPress={() => router.push("/language")}
            divider={divider}
            fg={T.fg}
            muted={muted}
            last
          />
        </View>

        {/* ── Bildirimler ──────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>{t("settings.notifications")}</Text>
        <View style={ss.card}>
          <ToggleRow
            icon="bell"
            label={t("settings.notifications")}
            value={notifications}
            onToggle={setNotifications}
            divider={divider}
            fg={T.fg}
            trackOn={T.primary}
            last
          />
        </View>

        {/* ── Veri ve Gizlilik ─────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>
          {t("settings.dataPrivacy")}
        </Text>
        <View style={ss.card}>
          <TouchableOpacity
            style={ss.destructiveRow}
            onPress={() => setDeleteAllPromptOpen(true)}
            activeOpacity={0.65}
            disabled={conversations.length === 0}
          >
            <View style={ss.rowIcon}>
              <Feather
                name="trash-2"
                size={16}
                color="#C83E3E"
                style={{ opacity: conversations.length > 0 ? 0.9 : 0.38 }}
              />
            </View>
            <Text
              style={[
                ss.destructiveLabel,
                { opacity: conversations.length > 0 ? 1 : 0.38 },
              ]}
            >
              {t("settings.deleteAllConversations")}
            </Text>
            <Feather
              name="chevron-right"
              size={15}
              color="#C83E3E"
              style={{ opacity: conversations.length > 0 ? 0.55 : 0.24 }}
            />
          </TouchableOpacity>
        </View>

        {/* ── Hesap ────────────────────────────────────────────────────────── */}
        <Text style={[ss.sectionLabel, { color: muted }]}>{t("settings.account")}</Text>
        <View style={ss.card}>
          <Row
            icon="user"
            label={t("settings.profile")}
            onPress={() => router.push("/profile")}
            divider={divider}
            fg={T.fg}
            muted={muted}
          />
          <Row
            icon="shield"
            label={t("settings.privacyItem")}
            onPress={() => router.push("/privacy")}
            divider={divider}
            fg={T.fg}
            muted={muted}
          />
          <Row
            icon="help-circle"
            label={t("settings.support")}
            onPress={() => router.push("/support")}
            divider={divider}
            fg={T.fg}
            muted={muted}
            last
          />
        </View>

        <View style={ss.footer}>
          <Text style={[ss.footerBrand, { color: T.fg }]}>AkılCEP</Text>
          <Text style={[ss.footerVersion, { color: muted }]}>
            v1.0 • AI Assistant
          </Text>
        </View>
      </View>

      <Modal
        visible={deleteAllPromptOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteAllPromptOpen(false)}
      >
        <View style={ss.confirmOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDeleteAllPromptOpen(false)}
          />
          <View
            style={[
              ss.confirmCard,
              {
                backgroundColor: isDark ? "#171719" : "#FFFFFF",
                borderColor: cardBorder,
              },
            ]}
          >
            <Text style={[ss.confirmTitle, { color: T.fg }]}>
              {t("settings.deleteAllTitle")}
            </Text>
            <Text style={[ss.confirmMessage, { color: T.fgSoft }]}>
              {t("settings.deleteAllMessage")}
            </Text>
            <View style={ss.confirmActions}>
              <TouchableOpacity
                style={ss.confirmCancel}
                onPress={() => setDeleteAllPromptOpen(false)}
                activeOpacity={0.65}
              >
                <Text style={[ss.confirmCancelText, { color: T.fg }]}>
                  {t("settings.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={ss.confirmDelete}
                onPress={() => {
                  deleteAllConversations();
                  setDeleteAllPromptOpen(false);
                }}
                activeOpacity={0.78}
              >
                <Text style={ss.confirmDeleteText}>
                  {t("settings.deleteAllConfirm")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  // Floating back button (invisible header)
  floatBack: {
    position:       "absolute",
    left:           16,
    zIndex:         10,
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Page title (replaces header title in scroll content)
  pageTitle: {
    fontSize:          25,
    fontFamily:        "Inter_700Bold",
    letterSpacing:     -0.5,
    paddingHorizontal: 18,
    paddingBottom:     2,
  },

  // Section label
  sectionLabel: {
    fontSize:          9.5,
    fontFamily:        "Inter_500Medium",
    letterSpacing:     0.6,
    textTransform:     "uppercase",
    paddingHorizontal: 18,
    paddingTop:        7,
    paddingBottom:     3,
  },

  // Card container
  card: {
    marginHorizontal: 18,
  },

  destructiveRow: {
    height:            39,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
  },

  destructiveLabel: {
    flex:          1,
    color:         "#C83E3E",
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    letterSpacing: -0.1,
  },

  confirmOverlay: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 28,
    backgroundColor:   "rgba(0,0,0,0.34)",
  },

  confirmCard: {
    width:         "100%",
    maxWidth:      330,
    borderRadius:  20,
    borderWidth:   StyleSheet.hairlineWidth,
    padding:       20,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius:  28,
    elevation:     12,
  },

  confirmTitle: {
    fontSize:      17,
    fontFamily:    "Inter_600SemiBold",
    letterSpacing: -0.25,
  },

  confirmMessage: {
    marginTop:  8,
    fontSize:   13.5,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },

  confirmActions: {
    marginTop:      20,
    flexDirection:  "row",
    justifyContent: "flex-end",
    gap:            10,
  },

  confirmCancel: {
    minWidth:          82,
    height:            42,
    borderRadius:      12,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 14,
  },

  confirmCancelText: {
    fontSize:   13.5,
    fontFamily: "Inter_500Medium",
  },

  confirmDelete: {
    minWidth:          96,
    height:            42,
    borderRadius:      12,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 14,
    backgroundColor:   "#C83E3E",
  },

  confirmDeleteText: {
    color:      "#FFFFFF",
    fontSize:   13.5,
    fontFamily: "Inter_600SemiBold",
  },

  // Theme selector
  themeRow: {
    flexDirection:     "row",
    gap:               6,
    paddingVertical:   3,
  },

  themeOption: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            5,
    height:          33,
    borderRadius:    8,
    borderWidth:     StyleSheet.hairlineWidth,
  },

  themeLabel: {
    fontSize:      13,
    letterSpacing: -0.1,
  },

  // Row
  row: {
    height:             39,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 12,
    gap:               8,
  },

  rowIcon: {
    width:          22,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  rowLabel: {
    flex:          1,
    fontSize:      13.5,
    fontFamily:    "Inter_400Regular",
    letterSpacing: -0.1,
  },

  rowRight: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },

  rowValue: {
    fontSize:   12.5,
    fontFamily: "Inter_400Regular",
  },

  footer: {
    flex:           1,
    minHeight:      38,
    alignItems:     "center",
    justifyContent: "flex-end",
    paddingTop:     6,
  },

  footerBrand: {
    fontSize:   12,
    fontFamily: "Inter_600SemiBold",
  },

  footerVersion: {
    marginTop:  1,
    fontSize:   9.5,
    fontFamily: "Inter_400Regular",
  },
});
