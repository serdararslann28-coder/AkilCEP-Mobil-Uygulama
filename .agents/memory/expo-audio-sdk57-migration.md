---
name: Expo Audio SDK 57 migration
description: Recorder lifecycle and verification rules for replacing expo-av with expo-audio in Expo Go SDK 57.
---

Use `useAudioRecorder` with `RecordingPresets`, then call `prepareToRecordAsync()`, `record()`, `stop()`, and read `recorder.uri`. Use `requestRecordingPermissionsAsync()` and `setAudioModeAsync()` from `expo-audio`; the current mode keys are `allowsRecording` and `playsInSilentMode`.

**Why:** Expo Go SDK 57 does not provide the legacy `ExponentAV` native module, so importing `expo-av` causes a fatal startup error even if recording is not active.

**How to apply:** Remove `expo-av` from source imports, dependencies, config plugins, and the lockfile. Verify native removal by scanning for `ExponentAV` and real `expo-av` module paths; `expo-audio` itself contains one harmless source comment mentioning `expo-av`, so a generic literal scan of the compiled bundle is a false positive.