/**
 * Root index — redirects to the splash screen so the full startup flow runs.
 *
 * Expo Router v6 uses index.tsx as the true entry point on both web and native.
 * Stack initialRouteName="splash" does NOT override this file-based routing.
 * Do NOT change this to /chat — that skips Splash → Welcome → Onboarding.
 */
import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  return <Redirect href="/splash" />;
}
