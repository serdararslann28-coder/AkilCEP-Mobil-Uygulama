---
name: Responsive chat composer layout
description: The verified layout rule for keeping chat input, attachments, and messages collision-free on Android.
---

Keep attachment previews in a separate horizontal row above the input controls, but place both rows inside one shared composer surface so previews feel attached to the input. Reserve the composer's measured height in the message list instead of relying on a fixed bottom offset.

**Why:** The two-row arrangement was explicitly confirmed on a physical Android device with no overlap or overflow. The user later confirmed the rows should read visually as one composer rather than separate floating sections. Combining both into one row or restoring a fixed height risks reintroducing overflow.

When the keyboard opens, close the multimodal `+` panel immediately. Keep the composer attached to the animated keyboard height, but fade out the device bottom safe-area contribution as keyboard progress reaches fully open so the inset is not counted twice.

**Why:** Leaving the panel open causes it to overlap the keyboard-adjusted composer, while retaining the full bottom inset above an open keyboard creates an unnecessary gap.

**How to apply:** Preserve the two-row structure inside one shared visual container and keep measured-height spacing during future composer changes. When there are no attachments, preserve the compact original input appearance. Any new way of focusing the input must also close the multimodal panel.