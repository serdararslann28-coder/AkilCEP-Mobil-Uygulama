---
name: Responsive chat composer layout
description: The verified layout rule for keeping chat input, attachments, and messages collision-free on Android.
---

Keep attachment previews in a separate horizontal row above the input controls. Reserve the composer's measured height in the message list instead of relying on a fixed bottom offset.

**Why:** This arrangement was explicitly confirmed on a physical Android device with no overlap or overflow. Combining previews with the control row or restoring a fixed composer-height estimate risks reintroducing the original layout problem.

**How to apply:** Preserve the two-row structure and measured-height spacing during future composer changes. Treat placeholder-only edits as text changes and do not alter this layout.