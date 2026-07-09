"use strict";

/**
 * Expo Go shim for react-native-keyboard-controller.
 *
 * react-native-keyboard-controller ships native Turbo Modules that are not
 * bundled inside Expo Go. This shim detects whether we are running inside
 * Expo Go and:
 *
 *   - In Expo Go  → provides pure-JS passthrough implementations so the app
 *     loads and renders. Keyboard-height animations stay at 0 but the layout
 *     is fully preserved. No UI change.
 *
 *   - In a real dev/prod build → delegates entirely to the real package so
 *     native keyboard tracking works normally.
 *
 * Detection: Constants.executionEnvironment === "storeClient" (SDK 47+).
 * The deprecated Constants.appOwnership === "expo" is kept as a legacy fallback.
 */

let isExpoGo = false;
try {
  const Constants = require("expo-constants").default;
  // SDK 47+ canonical way to detect Expo Go (storeClient = running inside Expo Go app)
  const execEnv = Constants.executionEnvironment;
  const appOwnership = Constants.appOwnership;
  isExpoGo =
    execEnv === "storeClient" ||   // current API (SDK 47+)
    appOwnership === "expo";        // legacy fallback (SDK <47)
} catch (_) {}

if (!isExpoGo) {
  // Real dev/production build — use the native module as normal.
  // We reference the package by its on-disk path so this require() is NOT
  // intercepted by our own metro.config.js resolveRequest hook.
  const realPkg = "react-native-keyboard-controller/src/index";
  module.exports = require(realPkg);
} else {
  // ─── Expo Go fallback ──────────────────────────────────────────────────────

  const React = require("react");
  const {
    ScrollView,
    KeyboardAvoidingView: RNKeyboardAvoidingView,
  } = require("react-native");
  const { useSharedValue } = require("react-native-reanimated");

  // Transparent wrapper — just renders children directly.
  function KeyboardProvider({ children }) {
    return children;
  }

  // Returns Reanimated shared values so animated styles that read
  // kbReanimated.height.value don't crash — they just always see 0.
  function useKeyboardContext() {
    const height = useSharedValue(0);
    const progress = useSharedValue(0);
    const heightWhenOpened = useSharedValue(0);
    return {
      reanimated: { height, progress, heightWhenOpened },
    };
  }

  // Delegate to React Native's built-in KeyboardAvoidingView.
  const KeyboardAvoidingView = RNKeyboardAvoidingView;

  // Delegate to ScrollView — same API surface for the props we use.
  const KeyboardAwareScrollView = React.forwardRef(
    function KeyboardAwareScrollView({ children, ...rest }, ref) {
      return React.createElement(
        ScrollView,
        Object.assign({}, rest, { ref }),
        children
      );
    }
  );

  module.exports = {
    KeyboardProvider,
    KeyboardAvoidingView,
    KeyboardAwareScrollView,
    useKeyboardContext,
  };
}
