---
name: Bounded menu scrolling
description: Cross-platform flex rule for a ScrollView between fixed header and footer regions.
---

In a full-screen column with a fixed header and footer, give the middle ScrollView `flex: 1`, `minHeight: 0`, and explicit scroll overflow. Do not simulate the layout with absolute overlays or compensating bottom padding.

**Why:** React Native Web can preserve the ScrollView content's intrinsic minimum height. Without `minHeight: 0`, the middle region extends beneath the fixed footer and wheel scrolling has no effect even though the component has `flex: 1`.

**How to apply:** Use this whenever only a center list should scroll. Keep header and footer as sibling flex children outside the ScrollView, and verify that the last row can scroll fully above the footer.