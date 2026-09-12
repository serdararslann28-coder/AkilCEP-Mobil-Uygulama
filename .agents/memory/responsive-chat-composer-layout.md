---
name: Responsive chat composer layout
description: The verified layout rule for keeping chat input, attachments, and messages collision-free on Android.
---

Keep attachment previews in a separate horizontal row above the input controls, but place both rows inside one shared composer surface so previews feel attached to the input. Reserve the composer's measured height in the message list instead of relying on a fixed bottom offset.

**Why:** The two-row arrangement was explicitly confirmed on a physical Android device with no overlap or overflow. The user later confirmed the rows should read visually as one composer rather than separate floating sections. Combining both into one row or restoring a fixed height risks reintroducing overflow.

Keep the composer attached to the animated keyboard height with one Y-axis translation applied to the shared composer container, and fade out the device bottom safe-area contribution as the keyboard opens so the inset is not counted twice. The `+` panel may open while the keyboard remains visible; preserve input focus and translate the popup by the same keyboard height.

**Why:** Updating an absolute `bottom` value was unreliable across Android/Expo Go window modes, and dismissing the keyboard before opening the popup contradicted the required interaction. A shared translation keeps `+`, input, microphone, send, and popup synchronized.

**How to apply:** Preserve the two-row structure inside one shared visual container and keep measured-height spacing during future composer changes. When there are no attachments, preserve the compact original input appearance. Do not split composer controls into independently positioned keyboard elements.