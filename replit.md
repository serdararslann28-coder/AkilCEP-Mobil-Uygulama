# AkılCEP

Premium Turkish AI assistant mobile app with ultra-minimalist Apple × Nothing aesthetic, cinematic Voice Mode, and a full PURE/VOID theme system.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo Router, React Native + Reanimated v3
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Fonts: @expo-google-fonts/inter (400, 500, 600, 700)

## Where things live

- `artifacts/mobile/context/ThemeContext.tsx` — PURE/VOID token objects, ThemeProvider, useTheme hook, ThemeFlash overlay
- `artifacts/mobile/components/ThemeToggle.tsx` — animated floating sun↔moon pill button
- `artifacts/mobile/hooks/useColors.ts` — bridge from useColors() → ThemeContext (chat.tsx compat)
- `artifacts/mobile/app/_layout.tsx` — root layout, ThemeProvider wraps entire app
- `artifacts/mobile/app/(tabs)/index.tsx` — home screen with ThemeToggle floating bottom-left
- `artifacts/mobile/app/chat.tsx` — chat screen, useColors() auto-theme, FullscreenMenu
- `artifacts/mobile/app/voice.tsx` — cinematic always-listening voice mode (always dark #010108)
- `artifacts/mobile/app/profile.tsx` — profile editor, fully theme-aware
- `artifacts/mobile/components/FullscreenMenu.tsx` — full-screen nav overlay, ThemeToggle in bottom bar
- `artifacts/mobile/components/ProfileMenu.tsx` — bottom sheet profile menu

## Architecture decisions

- **PURE vs VOID**: Two complete token sets live in ThemeContext.tsx. PURE = soft warm white (#F6F6F3 bg, #6BCB8E green). VOID = cinematic black (#050505 bg, #39FF14 neon green). All screens read from these; no hardcoded palette constants anywhere else.
- **ThemeFlash overlay**: Full-screen Animated.View at zIndex 9999 inside ThemeProvider briefly pulses opacity on theme toggle, giving a cinematic cross-screen transition effect without needing any per-screen wiring.
- **useColors bridge**: `hooks/useColors.ts` now delegates entirely to `useTheme()` so any component calling `useColors()` gets theme-reactive tokens automatically.
- **Voice mode is theme-exempt**: `app/voice.tsx` uses its own hardcoded dark palette (#010108) to preserve the cinematic void aesthetic regardless of global theme.
- **Sidebar removed**: `components/Sidebar.tsx` is no longer imported anywhere; `chat.tsx` now opens FullscreenMenu instead.

## Product

- Ultra-premium AI chat assistant in Turkish
- Home screen with smart input, quick-start suggestions
- Full-screen navigation menu with conversation history
- Cinematic always-listening Voice Mode
- Profile system with avatar image picker and crop modal
- PURE (light) / VOID (dark) theme with animated toggle pill and full-screen flash transition

## User preferences

- Language: Turkish UI, English code comments
- No emojis in code
- Apple-inspired minimalist UI aesthetic
- Cinematic dark mode = "VOID", clean light mode = "PURE"
- Voice mode is always dark — never adapts to global theme
- ThemeToggle floats bottom-left on home screen and lives in FullscreenMenu bottom bar

## Gotchas

- `tintColor` on `<Image>` shows deprecation warning on newer RN — harmless for now
- `shadow*` style props show web deprecation warnings — expected on Expo web
- ThemeFlash zIndex (9999) must remain above all screen content but below native modals
- TypeScript: pre-existing `useColors.ts` error is suppressed — the file is now valid

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
