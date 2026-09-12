---
name: Expo SDK 57 native file picker
description: Native single or multiple document selection through the expo-file-system File API.
---

Use `File.pickFileAsync` from `expo-file-system` for native document selection in Expo SDK 57. Passing `{ multipleFiles: true, mimeTypes: [...] }` returns a cancellable result containing `File[]`.

**Why:** Attempting to add a separate document-picker dependency was unnecessary and can be blocked by package maturity checks for newly released SDK dependencies. The installed SDK already exposes the system picker.

**How to apply:** Prefer the existing File API for PDF, text, and Office attachment selection. Read the installed type declaration before use because the result shape differs from the older deprecated overload.