const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block Metro's file watcher from trying to watch ephemeral native autolinking
// temp directories that pnpm creates and removes during installation.
// Pattern covers BOTH:
//   .pnpm/expo-file-system@1.x/node_modules/expo-file-system_tmp_1029/...  (file inside)
//   .pnpm/log-symbols@4.x/node_modules/log-symbols_tmp_1040               (directory itself)
// The original regex required a trailing slash+content which missed bare directories.
config.resolver.blockList = [
  /node_modules\/\.pnpm\/.*_tmp_\d+.*/,
];

const shimDir = path.join(__dirname, "shims");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ─── Expo Go shims ──────────────────────────────────────────────────────────
  // Redirect native-only packages to pure-JS passthrough shims.
  // The shims self-detect executionEnvironment at runtime and delegate to the
  // real native package in dev/prod builds.

  if (moduleName === "react-native-webview") {
    return {
      filePath: path.join(shimDir, "react-native-webview.js"),
      type: "sourceFile",
    };
  }

  if (moduleName === "react-native-keyboard-controller") {
    return {
      filePath: path.join(shimDir, "react-native-keyboard-controller.js"),
      type: "sourceFile",
    };
  }

  // ─── @react-native-masked-view/masked-view ──────────────────────────────────
  // Not installed; @react-navigation/elements imports it inside try/catch but
  // Metro still creates a synthetic throw-module for it. A real shim is safer.
  if (
    moduleName === "@react-native-masked-view/masked-view" ||
    moduleName === "@react-native-masked-view/masked-view/lib/index"
  ) {
    return {
      filePath: path.join(shimDir, "react-native-masked-view.js"),
      type: "sourceFile",
    };
  }

  // ─── Reanimated 2/3 internal path (removed in Reanimated 4) ────────────────
  // react-native-keyboard-controller@1.18.5 references the old internal path
  // react-native-reanimated/src/reanimated2/core as a fallback after first
  // trying react-native-reanimated/src/core. Both are caught in try/catch in
  // event-handler.js, but we redirect the old path to the new one so Metro
  // doesn't inject a synthetic throw-module into the bundle.
  if (moduleName === "react-native-reanimated/src/reanimated2/core") {
    // Redirect to the Reanimated 4 equivalent path.
    return context.resolveRequest(
      context,
      "react-native-reanimated/src/core",
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
