import { Redirect } from "expo-router";

/** Compatibility for old voice links: the shared composer now owns Voice Mode. */
export default function VoiceScreen() {
  return <Redirect href="/chat?voice=1" />;
}
