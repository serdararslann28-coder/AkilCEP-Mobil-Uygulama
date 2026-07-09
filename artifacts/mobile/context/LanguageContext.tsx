/**
 * LanguageContext — persists the user's language choice (tr | en).
 *
 * Default language: Turkish ("tr").
 * - First launch (no AsyncStorage entry): always Turkish.
 * - Stored value of "en": switch to English.
 * - Any other stored value, null, or AsyncStorage error: stay Turkish.
 * - Missing key in current language: fall back to Turkish translation.
 * - Missing key in Turkish too: return key name as last resort.
 *
 * t("section.key") and t("section.nested.key") both work.
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

// ─── Flatten nested JSON into a dot-path lookup map ─────────────────────────────
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

// ─── Safe translation using Turkish flat map (used before Provider mounts) ──────
const trLookup = (key: string): string => FLAT["tr"][key] ?? key;

// ─── Context default — Turkish, never returns raw key names ─────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  lang:    "tr",
  setLang: async () => {},
  t:       trLookup,
});

// ─── Provider ───────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start with Turkish — AsyncStorage read happens asynchronously after.
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        // Only accept exactly "tr" or "en"; everything else (null, corrupt) → Turkish.
        if (stored === "en") {
          setLangState("en");
        } else {
          setLangState("tr");
        }
      })
      .catch(() => {
        // AsyncStorage failure → keep Turkish.
        setLangState("tr");
      });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    // Resolution order: selected language → Turkish fallback → key name.
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
