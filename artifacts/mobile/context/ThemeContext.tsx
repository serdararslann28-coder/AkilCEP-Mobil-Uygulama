/**
 * Theme system — PURE (light) / VOID (dark).
 * "Silent Intelligence" — Apple × OpenAI luxury monochrome aesthetic.
 * No colorful greens, no neon, no warm amber. Black, white, and their shadows only.
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

  // Accent — monochrome (replaces color-coded green; naming kept for compat)
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

// ─── PURE — pristine cold white, luxury editorial minimalism ──────────────────
// Think: Apple white paper. Generous air. No color distractions.
export const PURE: ThemeTokens = {
  name:    "PURE",
  isDark:  false,

  bg:      "#F7F7F5",           // cool off-white — cleaner than warm #F6F6F3
  bgAlt:   "#EDEDEB",
  card:    "#FFFFFF",
  cardAlt: "#F4F4F2",
  border:  "rgba(0,0,0,0.055)",

  fg:      "#0C0C0C",           // near-black — authority without harshness
  fgSoft:  "#303030",
  muted:   "#8C8C8C",
  zinc:    "#B0B0B0",

  // Accent — near-black (no color; monochrome only)
  green:         "#0C0C0C",     // used wherever green was: buttons, active states
  greenEmphasis: "#000000",
  greenTint:     "rgba(0,0,0,0.048)",
  onlineDot:     "#909090",     // neutral presence indicator

  logoTint: "#0C0C0C",

  background:        "#F7F7F5",
  foreground:        "#0C0C0C",
  mutedForeground:   "#8C8C8C",
  zinc500:           "#B0B0B0",
  primary:           "#0C0C0C",
  primaryForeground: "#FFFFFF",
  accent:            "#E8E8E6",
};

// ─── VOID — deep graphite, warm ivory text, silent cinematic darkness ──────────
// Think: OpenAI dark mode. Calm depth. Warm not cold. No neon ever.
export const VOID: ThemeTokens = {
  name:    "VOID",
  isDark:  true,

  bg:      "#0A0A0A",           // deep graphite (not pure black — more premium)
  bgAlt:   "#141414",
  card:    "rgba(255,255,255,0.042)",
  cardAlt: "rgba(255,255,255,0.075)",
  border:  "rgba(255,255,255,0.068)",

  fg:      "#EDEBE7",           // warm ivory white — like fine paper
  fgSoft:  "#C4C2BC",
  muted:   "rgba(237,235,231,0.42)",
  zinc:    "rgba(237,235,231,0.26)",

  // Accent — warm ivory (no neon; monochrome only)
  green:         "rgba(237,235,231,0.82)", // used wherever green was: active icons
  greenEmphasis: "#EDEBE7",
  greenTint:     "rgba(237,235,231,0.065)",
  onlineDot:     "rgba(180,178,172,0.60)", // subtle presence indicator

  logoTint: "#EDEBE7",

  background:        "#0A0A0A",
  foreground:        "#EDEBE7",
  mutedForeground:   "rgba(237,235,231,0.42)",
  zinc500:           "rgba(237,235,231,0.26)",
  primary:           "#EDEBE7",
  primaryForeground: "#0A0A0A",
  accent:            "rgba(255,255,255,0.075)",
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
    opacity.value = withTiming(0.15, { duration: 120, easing: Easing.out(Easing.ease) }, () => {
      opacity.value = withTiming(0, { duration: 340, easing: Easing.inOut(Easing.ease) });
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
