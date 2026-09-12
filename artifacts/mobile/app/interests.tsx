/**
 * AkılCEP — Interests Screen
 *
 * Pure white, Apple HIG. Multi-select chip grid.
 * At least one selection required to continue; can skip.
 * Saves interests via AuthContext → /ready.
 */
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

// ── Interest catalogue ────────────────────────────────────────────────────────
const INTERESTS = [
  { id: "business",     key: "business" },
  { id: "finance",      key: "finance" },
  { id: "travel",       key: "travel" },
  { id: "health",       key: "health" },
  { id: "education",    key: "education" },
  { id: "ai",           key: "ai" },
  { id: "technology",   key: "technology" },
  { id: "productivity", key: "productivity" },
] as const;

type InterestId = (typeof INTERESTS)[number]["id"];

export default function InterestsScreen() {
  const insets              = useSafeAreaInsets();
  const { updateInterests } = useAuth();
  const { t }               = useLanguage();

  const [selected, setSelected] = useState<InterestId[]>([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = async (id: InterestId) => {
    if (Platform.OS !== "web") await Haptics.selectionAsync();
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const proceed = async (ids: InterestId[]) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLoading(true);
    try {
      await updateInterests(ids);
      router.replace("/ready");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        ss.root,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View style={ss.header}>
        <Text style={ss.title}>{t("interests.title")}</Text>
        <Text style={ss.subtitle}>{t("interests.subtitle")}</Text>
      </View>

      {/* Chip grid */}
      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.grid}
        showsVerticalScrollIndicator={false}
      >
        {INTERESTS.map(item => {
          const active = selected.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[ss.chip, active && ss.chipOn]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.72}
            >
              <Text style={[ss.chipText, active && ss.chipTextOn]}>
                {t(`interests.${item.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={ss.footer}>
        <TouchableOpacity
          style={[ss.btn, (loading || selected.length === 0) && ss.btnOff]}
          onPress={() => proceed(selected)}
          disabled={loading || selected.length === 0}
          activeOpacity={0.85}
        >
          <Text style={ss.btnText}>
            {loading ? t("interests.continuing") : t("common.continue")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => proceed([])}
          disabled={loading}
          style={ss.skipBtn}
        >
          <Text style={ss.skipText}>{t("interests.skip")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    paddingHorizontal: 28,
    marginBottom:      28,
    gap:               10,
  },
  title: {
    fontFamily:    "Inter_700Bold",
    fontSize:      32,
    letterSpacing: -1.2,
    color:         "#000000",
    lineHeight:    38,
  },
  subtitle: {
    fontFamily:    "Inter_400Regular",
    fontSize:      15,
    color:         "#000000",
    opacity:       0.38,
    lineHeight:    22,
    letterSpacing: -0.1,
  },

  scroll: { flex: 1, paddingHorizontal: 20 },
  grid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
    paddingBottom: 16,
  },

  chip: {
    paddingHorizontal: 20,
    paddingVertical:   13,
    borderRadius:      24,
    borderWidth:       1,
    borderColor:       "#E8E8E8",
    backgroundColor:   "#FAFAFA",
  },
  chipOn: {
    backgroundColor: "#000000",
    borderColor:     "#000000",
  },
  chipText: {
    fontFamily:    "Inter_500Medium",
    fontSize:      15,
    color:         "#000000",
    letterSpacing: -0.1,
  },
  chipTextOn: {
    color: "#FFFFFF",
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    gap:               4,
  },
  btn: {
    backgroundColor: "#000000",
    height:          56,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
  },
  btnOff: { opacity: 0.28 },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      16,
    color:         "#FFFFFF",
    letterSpacing: -0.2,
  },
  skipBtn: { alignItems: "center", paddingVertical: 12 },
  skipText: {
    fontFamily:    "Inter_400Regular",
    fontSize:      14,
    color:         "#000000",
    opacity:       0.32,
    letterSpacing: -0.1,
  },
});
