import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

// Singleton client — created once, reused across requests
let _ai: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY secret is not configured.");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

const SYSTEM_INSTRUCTION =
  "Sen AkılCEP'sin. Türkçe konuşan, zeki, kısa ve samimi bir yapay zeka asistanısın. " +
  "Her zaman Türkçe cevap ver. Gereksiz uzatma; net ve faydalı ol.";

router.post("/chat", async (req, res) => {
  const { message, history } = req.body as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) {
    res.status(400).json({ ok: false, error: "Mesaj boş olamaz." });
    return;
  }

  try {
    const ai = getClient();

    // Build contents: previous conversation + current user turn
    const contents = [
      ...(history ?? []).map((m) => ({
        role: m.role === "assistant" ? "model" : ("user" as const),
        parts: [{ text: m.content }],
      })),
      { role: "user" as const, parts: [{ text: message.trim() }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens:   8192,
      },
    });

    const text = response.text ?? "";

    req.log.info({ chars: text.length }, "gemini/chat: response generated");
    res.json({ ok: true, response: text });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "gemini/chat: API call failed");
    res.status(502).json({ ok: false, error: msg });
  }
});

export default router;
