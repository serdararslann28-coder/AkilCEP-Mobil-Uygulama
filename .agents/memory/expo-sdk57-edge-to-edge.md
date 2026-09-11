---
name: Expo SDK 57 Android edge-to-edge
description: Root layout, system bar, and safe-area rules for full-screen Android layouts in Expo SDK 57.
---

Expo SDK 57 enforces Android edge-to-edge. Keep every root provider and the router surface at `flex: 1`, set a root background color, and place interactive UI with `useSafeAreaInsets()` rather than shrinking the whole app inside a `SafeAreaView`.

**Why:** `expo-status-bar` in SDK 57 no longer accepts the old runtime `backgroundColor` or `translucent` props. System bars overlay the app surface, so missing root fill/background or ignored insets can appear as blank bands or cause bottom controls to overlap navigation gestures.

**How to apply:** Make `GestureHandlerRootView` the full-screen outer view, give `SafeAreaProvider` initial window metrics and `flex: 1`, give the router Stack a full-screen content style, use only the status-bar icon style at runtime, and position custom headers/docks using top and bottom safe-area insets.