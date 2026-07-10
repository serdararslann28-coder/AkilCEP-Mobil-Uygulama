/**
 * DIAGNOSTIC MODE — temporary bypass of startup flow.
 *
 * Skips splash / welcome / onboarding and lands directly on /chat.
 * Restore href="/splash" to re-enable the full startup sequence.
 *
 * Original: <Redirect href="/splash" />
 */
import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  return <Redirect href="/chat" />;
}
