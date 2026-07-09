/**
 * LanguageContext — persists the user's language choice (tr | en).
 * Loads translations from JSON files with dot-path resolver.
 * t("section.key") or t("section.nested.key") both work.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import en from "@/locales/en.json";
import tr from "@/locales/tr.json";

// ─── Types ──────────────────────────────────────────────────────────────────────
export type Lang = "tr" | "en";

interface LanguageContextValue {
  lang:    Lang;
  setLang: (l: Lang) => Promise<void>;
  t:       (key: string) => string;
}

// ─── Flatten nested JSON into dot-path map ──────────────────────────────────────
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(acc, flatten(v as Record<string, unknown>, fullKey));
    } else {
      acc[fullKey] = String(v ?? "");
    }
    return acc;
  }, {});
}

const FLAT: Record<Lang, Record<string, string>> = {
  tr: flatten(tr as Record<string, unknown>),
  en: flatten(en as Record<string, unknown>),
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
    (key: string): string => FLAT[lang][key] ?? FLAT["tr"][key] ?? key,
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
