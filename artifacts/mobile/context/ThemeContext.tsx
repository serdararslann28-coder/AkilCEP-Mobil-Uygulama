/**
 * Theme system — PURE (light) / VOID (dark).
 * "Silent Intelligence" — Apple × OpenAI luxury monochrome aesthetic.
 * No colorful greens, no neon, no warm amber. Black, white, and their shadows only.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Platform, StyleSheet, Text } from "react-native";

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

// ─── Theme mode type ──────────────────────────────────────────────────────────
// Only explicit light / dark — no system mode.
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "akilcep_theme_mode";

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme:        ThemeTokens;
  themeMode:    ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggle:       () => void;
  showToast:    (msg: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:        PURE,
  themeMode:    "light",
  setThemeMode: () => {},
  toggle:       () => {},
  showToast:    () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Flash overlay (cross-screen cinematic transition) ────────────────────────
function ThemeFlash({ themeName }: { themeName: "PURE" | "VOID" }) {
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
      style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, zIndex: 9999, opacity: opacity as any }]}
    />
  );
}

// ─── Toast notification (appears on theme change) ─────────────────────────────
function ThemeToast({ message, visible }: { message: string; visible: boolean }) {
  const translateY = useSharedValue(24);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 300 });
      opacity.value    = withTiming(1, { duration: 180 });
    } else {
      translateY.value = withTiming(16, { duration: 220, easing: Easing.in(Easing.ease) });
      opacity.value    = withTiming(0, { duration: 220 });
    }
  }, [visible]);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        toast.wrap,
        { bottom: Platform.OS === "web" ? 40 : 72 },
        anim,
      ]}
    >
      <Text style={toast.label}>{message}</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  wrap: {
    position:          "absolute",
    alignSelf:         "center",
    backgroundColor:   "rgba(18,18,20,0.90)",
    paddingHorizontal: 18,
    paddingVertical:   11,
    borderRadius:      99,
    zIndex:            9998,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.24,
    shadowRadius:      14,
    elevation:         10,
  },
  label: {
    fontSize:      14,
    fontFamily:    "Inter_500Medium",
    color:         "#FFFFFF",
    letterSpacing: -0.1,
  },
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to "light" — first launch is always Light Mode
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");

  // Toast state
  const [toastMsg,     setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted mode on mount (only "light" or "dark" accepted)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === "light" || val === "dark") {
          setThemeModeState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const isDark    = themeMode === "dark";
  const themeName = isDark ? "VOID" : "PURE";
  const theme     = isDark ? VOID   : PURE;

  // toggle() — single tap to switch Light ↔ Dark with toast feedback
  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setThemeMode(next);
    showToast(next === "light" ? "☀️  Açık Tema Aktif" : "🌙  Koyu Tema Aktif");
  }, [isDark, setThemeMode, showToast]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggle, showToast }}>
      {children}
      <ThemeFlash themeName={themeName} />
      <ThemeToast message={toastMsg} visible={toastVisible} />
    </ThemeContext.Provider>
  );
}
