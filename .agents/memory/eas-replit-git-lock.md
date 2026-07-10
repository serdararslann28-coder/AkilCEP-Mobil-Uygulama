---
name: EAS CLI git lock in Replit main agent
description: Replit main agent sandbox blocks all writes to .git/index.lock; EAS CLI 20.5.1 with EXPO_NO_GIT_STATUS_CHECK=1 hits this when there are modified tracked files
---

## Rule
Submit EAS builds from a **clean committed git state**. Do not use `EXPO_NO_GIT_STATUS_CHECK=1` when there are modified tracked files — EAS CLI 20.5.1 tries to write `.git/index.lock` in that case, which Replit's main agent sandbox blocks.

**Why:** Replit's main agent sandbox blocks all writes to `/home/runner/workspace/.git/index.lock` (and any git index write operations) system-wide. EAS CLI 20.5.1 uses `EXPO_NO_GIT_STATUS_CHECK=1` by running git stash or git add when there are modified tracked files, creating `.git/index.lock`. With untracked-only changes it may work but with modified tracked files it fails. Additionally, a stale `.git/index.lock` can be left by expo prebuild or pnpm, blocking further git ops until a Replit checkpoint clears it.

**How to apply:**
1. Wait for Replit's automatic checkpoint to commit all changes (it runs at loop-end).
2. Verify `git --no-optional-locks status --short` shows nothing (clean state).
3. Submit EAS builds without `EXPO_NO_GIT_STATUS_CHECK=1` — `git archive HEAD` is read-only and not blocked.
4. If stale lock exists (`.git/index.lock`), wait for next checkpoint — it will be cleared automatically.
