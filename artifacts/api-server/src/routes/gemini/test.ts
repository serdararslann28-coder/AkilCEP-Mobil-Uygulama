import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

router.get("/test", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    req.log.error("GEMINI_API_KEY environment variable is not set");
    res.status(500).json({
      ok: false,
      error: "GEMINI_API_KEY secret is missing. Please add it in Replit Secrets.",
    });
    return;
  }

  try {
    req.log.info("Gemini test: initializing client...");
    const ai = new GoogleGenAI({ apiKey });

    req.log.info("Gemini test: sending 'Merhaba' to gemini-2.5-flash...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Merhaba" }] }],
    });

    const text = response.text ?? "(boş yanıt)";

    req.log.info({ geminiResponse: text }, "Gemini test: response received");
    console.log("\n=== Gemini Test Yanıtı ===\n", text, "\n=========================\n");

    res.json({ ok: true, response: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack  : undefined;

    req.log.error({ err, message, stack }, "Gemini test: API call failed");
    console.error("\n=== Gemini Hata Detayı ===\n", err, "\n==========================\n");

    res.status(502).json({
      ok: false,
      error: message,
      detail: stack ?? null,
    });
  }
});

export default router;
