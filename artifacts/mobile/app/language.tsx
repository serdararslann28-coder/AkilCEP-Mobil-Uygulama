/**
 * Language selection screen — Apple-style list with flag, name, and checkmark.
 * Fully theme-aware (PURE / VOID). Saves choice immediately via LanguageContext.
 */
import { Feather }    from "@expo/vector-icons";
import { router }     from "expo-router";
import React          from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Lang, useLanguage } from "@/context/LanguageContext";
import { useTheme }          from "@/context/ThemeContext";

// ─── Language options ───────────────────────────────────────────────────────────
const OPTIONS: { lang: Lang; flag: string; nativeName: string; englishName: string }[] = [
  { lang: "tr", flag: "🇹🇷", nativeName: "Türkçe",   englishName: "Turkish"  },
  { lang: "en", flag: "🇬🇧", nativeName: "English",  englishName: "İngilizce" },
];

// ─── Screen ─────────────────────────────────────────────────────────────────────
export default function LanguageScreen() {
  const { theme: T }    = useTheme();
  const { lang, setLang, t } = useLanguage();
  const insets          = useSafeAreaInsets();
  const topPad          = Platform.OS === "web" ? 20 : insets.top;
  const btmPad          = Platform.OS === "web" ? 34 : insets.bottom;
  const isDark          = T.isDark;

  const divider    = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)";
  const cardBg     = isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.030)";
  const cardBorder = isDark ? "rgba(255,255,255,0.09)"  : "rgba(0,0,0,0.07)";
  const muted      = isDark ? "rgba(237,235,231,0.38)"  : "rgba(12,12,12,0.38)";

  async function handleSelect(selected: Lang) {
    await setLang(selected);
  }

  return (
    <View style={[ss.root, { backgroundColor: T.bg }]}>

      {/* ── Floating back button ────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[ss.floatBack, { top: topPad + 10, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}
        hitSlop={14}
        activeOpacity={0.60}
      >
        <Feather name="chevron-left" size={18} color={T.fg} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: btmPad + 48, paddingTop: topPad + 52 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page title ─────────────────────────────────────────────────────── */}
        <Text style={[ss.pageTitle, { color: T.fg }]}>{t("language.title")}</Text>
        <Text style={[ss.pageSubtitle, { color: muted }]}>{t("language.subtitle")}</Text>

        {/* ── Language list ──────────────────────────────────────────────────── */}
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {OPTIONS.map((opt, idx) => {
            const selected = lang === opt.lang;
            const isLast   = idx === OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={opt.lang}
                style={[
                  ss.row,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                ]}
                onPress={() => handleSelect(opt.lang)}
                activeOpacity={0.65}
              >
                {/* Flag */}
                <Text style={ss.flag}>{opt.flag}</Text>

                {/* Names */}
                <View style={ss.nameBlock}>
                  <Text style={[ss.nativeName, { color: T.fg, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {opt.nativeName}
                  </Text>
                  <Text style={[ss.englishName, { color: muted }]}>
                    {opt.englishName}
                  </Text>
                </View>

                {/* Checkmark */}
                {selected && (
                  <Feather name="check" size={17} color={T.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Info note ──────────────────────────────────────────────────────── */}
        <Text style={[ss.note, { color: muted }]}>
          {lang === "tr"
            ? "Dil değişikliği tüm ekranlara anında uygulanır."
            : "Language change applies instantly across all screens."}
        </Text>

      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
  },

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

  pageTitle: {
    fontSize:          28,
    fontFamily:        "Inter_700Bold",
    letterSpacing:     -0.6,
    paddingHorizontal: 20,
    paddingBottom:     4,
  },

  pageSubtitle: {
    fontSize:          14,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 20,
    paddingBottom:     24,
    letterSpacing:     -0.1,
  },

  card: {
    marginHorizontal: 16,
    borderRadius:     16,
    borderWidth:      StyleSheet.hairlineWidth,
    overflow:         "hidden",
  },

  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   16,
    gap:               14,
  },

  flag: {
    fontSize: 28,
    lineHeight: 34,
  },

  nameBlock: {
    flex: 1,
    gap:  2,
  },

  nativeName: {
    fontSize:      16,
    letterSpacing: -0.2,
  },

  englishName: {
    fontSize:   13,
    fontFamily: "Inter_400Regular",
  },

  note: {
    fontSize:          12,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 20,
    paddingTop:        14,
    letterSpacing:     0.1,
    lineHeight:        18,
  },
});
