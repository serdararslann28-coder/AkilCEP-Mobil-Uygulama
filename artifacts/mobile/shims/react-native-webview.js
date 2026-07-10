"use strict";

/**
 * Expo Go shim for react-native-webview.
 *
 * react-native-webview ships a native module (RNCWebView) that is not
 * bundled inside Expo Go. This shim detects whether we are running inside
 * Expo Go and:
 *
 *   - In Expo Go  → renders a transparent View placeholder that preserves the
 *     layout geometry. The WebView content is not shown but the app loads.
 *
 *   - In a real dev/prod build → delegates entirely to the real package.
 */

let isExpoGo = false;
try {
  const Constants = require("expo-constants").default;
  // SDK 47+ canonical check (executionEnvironment === "storeClient" = Expo Go).
  // appOwnership === "expo" kept as legacy fallback for pre-SDK-47 clients.
  // NOTE: on Android Expo Go SDK 54, appOwnership returns null (deprecated).
  //       Without the executionEnvironment check this shim would load the real
  //       native module and crash because RNCWebView is not registered in Expo Go.
  isExpoGo =
    Constants.executionEnvironment === "storeClient" || // SDK 47+ (current)
    Constants.appOwnership === "expo";                   // legacy fallback
} catch (_) {}

if (!isExpoGo) {
  // Real build — use the native module as normal.
  module.exports = require("react-native-webview/src/index");
} else {
  // ─── Expo Go fallback ──────────────────────────────────────────────────────

  const React = require("react");
  const { View } = require("react-native");

  // Transparent placeholder that keeps the same flex / size behaviour.
  function WebView({ style, containerStyle }) {
    return React.createElement(View, {
      style: [{ flex: 1 }, containerStyle, style],
    });
  }

  module.exports = { WebView };
  module.exports.default = WebView;
}
