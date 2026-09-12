---
name: Drawer row deletion gestures
description: Cross-platform constraints for swipe-to-delete rows inside the swipe-closing chat drawer.
---

Conversation-row left swipes must not share a parent PanResponder with the drawer-close gesture. Give history rows their own horizontal responder, keep vertical movement with the ScrollView, and limit drawer-close responders to non-row areas and the backdrop.

**Why:** Parent responders repeatedly captured row swipes and turned them into drawer close or conversation selection. React Native Web also needs pointer-coordinate handling for mouse-driven swipe verification; its `Alert.alert` implementation is a no-op, so destructive confirmations must use an in-app modal when web parity matters. During HMR, Reanimated shared values can preserve a visually open row while React state resets, so gesture tests must hard reload before evaluating hit targets.

**How to apply:** Preserve directional thresholds, prevent open-row taps from selecting the conversation, and verify persistence in a context that seeds AsyncStorage only once—not with an init script that rewrites fixtures on every reload.