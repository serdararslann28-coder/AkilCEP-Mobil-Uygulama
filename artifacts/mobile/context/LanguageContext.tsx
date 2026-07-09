/**
 * LanguageContext — persists the user's language choice (tr | en).
 * Provides useLanguage() hook and a t() translation helper for the whole app.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────────
export type Lang = "tr" | "en";

interface LanguageContextValue {
  lang:    Lang;
  setLang: (l: Lang) => Promise<void>;
  t:       (key: string) => string;
}

// ─── Translations ───────────────────────────────────────────────────────────────
const STRINGS: Record<Lang, Record<string, string>> = {
  tr: {
    // Settings
    "settings.title":          "Ayarlar",
    "settings.appearance":     "Görünüm",
    "settings.language":       "Dil",
    "settings.appLanguage":    "Uygulama Dili",
    "settings.notifications":  "Bildirimler",
    "settings.account":        "Hesap",
    "settings.profile":        "Profil",
    "settings.privacy":        "Gizlilik",
    "settings.support":        "Destek",
    "settings.logout":         "Çıkış Yap",
    "settings.logoutConfirm":  "Hesabınızdan çıkmak istediğinizden emin misiniz?",
    "settings.cancel":         "İptal",
    "settings.themeLight":     "Açık",
    "settings.themeDark":      "Koyu",
    // Language screen
    "language.title":          "Uygulama Dili",
    "language.subtitle":       "Tercih ettiğiniz dili seçin",
    "language.tr":             "Türkçe",
    "language.en":             "İngilizce",
  },
  en: {
    // Settings
    "settings.title":          "Settings",
    "settings.appearance":     "Appearance",
    "settings.language":       "Language",
    "settings.appLanguage":    "App Language",
    "settings.notifications":  "Notifications",
    "settings.account":        "Account",
    "settings.profile":        "Profile",
    "settings.privacy":        "Privacy",
    "settings.support":        "Support",
    "settings.logout":         "Sign Out",
    "settings.logoutConfirm":  "Are you sure you want to sign out?",
    "settings.cancel":         "Cancel",
    "settings.themeLight":     "Light",
    "settings.themeDark":      "Dark",
    // Language screen
    "language.title":          "App Language",
    "language.subtitle":       "Choose your preferred language",
    "language.tr":             "Turkish",
    "language.en":             "English",
  },
};

// ─── Storage key ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "@akilcep_language";

// ─── Context ────────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  lang:    "tr",
  setLang: async () => {},
  t:       (k) => k,
});

// ─── Provider ───────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  // Load persisted choice on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "tr" || stored === "en") setLangState(stored);
    });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => STRINGS[lang][key] ?? STRINGS["tr"][key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useLanguage() {
  return useContext(LanguageContext);
}
