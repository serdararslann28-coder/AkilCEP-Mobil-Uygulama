import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchWeather, weatherDay, weatherGreeting,
  WEATHER_TTL, WEATHER_MAX_AGE, type WeatherData, type WeatherPlace,
  WeatherError, validWeatherCoordinates, weatherErrorMessage, reportWeatherError,
} from "@/lib/weather";

// Retained for this app runtime; navigation and backgrounding cannot renew it.
// Visual allowance is independent of playback, including mute/autoplay denial.
const atmosphereBudgets = new Map<string, { openingId: number; deadline: number }>();
// Only coarse coordinates are retained/requested (~1 km); never continuous tracking.
const coarse = (n: number) => Math.round(n * 100) / 100;
async function devicePlace(request: boolean): Promise<WeatherPlace | null> {
  if (Platform.OS === "web") {
    if (!navigator.geolocation) {
      if (request) throw new WeatherError("location", "Geolocation unavailable");
      return null;
    }
    if (!request) {
      try {
        if ((await navigator.permissions.query({ name: "geolocation" })).state !== "granted") return null;
      } catch { return null; }
    }
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      p => resolve({ name: "Mevcut konum", latitude: coarse(p.coords.latitude), longitude: coarse(p.coords.longitude), source: "device" }),
      e => request ? reject(new WeatherError(e.code === 1 ? "permission" : e.code === 3 ? "timeout" : "location", `Geolocation error ${e.code}`)) : resolve(null),
      { timeout: 8000, maximumAge: WEATHER_TTL, enableHighAccuracy: false },
    ));
  }
  const permission = request ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    if (request) throw new WeatherError("permission", "Foreground location permission denied");
    return null;
  }
  if (!await Location.hasServicesEnabledAsync()) {
    if (request) throw new WeatherError("services", "Device location services disabled");
    return null;
  }
  let cached: Location.LocationObject | null = null;
  try { cached = await Location.getLastKnownPositionAsync({ maxAge: WEATHER_TTL, requiredAccuracy: 5000 }); }
  catch (error) { reportWeatherError("location-cache", error); }
  // getCurrentPositionAsync may hang when GPS is unavailable; do not block the chat.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let position: Location.LocationObject | null;
  try {
    position = cached ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 8000); }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
  if (!position && request) throw new WeatherError("timeout", "Device position timed out");
  return position ? { name: "Mevcut konum", latitude: coarse(position.coords.latitude), longitude: coarse(position.coords.longitude), source: "device" } : null;
}

export function useWeatherAtmosphere(userKey: string) {
  const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [live, setLive] = useState(false);
  const [openingId] = useState(0);
  const [atmosphereVisible, setAtmosphereVisible] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [firstDailyEntry, setFirstDailyEntry] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const focused = useRef(true);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setActive(AppState.currentState === "active");
    return () => { focused.current = false; setActive(false); };
  }, []));
  const [needsCity, setNeedsCity] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationBusy = useRef(false);
  const locationVersion = useRef(0);
  const selectionVersion = useRef(0);
  const key = `akilcep:weather:v1:${userKey}`;
  const generation = useRef(0);
  const currentPlace = useRef<WeatherPlace | null>(null);
  const currentData = useRef<WeatherData | null>(null);
  const lastAttempt = useRef(0);
  const request = useRef<AbortController | null>(null);
  const interactiveRequest = useRef<AbortController | null>(null);
  const greeted = useRef("");
  const refresh = useCallback(async (p: WeatherPlace, force = false, interactive = false): Promise<boolean> => {
    const now = Date.now();
    if (!force && now - lastAttempt.current < WEATHER_TTL) return false;
    lastAttempt.current = now;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    interactiveRequest.current = interactive ? controller : null;
    const session = generation.current;
    setLoading(true);
    if (interactive) setError(null);
    try {
      const next = await fetchWeather(p, controller.signal);
      if (controller.signal.aborted || session !== generation.current) return false;
      const day = weatherDay(next);
      const firstToday = greeted.current !== day;
      setFirstDailyEntry(firstToday);
      currentData.current = next;
      setData(next);
      setLive(true);
      // Current conditions stay in bounded memory; city preferences persist.
      if (controller.signal.aborted || session !== generation.current) return false;
      if (firstToday) {
        greeted.current = day;
        // Mark before rendering: reopening/rerendering cannot replay this greeting.
        await AsyncStorage.setItem(`${key}:day`, day).catch(() => {});
        if (controller.signal.aborted || session !== generation.current) return false;
        setGreeting(weatherGreeting(next));
        setFirstDailyEntry(true);
      }
      return true;
    } catch (cause) {
      if (!controller.signal.aborted && session === generation.current) {
        setLive(false);
        reportWeatherError("forecast", cause);
        if (interactive) setError(weatherErrorMessage(cause));
      }
      // Quiet, bounded stale-while-revalidate. A weather outage never breaks chat.
      if (!controller.signal.aborted && session === generation.current &&
          (!currentData.current || now - currentData.current.fetchedAt >= WEATHER_MAX_AGE)) setData(null);
      return false;
    } finally {
      if (request.current === controller) {
        request.current = null;
        interactiveRequest.current = null;
        if (session === generation.current) setLoading(false);
      }
    }
  }, [key]);

  const selectPlace = useCallback(async (p: WeatherPlace) => {
    const session = generation.current;
    if (!validWeatherCoordinates(p)) {
      const cause = new WeatherError("coordinates", "Invalid selected coordinates");
      reportWeatherError("place-selection", cause);
      setError(weatherErrorMessage(cause)); setNeedsCity(true);
      return false;
    }
    const selected = ++selectionVersion.current;
    currentPlace.current = p;
    currentData.current = null;
    setLive(false);
    setData(null);
    setPlace(p); setGreeting(null); setError(null);
    const ok = await refresh(p, true, true);
    if (session !== generation.current || selected !== selectionVersion.current) return false;
    if (!ok) { setNeedsCity(true); return false; }
    await AsyncStorage.setItem(`${key}:place`, JSON.stringify(p)).catch(() => {});
    if (session !== generation.current || selected !== selectionVersion.current) return false;
    setNeedsCity(false);
    return true;
  }, [key, refresh]);

  const useDeviceLocation = useCallback(async () => {
    if (locationBusy.current) return;
    const session = generation.current;
    const attempt = ++locationVersion.current;
    locationBusy.current = true;
    setLocating(true); setError(null);
    try {
      const p = await devicePlace(true);
      if (session !== generation.current || attempt !== locationVersion.current) return;
      if (!p) throw new WeatherError("location", "Device position unavailable");
      await selectPlace(p);
    } catch (cause) {
      if (session === generation.current && attempt === locationVersion.current) {
        reportWeatherError("device-location", cause);
        setError(weatherErrorMessage(cause instanceof WeatherError ? cause : new WeatherError("location", "Location unavailable")));
        setNeedsCity(true);
      }
    } finally {
      if (session === generation.current && attempt === locationVersion.current) { locationBusy.current = false; setLocating(false); }
    }
  }, [selectPlace]);

  useEffect(() => {
    const session = ++generation.current;
    currentPlace.current = null; currentData.current = null;
    lastAttempt.current = 0; greeted.current = "";
    locationBusy.current = false; setError(null); setLoading(false);
    setData(null); setLive(false); setPlace(null); setGreeting(null); setFirstDailyEntry(false); setNeedsCity(false); setLocating(false);
    void (async () => {
      const initialSelection = selectionVersion.current;
      const [saved, day] = await Promise.all([
        AsyncStorage.getItem(`${key}:place`), AsyncStorage.getItem(`${key}:day`),
      ]).catch(() => [null, null]);
      // Discard legacy-provider cached forecasts, not the user's saved city.
      void AsyncStorage.removeItem(`${key}:cache`).catch(() => {});
      if (generation.current !== session || selectionVersion.current !== initialSelection || currentPlace.current) return;
      greeted.current = day ?? "";
      let chosen: WeatherPlace | null = null;
      try {
        const p = saved ? JSON.parse(saved) as WeatherPlace : null;
        // Preserve the user's selected city across provider changes.
        if (p && validWeatherCoordinates(p) && p.source === "city") chosen = p;
      } catch { /* corrupted cache is ignored */ }
      if (!chosen) { try { chosen = await devicePlace(false); } catch (cause) { reportWeatherError("initial-location", cause); } }
      if (generation.current !== session || selectionVersion.current !== initialSelection || currentPlace.current) return;
      if (!chosen) { setNeedsCity(true); return; }
      currentPlace.current = chosen; setPlace(chosen);
      if (AppState.currentState === "active" && focused.current) void refresh(chosen, true);
    })();
    return () => { generation.current++; request.current?.abort(); };
  }, [key, refresh]);

  useEffect(() => {
    const tick = (force = false) => {
      if (currentData.current && Date.now() - currentData.current.fetchedAt >= WEATHER_MAX_AGE) setData(null);
      // A foreground refresh must not replace an unfinished user selection.
      if (request.current && !request.current.signal.aborted) return;
      if (focused.current && currentPlace.current) void refresh(currentPlace.current, force);
    };
    let backgrounded = AppState.currentState === "background";
    const sub = AppState.addEventListener("change", state => {
      setActive(state === "active" && focused.current);
      if (state === "background") backgrounded = true;
      if (state === "active" && backgrounded) {
        backgrounded = false;
        setLive(false);
        tick(true);
      } else if (state !== "active") {
        if (state === "background") setLive(false);
        // Permission/system dialogs can briefly mark the app inactive. Preserve
        // bounded manual requests; only stop background-only refresh work.
        if (state === "background" && request.current && request.current !== interactiveRequest.current) {
          request.current.abort(); lastAttempt.current = 0;
        }
      } else tick();
    });
    const timer = setInterval(() => { if (AppState.currentState === "active" && focused.current) tick(); }, 60_000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!greeting) return;
    const timer = setTimeout(() => { setGreeting(null); setFirstDailyEntry(false); }, 12_000);
    return () => clearTimeout(timer);
  }, [greeting]);

  const hasWeather = data !== null;
  useEffect(() => {
    if (!hasWeather || !live || !active) {
      setAtmosphereVisible(false);
      return;
    }
    let budget = atmosphereBudgets.get(key);
    if (!budget || budget.openingId !== openingId) {
      budget = { openingId, deadline: Date.now() + 30_000 };
      atmosphereBudgets.set(key, budget);
    }
    const remaining = budget.deadline - Date.now();
    if (remaining <= 0) { setAtmosphereVisible(false); return; }
    setAtmosphereVisible(true);
    const timer = setTimeout(() => setAtmosphereVisible(false), remaining);
    return () => clearTimeout(timer);
  }, [key, openingId, hasWeather, live, active]);

  return {
    place, data, live, openingId,
    atmosphereData: atmosphereVisible && live ? data : null,
    greeting, firstDailyEntry, active, needsCity, locating, loading, error,
    selectPlace, useDeviceLocation,
    dismissGreeting: () => setGreeting(null),
    dismissCity: () => {
      selectionVersion.current++; locationVersion.current++;
      request.current?.abort();
      locationBusy.current = false;
      setLoading(false); setLocating(false); setError(null); setNeedsCity(false);
    },
    openCity: () => setNeedsCity(true),
    clearError: () => setError(null),
  };
}
