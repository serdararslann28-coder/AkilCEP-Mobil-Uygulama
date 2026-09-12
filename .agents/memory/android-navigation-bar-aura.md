---
name: Android navigation-bar aura
description: How to distinguish and handle the Android three-button navigation area below the chat composer.
---

On physical Android screenshots, first determine whether a reported lower gap is inside the app above the keyboard or is the system three-button navigation area. Moving the composer does not change the latter.

**Why:** Multiple composer bottom-offset strategies produced no visible change because the marked region was the system navigation bar, not spacing between the composer and keyboard.

**How to apply:** Keep the composer above the actual safe-area inset, and extend background effects through that inset without moving interactive controls. Confirm the result on the same physical navigation mode because Expo Go controls part of the host window.