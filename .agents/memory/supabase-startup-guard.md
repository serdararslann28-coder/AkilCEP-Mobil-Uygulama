---
name: Supabase startup guard
description: Prevent malformed Supabase environment values from crashing Expo Go at startup
---

## Rule
Validate `EXPO_PUBLIC_SUPABASE_URL` before passing it to `createClient`. If it is missing or malformed, use a known-valid placeholder URL and keep `isSupabaseConfigured` false so local/guest flows can render.

**Why:** Expo Router imports the Supabase module during the first render. Supabase throws synchronously for a malformed URL, producing only the generic Expo Go “Something went wrong” screen before the app can show its own auth state.

**How to apply:** Keep the guard in the shared Supabase client module. Treat the app as unauthenticated until a real HTTPS project URL and anon/publishable key are supplied; do not silently claim that email auth is active.