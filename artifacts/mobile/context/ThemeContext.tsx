/**
 * Theme system — PURE (light) / VOID (dark).
 * Apple × Nothing × ChatGPT aesthetic.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Animated, {
  Easing,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native";

// ─── Token shape ──────────────────────────────────────────────────────────────
export interface ThemeTokens {
  name:    "PURE" | "VOID";
  isDark:  boolean;

  // Surfaces
  bg:      string;
  bgAlt:   string;
  card:    string;
  cardAlt: string;

  // Borders
  border:  string;

  // Text
  fg:      string;
  fgSoft:  string;
  muted:   string;
  zinc:    string;

  // Accent — green
  green:        string;
  greenEmphasis:string;
  greenTint:    string;
  onlineDot:    string;

  // Assets
  logoTint:     string;

  // useColors compatibility keys (used by chat.tsx)
  background:        string;
  foreground:        string;
  mutedForeground:   string;
  zinc500:           string;
  primary:           string;
  primaryForeground: string;
  accent:            string;
}

// ─── PURE — soft warm white, luxury minimalism ────────────────────────────────
export const PURE: ThemeTokens = {
  name:    "PURE",
  isDark:  false,

  bg:      "#F6F6F3",
  bgAlt:   "#EFEFEA",
  card:    "#FFFFFF",
  cardAlt: "#F8F8F6",
  border:  "rgba(0,0,0,0.055)",

  fg:      "#111111",
  fgSoft:  "#3A3A3C",
  muted:   "#8E8E93",
  zinc:    "#AEAEB2",

  green:         "#6BCB8E",
  greenEmphasis: "#4BAE72",
  greenTint:     "rgba(107,203,142,0.13)",
  onlineDot:     "#6BCB8E",

  logoTint: "#111111",

  background:        "#F6F6F3",
  foreground:        "#111111",
  mutedForeground:   "#8E8E93",
  zinc500:           "#AEAEB2",
  primary:           "#111111",
  primaryForeground: "#FFFFFF",
  accent:            "#E5E5EA",
};

// ─── VOID — cinematic black, futuristic AI ────────────────────────────────────
export const VOID: ThemeTokens = {
  name:    "VOID",
  isDark:  true,

  bg:      "#050505",
  bgAlt:   "#0C0C0C",
  card:    "rgba(255,255,255,0.055)",
  cardAlt: "rgba(255,255,255,0.09)",
  border:  "rgba(255,255,255,0.08)",

  fg:      "#F5F5F5",
  fgSoft:  "#E0E0E0",
  muted:   "rgba(255,255,255,0.45)",
  zinc:    "rgba(255,255,255,0.28)",

  green:         "#39FF14",
  greenEmphasis: "#00E676",
  greenTint:     "rgba(57,255,20,0.10)",
  onlineDot:     "#39FF14",

  logoTint: "#FFFFFF",

  background:        "#050505",
  foreground:        "#F5F5F5",
  mutedForeground:   "rgba(255,255,255,0.45)",
  zinc500:           "rgba(255,255,255,0.28)",
  primary:           "#F5F5F5",
  primaryForeground: "#050505",
  accent:            "rgba(255,255,255,0.09)",
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme:  ThemeTokens;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:  PURE,
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Flash overlay (cross-screen cinematic transition) ────────────────────────
interface FlashProps {
  themeName: "PURE" | "VOID";
}

function ThemeFlash({ themeName }: FlashProps) {
  const opacity  = useSharedValue(0);
  const prevName = useRef(themeName);

  useEffect(() => {
    if (prevName.current === themeName) return;
    prevName.current = themeName;
    opacity.value = withTiming(0.18, { duration: 110, easing: Easing.out(Easing.ease) }, () => {
      opacity.value = withTiming(0, { duration: 320, easing: Easing.inOut(Easing.ease) });
    });
  }, [themeName]);

  const flashColor = themeName === "VOID" ? "#000000" : "#FFFFFF";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: flashColor, zIndex: 9999, opacity: opacity as any },
      ]}
    />
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<"PURE" | "VOID">("PURE");

  const toggle = useCallback(() => {
    setThemeName(n => (n === "PURE" ? "VOID" : "PURE"));
  }, []);

  const theme = themeName === "PURE" ? PURE : VOID;

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
      <ThemeFlash themeName={themeName} />
    </ThemeContext.Provider>
  );
}
