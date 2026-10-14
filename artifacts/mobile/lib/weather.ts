/** Server-proxied keyless weather. No device coordinates are logged. */
import { getApiBase } from "@/context/ChatContext";
export type WeatherKind = "rain" | "snow" | "sun" | "clouds" | "storm" | "fog" | "partly-cloudy";
export type WeatherPlace = { name: string; latitude: number; longitude: number; source: "city" | "device"; resolvedAt?: number };
export type WeatherData = {
  kind: WeatherKind; temperature: number; feelsLike: number; precipitation: number;
  rain: number; snow: number; cloudCover: number; wind: number; code: number;
  isDay: boolean; time: string; fetchedAt: number; description?: string; provider?: "open-meteo";
};
export const WEATHER_TTL = 15 * 60 * 1000;
export const WEATHER_MAX_AGE = 45 * 60 * 1000;

type WeatherErrorCode = "permission" | "services" | "location" | "timeout" | "coordinates" | "response" | "http" | "network" | "provider_quota_exceeded";
export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode, message: string, public readonly status?: number, public readonly cause?: unknown) {
    super(message);
    this.name = "WeatherError";
  }
}

export function validWeatherCoordinates(place: Pick<WeatherPlace, "latitude" | "longitude">): boolean {
  return Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90 &&
    Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
}

export function weatherErrorMessage(error: unknown): string {
  switch ((error as { code?: string } | null)?.code) {
    case "permission": return "Konum izni verilmedi. Şehir arayarak devam edebilir veya telefon ayarlarından konum iznini açabilirsin.";
    case "services": return "Telefonun konum hizmetleri kapalı. Konumu açabilir veya şehir arayabilirsin.";
    case "location": return "Konumun alınamadı. Açık bir alanda yeniden dene veya şehir ara.";
    case "timeout": return "İşlem zaman aşımına uğradı. İnternet ve konum bağlantını kontrol edip yeniden dene.";
    case "coordinates": return "Konum bilgisi geçersiz. Başka bir şehir seç veya konumunu yeniden al.";
    case "response": return "Hava bilgisi okunamadı. Biraz sonra yeniden dene.";
    case "provider_quota_exceeded": return "Hava hizmeti kullanım sınırına ulaştı. Biraz sonra yeniden dene.";
    default: return "Hava bilgisi alınamadı. İnternet bağlantını kontrol edip yeniden dene.";
  }
}

export function reportWeatherError(stage: string, error: unknown): void {
  const e = error as { message?: unknown; code?: unknown; status?: unknown; cause?: { message?: unknown } } | null;
  // Never log request URLs, city queries, or precise/coarse device coordinates.
  const detail = [e?.message ?? "Unknown weather error", e?.cause?.message].filter(Boolean).join(": ")
    .replace(/https?:\/\/\S+/g, "[address]")
    .replace(/-?\d{1,3}\.\d+/g, "[coordinate]")
    .slice(0, 220);
  console.warn("[weather]", {
    stage, code: typeof e?.code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(e.code) ? e.code : "unknown",
    status: typeof e?.status === "number" && Number.isInteger(e.status) && e.status >= 100 && e.status <= 599 ? e.status : undefined, detail,
  });
}

export function weatherKind(code: number, rain: number, snow: number): WeatherKind {
  if (code >= 95 && code <= 99) return "storm";
  if (snow > 0 || [71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if (rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "partly-cloudy";
  return "clouds";
}

export function parseWeather(payload: unknown, now = Date.now()): WeatherData {
  const c = (payload as { current?: Record<string, unknown> })?.current;
  const numeric = (key: string) => {
    const value = c?.[key];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new WeatherError("response", `Invalid weather data: ${key}`);
    return value;
  };
  if (typeof c?.time !== "string") throw new WeatherError("response", "Missing weather time");
  const code = numeric("weather_code"), rain = numeric("rain") + numeric("showers"), snow = numeric("snowfall");
  if (![0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(code))
    throw new WeatherError("response", `Unsupported weather code: ${code}`);
  return {
    kind: weatherKind(code, rain, snow), temperature: numeric("temperature_2m"),
    feelsLike: numeric("apparent_temperature"), precipitation: numeric("precipitation"),
    rain, snow, cloudCover: numeric("cloud_cover"), wind: numeric("wind_speed_10m"),
    code, isDay: numeric("is_day") === 1, time: c.time, fetchedAt: now,
    ...(typeof c.description === "string" ? { description: c.description } : {}),
    ...((payload as { provider?: string }).provider === "open-meteo" ? { provider: "open-meteo" as const } : {}),
  };
}

async function jsonRequest(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const failure = await Promise.resolve().then(() => response.json()).catch(() => null) as { code?: string } | null;
      const code: WeatherErrorCode = failure?.code === "provider_quota_exceeded" ? "provider_quota_exceeded"
        : failure?.code === "provider_timeout" ? "timeout"
        : failure?.code === "provider_response_invalid" ? "response"
        : failure?.code === "provider_connection_failed" ? "network" : "http";
      throw new WeatherError(code, `Weather HTTP ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new WeatherError("timeout", "Weather request timed out");
    if (error instanceof WeatherError) throw error;
    if ((error as { name?: string })?.name === "SyntaxError")
      throw new WeatherError("response", "Weather response is not valid JSON");
    throw new WeatherError("network", "Weather network request failed", undefined, error);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function fetchWeather(place: WeatherPlace, signal?: AbortSignal): Promise<WeatherData> {
  if (!validWeatherCoordinates(place)) throw new WeatherError("coordinates", "Invalid weather coordinates");
  const params = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
  });
  const payload = await jsonRequest(`${getApiBase()}/weather/current?${params}`, signal);
  if ((payload as { provider?: string })?.provider !== "open-meteo")
    throw new WeatherError("response", "Unexpected weather provider");
  return parseWeather(payload);
}

export async function searchWeatherCities(query: string, signal?: AbortSignal): Promise<WeatherPlace[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({ query: query.trim() });
  const body = await jsonRequest(`${getApiBase()}/weather/cities?${params}`, signal) as {
    error?: boolean; results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; resolvedAt?: number }[];
  };
  if (!body || typeof body !== "object" || Array.isArray(body) || body.error || (body.results !== undefined && !Array.isArray(body.results)))
    throw new WeatherError("response", "Invalid city search response");
  const places: WeatherPlace[] = (body.results ?? []).filter(p => p && typeof p.name === "string" && p.name.trim() && validWeatherCoordinates(p)).map(p => ({
    name: [p.name, p.admin1, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", "),
    latitude: p.latitude, longitude: p.longitude, source: "city",
    ...(typeof p.resolvedAt === "number" ? { resolvedAt: p.resolvedAt } : {}),
  }));
  if (body.results?.length && !places.length)
    throw new WeatherError("response", "City results contain no valid coordinates");
  return places;
}

export function weatherDay(data: WeatherData): string {
  return data.time.slice(0, 10);
}

export function weatherGreeting(data: WeatherData): string {
  const hour = Number(data.time.slice(11, 13));
  const hello = hour >= 5 && hour < 12 ? "Günaydın." : hour >= 12 && hour < 18 ? "Merhaba." : "İyi akşamlar.";
  const messages: Record<WeatherKind, string> = {
    rain: "Dışarıda yağmur var. Çıkacaksan şemsiyeni yanına alabilirsin.",
    snow: "Dışarıda kar yağıyor. Sıcak kalmayı unutma.",
    sun: data.isDay ? "Gökyüzü açık. Yeni bir güne hoş geldin." : "Bu gece gökyüzü açık. Hoş geldin.",
    clouds: "Gökyüzü bugün bulutlu. Hoş geldin.",
    "partly-cloudy": "Gökyüzünde parçalı bulutlar var. Hoş geldin.",
    storm: "Dışarıda fırtınalı hava var. Yola çıkacaksan dikkatli ol.",
    fog: "Dışarıda sis var. Yola çıkacaksan görüş mesafesine dikkat et.",
  };
  return `${hello} ${messages[data.kind]}`;
}
