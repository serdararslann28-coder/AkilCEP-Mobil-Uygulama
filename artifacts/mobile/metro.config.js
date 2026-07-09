const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block Metro's file watcher from trying to watch ephemeral native autolinking
// temp directories that pnpm creates and removes during installation.
// Without this Metro crashes with ENOENT when it tries to watch e.g.
// expo-file-system_tmp_1029/android/src/main/java/expo right after pnpm install.
config.resolver.blockList = [
  // Any _tmp_ directory inside a pnpm-managed package
  /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/,
];

// Redirect native-only packages to Expo Go compatible shims.
// The shims self-detect appOwnership at runtime:
//   - Expo Go  → pure-JS passthrough (layout preserved, native features off)
//   - Dev/prod build → delegates to the real package via on-disk path
const shimDir = path.join(__dirname, "shims");

config.resolver.resolveRequest = (context, moduleName, platform) => {
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
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
