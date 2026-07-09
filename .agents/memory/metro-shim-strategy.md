---
name: Metro shim strategy for Expo Go
description: How to redirect unresolvable native modules via metro.config.js resolveRequest
---

## Rule
When a native package is not bundled in Expo Go, add a `resolveRequest` entry in `metro.config.js` pointing to a `shims/` file. Also redirect deprecated internal paths (e.g. old Reanimated 2/3 paths) to their Reanimated 4 equivalents.

**Why:** Without a redirect, Metro injects a synthetic throw-module. Even when wrapped in try/catch in the package source, the throw-module can trigger runtime errors in some code paths.

**Packages shimmed in this project:**
- `react-native-webview` → `shims/react-native-webview.js`
- `react-native-keyboard-controller` → `shims/react-native-keyboard-controller.js`
- `@react-native-masked-view/masked-view` → `shims/react-native-masked-view.js`
- `react-native-reanimated/src/reanimated2/core` → redirected to `react-native-reanimated/src/core` (Reanimated 4 removed the old internal path)

**React Compiler:** `reactCompiler: true` in `app.json` experiments is unstable and was disabled — it caused potential runtime crashes in Expo Go with SDK 54.
