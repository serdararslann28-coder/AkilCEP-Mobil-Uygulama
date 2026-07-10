/**
 * Root index — redirects to the splash screen so the full startup flow runs.
 *
 * Expo Router v6 uses index.tsx as the true entry point on both web and native.
 * Stack initialRouteName="splash" does NOT override this; routing to /chat here
 * was skipping Splash → Welcome → Onboarding entirely.
 */
import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  return <Redirect href="/splash" />;
}
