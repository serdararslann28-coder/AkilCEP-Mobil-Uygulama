/** Keyless server-side weather/geocoding. Never log queries or coordinates.
 * Data: https://open-meteo.com/ (CC BY 4.0); geocoding: GeoNames.
 * Public hosted API is free for non-commercial use, within published limits.
 */
export class WeatherProviderError extends Error {
  constructor(public code: string, public status: number, public upstreamStatus?: number) {
    super(code);
  }
}

const descriptions: Record<number, string> = {
  0: "Açık", 1: "Az bulutlu", 2: "Parçalı bulutlu", 3: "Bulutlu",
  45: "Sisli", 48: "Buz sisli", 51: "Hafif çisenti", 53: "Çisenti",
  55: "Yoğun çisenti", 56: "Dondurucu çisenti", 57: "Yoğun dondurucu çisenti",
  61: "Hafif yağmurlu", 63: "Yağmurlu", 65: "Yoğun yağmurlu",
  66: "Dondurucu yağmur", 67: "Yoğun dondurucu yağmur",
  71: "Hafif kar yağışlı", 73: "Kar yağışlı", 75: "Yoğun kar yağışlı", 77: "Kar taneleri",
  80: "Hafif sağanak", 81: "Sağanak", 82: "Yoğun sağanak",
  85: "Hafif kar sağanağı", 86: "Yoğun kar sağanağı",
  95: "Gök gürültülü", 96: "Dolulu fırtına", 99: "Şiddetli dolulu fırtına",
};
const fields = [
  "temperature_2m", "apparent_temperature", "is_day", "precipitation", "rain",
  "showers", "snowfall", "weather_code", "cloud_cover", "wind_speed_10m",
] as const;

export function normalizeCurrent(body: any) {
  const c = body?.current, units = body?.current_units;
  if (body?.error || !c || typeof c !== "object" || Array.isArray(c) ||
      typeof c.time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(c.time) ||
      fields.some(key => typeof c[key] !== "number" || !Number.isFinite(c[key])) ||
      !Object.hasOwn(descriptions, c.weather_code) || ![0, 1].includes(c.is_day) ||
      c.cloud_cover < 0 || c.cloud_cover > 100 ||
      ["precipitation", "rain", "showers", "snowfall", "wind_speed_10m"].some(key => c[key] < 0) ||
      units?.temperature_2m !== "°C" || units?.apparent_temperature !== "°C" ||
      units?.wind_speed_10m !== "km/h" || units?.snowfall !== "cm" ||
      ["precipitation", "rain", "showers"].some(key => units?.[key] !== "mm"))
    throw new WeatherProviderError("provider_response_invalid", 502);
  const current = Object.fromEntries(fields.map(key => [key, c[key]]));
  return {
    provider: "open-meteo" as const,
    current: { ...current, time: c.time, description: descriptions[c.weather_code] },
  };
}

export function normalizeCities(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body) || body.error ||
      (body.results === undefined && typeof body.generationtime_ms !== "number") ||
      (body.results !== undefined && !Array.isArray(body.results)))
    throw new WeatherProviderError("provider_response_invalid", 502);
  const results = (body.results ?? []).filter((p: any) =>
    p && typeof p.name === "string" && p.name.trim() &&
    typeof p.latitude === "number" && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    typeof p.longitude === "number" && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180,
  ).slice(0, 6).map((p: any) => ({
    name: [p.name, p.admin1, p.country].filter(v => typeof v === "string" && v.trim())
      .filter((v, i, a) => a.indexOf(v) === i).join(", "),
    latitude: p.latitude, longitude: p.longitude,
  }));
  if (body.results?.length && !results.length)
    throw new WeatherProviderError("provider_response_invalid", 502);
  return { results };
}

async function request(url: URL) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error" });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new WeatherProviderError(
        response.status === 429 ? "provider_quota_exceeded" : "provider_request_failed",
        response.status === 429 ? 429 : 502, response.status,
      );
    if (!body || typeof body !== "object" || (body as { error?: boolean }).error)
      throw new WeatherProviderError("provider_response_invalid", 502);
    return body;
  } catch (error) {
    if (error instanceof WeatherProviderError) throw error;
    const timeout = (error as Error)?.name === "TimeoutError";
    throw new WeatherProviderError(timeout ? "provider_timeout" : "provider_connection_failed", timeout ? 504 : 502);
  }
}

const weatherCache = new Map<string, { expires: number; value: ReturnType<typeof normalizeCurrent> }>();
const pending = new Map<string, Promise<ReturnType<typeof normalizeCurrent>>>();
export async function weatherCurrent(latitude: number, longitude: number) {
  const key = `${latitude},${longitude}`, now = Date.now();
  for (const [id, entry] of weatherCache) if (entry.expires <= now) weatherCache.delete(id);
  const cached = weatherCache.get(key);
  if (cached) return cached.value;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude), current: fields.join(","),
      timezone: "auto", temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm",
    }).toString();
    const value = normalizeCurrent(await request(url));
    if (weatherCache.size >= 500) weatherCache.delete(weatherCache.keys().next().value!);
    weatherCache.set(key, { expires: Date.now() + 15 * 60_000, value });
    setTimeout(() => {
      if (weatherCache.get(key)?.value === value) weatherCache.delete(key);
    }, 15 * 60_000).unref();
    return value;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

export async function weatherCities(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "6", language: "tr", format: "json" }).toString();
  return normalizeCities(await request(url));
}
