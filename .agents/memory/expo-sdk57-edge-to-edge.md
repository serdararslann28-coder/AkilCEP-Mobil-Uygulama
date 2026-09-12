---
name: Expo SDK 57 Android edge-to-edge
description: Root layout, system bar, and safe-area rules for full-screen Android layouts in Expo SDK 57.
---

Expo SDK 57 enforces Android edge-to-edge on Android 15+, but Expo Go can still use legacy system-bar behavior on older Android devices. Keep every root provider and the router surface at `flex: 1`, set a root background color, and place interactive UI with `useSafeAreaInsets()` rather than shrinking the whole app inside a `SafeAreaView`.

**Why:** `expo-status-bar` in SDK 57 no longer accepts the old runtime `backgroundColor` or `translucent` props, but React Native's core `StatusBar` still supports them for pre-Android 15 devices. Without that legacy overlay setting, a real Expo Go device can show a large black status-bar band even when the React root itself is full-screen.

**How to apply:** Make `GestureHandlerRootView` the full-screen outer view, give `SafeAreaProvider` initial window metrics and `flex: 1`, and give the router Stack a full-screen content style. At the root, use React Native's core `StatusBar` with a transparent background and `translucent` for older Android; use `expo-navigation-bar` light/dark style without hiding system controls. Position custom headers and docks using top and bottom safe-area insets.

On TECNO HiOS, measure a physical screenshot before changing layout padding. If the app surface is full width and the black regions lie entirely outside the React surface, Android is letterboxing the Expo Go host activity. Sync `expo-system-ui` and the app manifest background to the active theme so controllable root space does not default to black. Expo Go's native activity manifest cannot be changed by the embedded project's config plugins; a HiOS per-app full-screen override or a project-owned development build is required if host letterboxing remains.

**Confirmed:** On a TECNO Spark 20 Pro running Android 13/HiOS, changing the app manifest root background from black to the light theme color and syncing `expo-system-ui` at runtime removed both visible black bands in Expo Go. The status bar and three-button navigation bar remained as required Android system areas, matched the app surface, and did not overlap controls.