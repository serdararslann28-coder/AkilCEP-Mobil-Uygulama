---
name: Responsive chat composer layout
description: The verified layout rule for keeping chat input, attachments, and messages collision-free on Android.
---

Keep attachment previews in a separate horizontal row above the input controls, but place both rows inside one shared composer surface so previews feel attached to the input. Reserve the composer's measured height in the message list instead of relying on a fixed bottom offset.

**Why:** The two-row arrangement was explicitly confirmed on a physical Android device with no overlap or overflow. The user later confirmed the rows should read visually as one composer rather than separate floating sections. Combining both into one row or restoring a fixed height risks reintroducing overflow.

Anchor the shared composer container to root `bottom: 0`. Keep the device bottom safe-area inset inside the animated outer container, fade it to zero as the keyboard opens, and apply one keyboard-height Y translation. Measure the inner dock content rather than the animated outer container so keyboard frames do not trigger React layout-state updates. Reserve the measured dock height plus the real bottom inset in the inverted message list. The `+` panel may open while the keyboard remains visible; preserve input focus and use the same measured spacing as its bottom offset.

**Why:** Updating an absolute `bottom` value was unreliable across Android/Expo Go window modes, and dismissing the keyboard before opening the popup contradicted the required interaction. A shared translation keeps `+`, input, microphone, send, and popup synchronized.

For multiline input, animate the wrapper and the TextInput from the same content-height shared value. The TextInput must receive the animated height directly; otherwise web and some layout engines leave it at its intrinsic single-line height while only the wrapper grows.

**How to apply:** Preserve the two-row structure inside one shared visual container and keep measured-height spacing during future composer changes. Never measure an outer container whose safe-area padding animates with the keyboard, and do not add fixed bottom offsets. When there are no attachments, preserve the compact original input appearance. Do not split composer controls into independently positioned keyboard elements.