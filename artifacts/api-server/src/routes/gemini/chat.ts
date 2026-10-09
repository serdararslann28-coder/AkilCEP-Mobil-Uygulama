import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { isRateLimited, withGeminiRetry } from "../../lib/geminiRetry.js";

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

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 24 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const OFFICE_ATTACHMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function isValidBase64(value: string): boolean {
  return value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

router.post("/chat", async (req, res) => {
  const { message, history, attachments } = req.body as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    attachments?: { data?: string; mimeType?: string; name?: string; metadataOnly?: boolean }[];
  };

  if (!message?.trim()) {
    res.status(400).json({ ok: false, error: "Mesaj boş olamaz." });
    return;
  }

  const now = Date.now();
  if (requestBuckets.size > 1_000) {
    for (const [key, value] of requestBuckets) {
      if (value.resetAt <= now) requestBuckets.delete(key);
    }
  }
  const clientKey = req.ip || "unknown";
  const bucket = requestBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(clientKey, { count: 1, resetAt: now + 60_000 });
  } else if (bucket.count >= 12) {
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  } else {
    bucket.count += 1;
  }

  const submittedAttachments = attachments ?? [];
  if (!Array.isArray(submittedAttachments) || submittedAttachments.length > MAX_ATTACHMENT_COUNT) {
    res.status(400).json({ ok: false, error: "Geçersiz ek listesi." });
    return;
  }

  const safeAttachments: {
    data: string;
    mimeType: string;
    name?: string;
    decodedBytes: number;
    metadataOnly?: boolean;
  }[] = [];
  for (const attachment of submittedAttachments) {
    const isOfficeMetadata =
      attachment?.metadataOnly === true &&
      typeof attachment.mimeType === "string" &&
      OFFICE_ATTACHMENT_MIME_TYPES.has(attachment.mimeType) &&
      typeof attachment.name === "string";
    if (
      !attachment ||
      typeof attachment.data !== "string" ||
      typeof attachment.mimeType !== "string" ||
      !ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimeType) ||
      (!isOfficeMetadata && !isValidBase64(attachment.data))
    ) {
      res.status(400).json({ ok: false, error: "Desteklenmeyen veya geçersiz ek." });
      return;
    }
    const decodedBytes = Math.floor((attachment.data.length * 3) / 4);
    if (decodedBytes > MAX_ATTACHMENT_BYTES) {
      res.status(413).json({ ok: false, error: "Bir ek dosya boyutu sınırını aşıyor." });
      return;
    }
    safeAttachments.push({
      data: attachment.data,
      mimeType: attachment.mimeType,
      name: attachment.name,
      decodedBytes,
      metadataOnly: isOfficeMetadata,
    });
  }

  const totalAttachmentBytes = safeAttachments.reduce((sum, attachment) => sum + attachment.decodedBytes, 0);
  if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    res.status(413).json({ ok: false, error: "Eklerin toplam boyutu çok büyük." });
    return;
  }

  // Build contents: previous conversation + current user turn
  const contents = [
    ...(history ?? []).map((m) => ({
      role: m.role === "assistant" ? "model" : ("user" as const),
      parts: [{ text: m.content }],
    })),
    {
      role: "user" as const,
      parts: [
        ...safeAttachments.map((attachment) =>
          attachment.metadataOnly
            ? {
                text:
                  `[Ek dosya: ${attachment.name}. Tür: ${attachment.mimeType}. ` +
                  "Bu Office dosyasının ikili içeriği doğrudan okunamıyor.]",
              }
            : {
                inlineData: {
                  data: attachment.data.includes(",") ? attachment.data.split(",")[1]! : attachment.data,
                  mimeType: attachment.mimeType,
                },
              },
        ),
        { text: message.trim() },
      ],
    },
  ];

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY sunucuda ayarlanmamış.");

    const groqMessages = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      })),
      { role: "user", content: message.trim() }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: groqMessages,
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      req.log.error({ status: response.status, error: data.error?.message }, "groq/chat failed");
      res.status(response.status === 429 ? 429 : 502).json({
        ok: false,
        error: response.status === 429 ? "rate_limited" : "Groq API çağrısı başarısız."
      });
      return;
    }

    const text = data.choices?.[0]?.message?.content ?? "";
    req.log.info({ chars: text.length }, "groq/chat: response generated");
    res.json({ ok: true, response: text });
} catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg }, "groq/chat failed");
    res.status(502).json({ ok: false, error: "Groq sohbet isteği başarısız." });
}
});

export default router;
