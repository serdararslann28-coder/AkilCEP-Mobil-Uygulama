/**
 * useColors — returns design tokens for the active theme.
 * Bridges the legacy color-scheme hook into the ThemeContext system.
 * Components that call useColors() automatically respond to PURE ↔ VOID.
 */
import { useTheme } from "@/context/ThemeContext";
import colors from "@/constants/colors";

export function useColors() {
  const { theme } = useTheme();
  return { ...theme, radius: colors.radius };
}
