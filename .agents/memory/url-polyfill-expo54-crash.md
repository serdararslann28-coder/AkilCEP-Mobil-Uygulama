---
name: url-polyfill Expo SDK 54 crash
description: react-native-url-polyfill/auto breaks Expo Go on SDK 50+ by replacing Hermes native URL before Expo Router initialises
---

Do NOT add `import "react-native-url-polyfill/auto"` to any file in an Expo SDK 50+ project.

**Why:** `setupURLPolyfill()` unconditionally replaces `globalThis.URL` and `globalThis.URLSearchParams` with a JS polyfill at module-load time. Expo SDK 50+ ships Hermes with native URL support. When the polyfill overwrites the native URL, Expo Router's path parsing misbehaves or throws before any screen renders. Expo Go reports this as "cannot connect" (not a JS error screen) because the crash happens before Expo's own error boundary is registered.

**How to apply:** If `@supabase/supabase-js` (or any library) recommends adding `react-native-url-polyfill/auto`, skip the import entirely for Expo SDK ≥ 50. The package can remain in `package.json` (supabase docs reference it); only the side-effect import line must be absent.

**Confirmed signal:** Module count drops by ~6 when the import is removed (the polyfill + whatwg-url + ios10Fix modules leave the bundle). Bundle went from 1943 → 1937 modules after removal.
