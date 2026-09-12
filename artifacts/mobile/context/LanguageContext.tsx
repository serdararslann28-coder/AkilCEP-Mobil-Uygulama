/**
 * LanguageContext — persists the user's language choice.
 *
 * Default language: Turkish ("tr").
 * - First launch (no AsyncStorage entry): always Turkish.
 * - Any registered locale can be selected and is persisted.
 * - Missing key falls back to English, then Turkish, then the key itself.
 *
 * t("section.key") and t("section.nested.key") both work.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import en from "@/locales/en.json";
import tr from "@/locales/tr.json";
import { CORE_LOCALES, LANGUAGE_REGISTRY, type Lang, type LocaleTree } from "@/constants/locales";

export type { Lang };

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

const FLAT: Record<Lang, Record<string, string>> = Object.fromEntries([
  ["tr", flatten(tr as Record<string, unknown>)],
  ["en", flatten(en as Record<string, unknown>)],
  ...LANGUAGE_REGISTRY
    .filter(({ code }) => code !== "tr" && code !== "en")
    .map(({ code }) => [code, flatten((CORE_LOCALES[code] ?? {}) as LocaleTree)]),
]) as Record<Lang, Record<string, string>>;

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
  const hasUserSelection = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        // Ignore corrupt/old values. Turkish remains the safe first-launch default.
        if (!hasUserSelection.current && stored && LANGUAGE_REGISTRY.some(({ code }) => code === stored)) {
          setLangState(stored as Lang);
        }
      })
      .catch(() => {
        // AsyncStorage failure → keep Turkish.
        setLangState("tr");
      });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    hasUserSelection.current = true;
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    // Resolution order: selected language → English → Turkish → key name.
    (key: string): string => FLAT[lang][key] ?? FLAT["en"][key] ?? FLAT["tr"][key] ?? key,
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
