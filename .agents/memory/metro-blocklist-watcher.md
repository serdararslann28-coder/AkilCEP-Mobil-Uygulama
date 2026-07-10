---
name: Metro blockList watcher scope
description: Metro's blockList regex must match bare pnpm temp directory paths without a trailing slash or it crashes the FallbackWatcher
---

Metro's `resolver.blockList` is passed to `metro-file-map`'s `FallbackWatcher` to skip directories it shouldn't watch. The regex is tested against absolute directory paths.

**Wrong pattern (crashes):**
```js
/node_modules\/\.pnpm\/.*_tmp_\d+\/.*/
```
Requires at least one character after `_tmp_NNNN/`. pnpm sometimes creates bare temp directories like `log-symbols_tmp_1040` with no files inside yet. The regex doesn't match → `FallbackWatcher._watchdir` calls `fs.watch()` → ENOENT → Metro process exits.

**Correct pattern:**
```js
/node_modules\/\.pnpm\/.*_tmp_\d+.*/
```
The `.*` at the end matches both the bare directory AND any paths inside it.

**Why:** pnpm's native rebuild creates short-lived temp directories. Between Metro's directory scan and its watch setup, pnpm may delete the temp dir. If Metro tries to watch a deleted directory with `fs.watch()`, Node throws ENOENT and Metro crashes entirely — not just a warning.

**How to apply:** Any new Expo project in Replit with pnpm should use the corrected pattern. Triggered when `pnpm add` runs during an active Metro session (e.g. installing `expo-dev-client`).
