import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer } from "expo-audio";
import { Asset } from "expo-asset";
import * as Speech from "expo-speech";
import type { WeatherData } from "@/lib/weather";

type Budget = { openingId: number; deadline: number | null; done: boolean };
// A chat remount or a preference toggle must not grant another allowance.
const budgets = new Map<string, Budget>();
const SOURCE = require("../assets/sounds/rain-ambience.mp3");
const DURATION = 30_000;

/** One 30-second wall-clock allowance per opening; never owns the recorder's audio mode. */
export function useRainAmbience({ data, active, blocked, userKey, openingId }: {
  data: WeatherData | null; active: boolean; blocked: boolean; userKey: string;
  openingId: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `akilcep:rain-sound:v1:${userKey}`;
  const revision = useRef(0);
  const wet = data?.kind === "rain" ||
    (data?.kind === "storm" && Math.max(data.rain, data.precipitation) > 0);
  const eligible = enabled && loadedKey === key && active && !blocked && wet && !failed;

  useEffect(() => { setFailed(false); }, [openingId]);

  useEffect(() => {
    let alive = true;
    const version = ++revision.current;
    setEnabled(false);
    setLoadedKey(null);
    setFailed(false);
    AsyncStorage.getItem(key).then(value => {
      if (alive && version === revision.current) {
        // Automatic by default; preserve an explicit user mute.
        setEnabled(value !== "off");
        setLoadedKey(key);
      }
    }).catch(() => { if (alive) setLoadedKey(key); });
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    if (!eligible) return;
    let budget = budgets.get(userKey);
    if (!budget || budget.openingId !== openingId) {
      budget = { openingId, deadline: null, done: false };
      budgets.set(userKey, budget);
    }
    const session = budget;
    if (session.done || (session.deadline !== null && Date.now() >= session.deadline)) {
      session.done = true;
      return;
    }
    let disposed = false;
    let poll: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let native: ReturnType<typeof createAudioPlayer> | undefined;
    let web: HTMLAudioElement | undefined;
    let subscription: { remove(): void } | undefined;
    let requested = false;
    const release = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(poll); clearTimeout(expiry); clearTimeout(watchdog);
      subscription?.remove();
      if (web) {
        web.onplaying = null; web.onerror = null;
        web.pause(); web.removeAttribute("src"); web.load();
      }
      if (native) {
        try { native.pause(); } catch { /* still release */ }
        try { native.remove(); } catch { /* already released by platform */ }
      }
    };
    const fail = () => {
      setFailed(true);
      console.warn("[rain-ambience] Yağmur sesi başlatılamadı; ses ayarından yeniden deneyebilirsiniz.");
      release();
    };
    const expire = () => { session.done = true; release(); };
    const armDeadline = () => {
      if (disposed) return;
      // Count only once actual media playback has begun, never on play request.
      if (session.deadline === null) session.deadline = Date.now() + DURATION;
      clearTimeout(watchdog);
      clearTimeout(expiry);
      const remaining = session.deadline - Date.now();
      if (remaining <= 0) expire();
      else expiry = setTimeout(expire, remaining);
    };
    if (session.deadline !== null) armDeadline();
    const check = async () => {
      let speaking = true;
      try { speaking = await Speech.isSpeakingAsync(); } catch { /* fail closed */ }
      if (disposed) return;
      if (session.deadline !== null && Date.now() >= session.deadline) { expire(); return; }
      try {
        if (speaking) {
          web?.pause(); native?.pause();
          requested = false;
          clearTimeout(watchdog);
        } else if (!requested) {
          requested = true;
          if (!web && !native) {
            if (Platform.OS === "web") {
              // Expo's web play() discards the browser's rejection Promise.
              // Use the same bundled asset with an observable browser play().
              web = new Audio(Asset.fromModule(SOURCE).uri);
              web.loop = true; web.volume = 0.12;
              web.onplaying = armDeadline;
              web.onerror = fail;
            } else {
              native = createAudioPlayer(SOURCE, { updateInterval: 250 });
              native.loop = true; native.volume = 0.12;
              subscription = native.addListener("playbackStatusUpdate", status => {
                if (disposed) return;
                if (status.error) fail();
                else if (status.playing && !status.isBuffering) armDeadline();
              });
            }
          }
          watchdog = setTimeout(fail, 8000);
          if (web) void web.play().catch(() => { if (!disposed) fail(); });
          else native?.play();
        }
      } catch { fail(); }
      if (!disposed) poll = setTimeout(() => { void check(); }, 150);
    };
    void check();
    return release;
  }, [eligible, openingId, userKey]);

  const toggle = () => {
    ++revision.current;
    const next = failed || !enabled;
    setFailed(false);
    setLoadedKey(key);
    setEnabled(next);
    void AsyncStorage.setItem(key, next ? "on" : "off").catch(() => {
      console.warn("[rain-ambience] Ses tercihi kaydedilemedi.");
    });
  };
  return { enabled: loadedKey === key && enabled, toggle, failed };
}
