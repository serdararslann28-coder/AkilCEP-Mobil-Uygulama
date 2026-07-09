---
name: Expo Go shim detection
description: How to correctly detect Expo Go at runtime in SDK 47+ (SDK 54 confirmed)
---

## Rule
Use `Constants.executionEnvironment === "storeClient"` to detect Expo Go in SDK 47+.
`Constants.appOwnership === "expo"` is deprecated and returns `null` in SDK 54, making `isExpoGo = false` and loading native-only code that crashes.

**Why:** Expo deprecated `appOwnership` in SDK 47. In SDK 54 it returns `null` in Expo Go, breaking shims that relied on it. The new API is `executionEnvironment` which returns `"storeClient"` in Expo Go.

**How to apply:** Always use both for belt-and-suspenders coverage:
```js
isExpoGo =
  Constants.executionEnvironment === "storeClient" || // SDK 47+ canonical
  Constants.appOwnership === "expo";                   // legacy fallback
```
