/**
 * POST /api/image/generate
 *
 * Provider-agnostic image generation endpoint.
 * Current provider: DALL-E 3 via OpenAI (default).
 *
 * Provider selection is controlled by the IMAGE_PROVIDER env var:
 *   IMAGE_PROVIDER=dalle   → DALL-E 3 (default, uses existing OpenAI integration)
 *
 * Future providers can be added here without touching any other file:
 *   IMAGE_PROVIDER=stability → Stability AI
 *   IMAGE_PROVIDER=ideogram  → Ideogram
 *   IMAGE_PROVIDER=gemini    → Imagen via @google/genai
 *
 * Response:
 *   { imageData: string }  — PNG as base64 data URI (data:image/png;base64,...)
 *   { error: string }      — on failure
 */
import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// Maximum prompt length to avoid abuse
const MAX_PROMPT_LENGTH = 1000;

// ── Provider implementations ──────────────────────────────────────────────────

async function generateWithDalle(prompt: string): Promise<{ imageData: string; revisedPrompt: string }> {
  const response = await openai.images.generate({
    model:           "dall-e-3",
    prompt,
    n:               1,
    size:            "1024x1024",
    quality:         "standard",
    response_format: "b64_json",   // base64 — no expiring URL dependency
  });

  const item = (response.data ?? [])[0];
  if (!item?.b64_json) {
    throw new Error("DALL-E returned no image data");
  }

  return {
    imageData:     `data:image/png;base64,${item.b64_json}`,
    revisedPrompt: item.revised_prompt ?? prompt,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/generate", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt field is required" });
    return;
  }

  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  const provider    = process.env["IMAGE_PROVIDER"] ?? "dalle";

  try {
    let result: { imageData: string; revisedPrompt: string };

    if (provider === "dalle") {
      result = await generateWithDalle(cleanPrompt);
    } else {
      res.status(501).json({ error: `Unknown IMAGE_PROVIDER: "${provider}"` });
      return;
    }

    res.json(result);

  } catch (err: unknown) {
    req.log?.error({ err, provider }, "image generation failed");

    // Surface rate-limit errors so the client can show a friendly message
    const msg = err instanceof Error ? err.message : "unknown error";
    const isRateLimit = msg.includes("Rate limit") || msg.includes("429");

    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? "rate_limited" : "Image generation failed",
    });
  }
});

export default router;
