"use strict";

/**
 * Shim for @react-native-masked-view/masked-view.
 *
 * This package is not bundled inside Expo Go. @react-navigation/elements
 * imports it via MaskedViewNative.js (which already has a try/catch), but
 * having a real module prevents Metro from injecting a synthetic throw-module
 * which can cause unpredictable runtime failures.
 *
 * Graceful degradation: renders children without any mask effect.
 */

const React = require("react");
const { View } = require("react-native");

function MaskedView({ children, maskElement, style, ...rest }) {
  return React.createElement(View, Object.assign({ style: style }, rest), children);
}

MaskedView.displayName = "MaskedView";

module.exports = {
  default: MaskedView,
  MaskedView: MaskedView,
};
