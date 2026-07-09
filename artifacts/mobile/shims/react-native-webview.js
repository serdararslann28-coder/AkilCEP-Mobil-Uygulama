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
  isExpoGo = Constants.appOwnership === "expo";
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
