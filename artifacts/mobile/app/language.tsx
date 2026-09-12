/**
 * Language selection screen — compact Apple-style searchable language list.
 * Language names are searchable in Turkish, English, and each native language.
 */
import { Feather }    from "@expo/vector-icons";
import { router }     from "expo-router";
import React          from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/context/LanguageContext";
import colors                from "@/constants/colors";
import { LANGUAGE_REGISTRY, type Lang } from "@/constants/locales";

const C = colors.light;

function fold(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ─── Screen ─────────────────────────────────────────────────────────────────────
export default function LanguageScreen() {
  const { lang, setLang, t } = useLanguage();
  const [query, setQuery] = React.useState("");
  const insets          = useSafeAreaInsets();
  const topPad          = Platform.OS === "web" ? 20 : insets.top;
  const btmPad          = Platform.OS === "web" ? 34 : insets.bottom;

  const divider    = C.border;
  const cardBg     = C.primaryForeground;
  const cardBorder = C.border;
  const muted      = C.zinc400;
  const options = LANGUAGE_REGISTRY.filter((option) => {
    const needle = fold(query.trim());
    return !needle || [option.turkishName, option.englishName, option.nativeName].some((name) => fold(name).includes(needle));
  });

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

        <View style={[ss.search, { backgroundColor: C.zinc100, borderColor: cardBorder }]}>
          <Feather name="search" size={15} color={muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("language.search")}
            placeholderTextColor={muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[ss.searchInput, { color: C.foreground }]}
            accessibilityLabel={t("language.search")}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10} accessibilityLabel={t("common.close")}>
              <Feather name="x-circle" size={15} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Language list ──────────────────────────────────────────────────── */}
        <View style={[ss.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {options.map((opt, idx) => {
            const selected = lang === opt.code;
            const isLast   = idx === options.length - 1;
            return (
              <TouchableOpacity
                key={opt.code}
                style={[
                  ss.row,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                ]}
                onPress={() => handleSelect(opt.code)}
                activeOpacity={0.65}
              >
                {/* Names */}
                <View style={ss.nameBlock}>
                  <Text style={[ss.nativeName, { fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {opt.nativeName}
                  </Text>
                  <Text style={[ss.englishName, { color: muted }]}>
                    {opt.englishName} · {opt.turkishName}
                  </Text>
                </View>

                {/* Checkmark */}
                {selected && (
                  <Feather name="check" size={15} color={C.foreground} />
                )}
              </TouchableOpacity>
            );
          })}
          {options.length === 0 && (
            <Text style={[ss.empty, { color: muted }]}>{t("sidebar.noResults")}</Text>
          )}
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

  search: {
    marginHorizontal: 12,
    marginBottom: 10,
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  searchInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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

  empty: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    textAlign: "center",
    fontSize: 13,
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
