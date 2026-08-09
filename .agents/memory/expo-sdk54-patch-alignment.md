---
name: Expo SDK 54 patch alignment
description: Expo Go compatibility depends on matching the installed SDK patch version
---

## Rule
Keep the mobile project's Expo package aligned with the patch version reported by Expo Go. For this SDK 54 project, the compatible version is `54.0.36`, not `54.0.35`.

**Why:** Expo Go can load the manifest and bundle while still failing on the device when the project patch version differs from the client expectation.

**How to apply:** When Expo reports an expected patch version, update the mobile package and lockfile together, restart the managed Expo workflow with a clean cache, and confirm Expo Doctor reports no incorrect dependencies before asking the user to reconnect.