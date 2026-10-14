import { Router, type IRouter } from "express";
import {
  GetWeatherCurrentQueryParams, GetWeatherCurrentResponse,
  GetWeatherCitiesQueryParams, GetWeatherCitiesResponse,
} from "@workspace/api-zod";
import { weatherCurrent, weatherCities, WeatherProviderError } from "../lib/weatherProvider";

const router: IRouter = Router();
const clients = new Map<string, { end: number; count: number }>();
let day = "", dailyCalls = 0;
// Bounded per-process traffic guard; also keep upstream usage within free limits.
function allowed(ip: string): boolean {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (day !== today) { day = today; dailyCalls = 0; }
  for (const [key, value] of clients) if (value.end <= now) clients.delete(key);
  if (clients.size >= 2000 && !clients.has(ip)) return false;
  let client = clients.get(ip);
  if (!client) { client = { end: now + 60_000, count: 0 }; clients.set(ip, client); }
  if (client.count >= 20 || dailyCalls >= 500) return false;
  client.count++; dailyCalls++;
  return true;
}

router.use("/weather", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!allowed(req.ip ?? "unknown")) {
    res.set("Retry-After", "60");
    res.status(429).json({ code: "provider_quota_exceeded", error: "Hava hizmeti kullanım sınırına ulaştı. Biraz sonra yeniden dene." });
    return;
  }
  next();
});

router.get("/weather/current", async (req, res): Promise<void> => {
  const parsed = GetWeatherCurrentQueryParams.safeParse(req.query);
  if (!parsed.success || [req.query.latitude, req.query.longitude].some(v => typeof v !== "string" || !v.trim())) {
    res.status(400).json({ code: "coordinates", error: "Konum bilgisi geçersiz." }); return;
  }
  try {
    res.json(GetWeatherCurrentResponse.parse(await weatherCurrent(parsed.data.latitude, parsed.data.longitude)));
  } catch (error) {
    const e = error instanceof WeatherProviderError ? error : new WeatherProviderError("provider_response_invalid", 502);
    req.log.warn({ code: e.code, upstreamStatus: e.upstreamStatus }, "Weather current request failed");
    res.status(e.status).json({ code: e.code, error: "Hava bilgisi alınamadı. Biraz sonra yeniden dene." });
  }
});
router.get("/weather/cities", async (req, res): Promise<void> => {
  const parsed = GetWeatherCitiesQueryParams.safeParse(req.query);
  if (!parsed.success || typeof req.query.query !== "string" || parsed.data.query.trim().length < 2) {
    res.status(400).json({ code: "coordinates", error: "En az iki karakterlik bir şehir adı yaz." }); return;
  }
  try {
    res.json(GetWeatherCitiesResponse.parse(await weatherCities(parsed.data.query.trim())));
  } catch (error) {
    const e = error instanceof WeatherProviderError ? error : new WeatherProviderError("provider_response_invalid", 502);
    req.log.warn({ code: e.code, upstreamStatus: e.upstreamStatus }, "Weather city request failed");
    res.status(e.status).json({ code: e.code, error: "Şehir araması tamamlanamadı. Biraz sonra yeniden dene." });
  }
});
export default router;
