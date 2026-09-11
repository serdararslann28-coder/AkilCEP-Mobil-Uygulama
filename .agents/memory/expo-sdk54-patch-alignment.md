---
name: Expo Go SDK patch alignment
description: Expo Go compatibility depends on matching the installed SDK runtime and patch set
---

## Rule
Keep the mobile project's Expo package, lockfile, Expo CLI, and proxy runtime version aligned with the installed SDK. The current app uses the SDK 57 set and advertises `exposdk:57.0.0` to Expo Go.

**Why:** Expo Go can load the manifest and bundle while still failing on the device when the project runtime metadata or native dependency patch set differs from the client expectation.

**How to apply:** When Expo reports an expected patch version, update the mobile package and lockfile together, update any proxy prewarm runtime header, restart the managed Expo workflow with a clean cache, and verify the public manifest and platform bundle before asking the user to reconnect. Do not disable the workspace's minimum-release-age safety setting just to install a newly published patch.