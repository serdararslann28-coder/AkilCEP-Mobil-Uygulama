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
import colors                from "@/constants/colors";

const C = colors.light;

// ─── Language options ───────────────────────────────────────────────────────────
const OPTIONS: { lang: Lang; flag: string; nativeName: string; englishName: string }[] = [
  { lang: "tr", flag: "🇹🇷", nativeName: "Türkçe",   englishName: "Turkish"  },
  { lang: "en", flag: "🇬🇧", nativeName: "English",  englishName: "İngilizce" },
];

// ─── Screen ─────────────────────────────────────────────────────────────────────
export default function LanguageScreen() {
  const { lang, setLang, t } = useLanguage();
  const insets          = useSafeAreaInsets();
  const topPad          = Platform.OS === "web" ? 20 : insets.top;
  const btmPad          = Platform.OS === "web" ? 34 : insets.bottom;

  const divider    = C.border;
  const cardBg     = C.primaryForeground;
  const cardBorder = C.border;
  const muted      = C.zinc400;

  async function handleSelect(selected: Lang) {
    await setLang(selected);
  }

  return (
    <View style={ss.root}>

      {/* ── Floating back button ────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[ss.floatBack, { top: topPad + 8 }]}
        hitSlop={12}
        activeOpacity={0.60}
      >
        <Feather name="chevron-left" size={16} color={C.foreground} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: btmPad + 32, paddingTop: topPad + 46 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page title ─────────────────────────────────────────────────────── */}
        <Text style={ss.pageTitle}>{t("language.title")}</Text>
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
                  <Text style={[ss.nativeName, { fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {opt.nativeName}
                  </Text>
                  <Text style={[ss.englishName, { color: muted }]}>
                    {opt.englishName}
                  </Text>
                </View>

                {/* Checkmark */}
                {selected && (
                  <Feather name="check" size={15} color={C.foreground} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Info note ──────────────────────────────────────────────────────── */}
        <Text style={[ss.note, { color: muted }]}>
          {t("language.note")}
        </Text>

      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.primaryForeground,
  },

  floatBack: {
    position:       "absolute",
    left:           14,
    zIndex:         10,
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: C.zinc100,
    borderWidth:    StyleSheet.hairlineWidth,
    borderColor:    C.border,
  },

  pageTitle: {
    color:             C.foreground,
    fontSize:          24,
    fontFamily:        "Inter_700Bold",
    letterSpacing:     -0.6,
    paddingHorizontal: 16,
    paddingBottom:     3,
  },

  pageSubtitle: {
    fontSize:          12.5,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 16,
    paddingBottom:     18,
    letterSpacing:     -0.1,
  },

  card: {
    marginHorizontal: 12,
    borderRadius:     14,
    borderWidth:      StyleSheet.hairlineWidth,
    overflow:         "hidden",
  },

  row: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               11,
  },

  flag: {
    fontSize:   22,
    lineHeight: 28,
  },

  nameBlock: {
    flex: 1,
    gap:  2,
  },

  nativeName: {
    color:         C.foreground,
    fontSize:      15,
    letterSpacing: -0.2,
  },

  englishName: {
    fontSize:   11.5,
    fontFamily: "Inter_400Regular",
  },

  note: {
    fontSize:          10.5,
    fontFamily:        "Inter_400Regular",
    paddingHorizontal: 16,
    paddingTop:        11,
    letterSpacing:     0.1,
    lineHeight:        15,
  },
});
