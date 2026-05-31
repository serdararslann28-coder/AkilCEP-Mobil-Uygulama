import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { isRateLimited, withGeminiRetry } from "../../lib/geminiRetry.js";

const router: IRouter = Router();

let _ai: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY secret is not configured.");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

const DEFAULT_PROMPT =
  "Bu fotoğrafı detaylı biçimde Türkçe analiz et. " +
  "Neler görüyorsun? Önemli detayları, nesneleri, renkleri ve bağlamı açıkla. " +
  "Varsa dikkat çekici veya ilginç unsurların altını çiz.";

router.post("/vision", async (req, res) => {
  const { image, mimeType, prompt } = req.body as {
    image?:    string;
    mimeType?: string;
    prompt?:   string;
  };

  if (!image) {
    res.status(400).json({ ok: false, error: "Görüntü verisi eksik." });
    return;
  }

  // Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,...")
  const base64 = image.includes(",") ? image.split(",")[1]! : image;
  const mime   = mimeType ?? "image/jpeg";

  try {
    const ai = getClient();

    const analysis = await withGeminiRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role:  "user",
              parts: [
                { inlineData: { data: base64, mimeType: mime } },
                { text: prompt ?? DEFAULT_PROMPT },
              ],
            },
          ],
          config: {
            systemInstruction:
              "Sen AkılCEP'sin. Türkçe konuşan, zeki ve yardımsever bir yapay zeka asistanısın. " +
              "Görüntüleri net, anlaşılır ve samimi bir dille analiz et.",
            maxOutputTokens: 8192,
          },
        });
        return response.text ?? "";
      },
      (attempt, delayMs) => {
        req.log.warn(
          { attempt, delayMs },
          "gemini/vision: rate limited — waiting before retry",
        );
      },
    );

    req.log.info({ mime, chars: analysis.length }, "gemini/vision: analysis complete");
    res.json({ ok: true, analysis });

  } catch (err: unknown) {
    if (isRateLimited(err)) {
      // All retries exhausted on quota error — keep technical details server-side
      req.log.error({ err }, "gemini/vision: rate limit persists after all retries");
      res.status(429).json({ ok: false, error: "rate_limited" });
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "gemini/vision: API call failed");
    res.status(502).json({ ok: false, error: msg });
  }
});

export default router;
