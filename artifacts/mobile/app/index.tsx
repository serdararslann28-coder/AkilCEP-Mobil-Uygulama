/**
 * Root index — redirects immediately to the chat screen.
 * Required so the web preview URL "/" is handled gracefully.
 * On native the Stack initialRouteName="splash" takes precedence.
 */
import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  return <Redirect href="/chat" />;
}
