---
name: Expo Go tunnel routing
description: Why physical Expo Go devices must use the direct Expo tunnel rather than the Replit preview proxy
---

## Rule
For physical Expo Go testing, prefer the direct Expo `--tunnel` URL and ensure both the manifest `launchAsset.url` and the bundle `Content-Location` use the same public `exp.direct` host.

**Why:** A Replit preview proxy can return a public manifest and a downloadable bundle while Metro still emits an internal `localhost` or private-port `Content-Location`. Android Expo Go can then fail with `Failed to download remote update`.

**How to apply:** Start only the managed mobile workflow with Expo tunnel mode and a clean cache. Before exposing a QR code, request the Android manifest without credentials, extract its launch asset URL, download that exact URL without credentials, and reject any redirect, auth challenge, Replit preview host, localhost, or internal port.