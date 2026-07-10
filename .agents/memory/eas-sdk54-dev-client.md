---
name: EAS Build SDK 54 expo-dev-client version
description: expo-dev-client@57.x is wrong for Expo SDK 54 and causes Kotlin compilation failure; correct version is ~6.0.21
---

## Rule
For Expo SDK 54, expo-dev-client must be ~6.0.21 (not 57.x). Install via `pnpm exec expo install expo-dev-client` from the mobile package directory.

**Why:** expo-dev-client@57.x pulls in expo-dev-launcher@57.x and expo-dev-menu@57.x, which fail Kotlin compilation (`:expo-dev-menu:compileDebugKotlin`) on EAS Build workers with the Kotlin version shipped for SDK 54. The version 57.x is for a future/unreleased SDK.

**How to apply:** Any time expo-doctor reports "expected ~6.0.21 but found 57.x" for expo-dev-client, run `cd artifacts/mobile && pnpm exec expo install expo-dev-client` which resolves to the correct ~6.0.21. Also verify pnpm-lock.yaml shows `expo-dev-launcher@6.x`, not `@57.x`.
