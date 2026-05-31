/**
 * POST /api/image/generate
 *
 * Provider-agnostic image generation endpoint.
 * Default provider: gpt-image-1 via Replit OpenAI integration (no API key needed).
 *
 * Provider is controlled by IMAGE_PROVIDER env var:
 *   IMAGE_PROVIDER=openai   (default) → gpt-image-1 via Replit integration
 *
 * Future providers can be added here without touching any other file:
 *   IMAGE_PROVIDER=stability → Stability AI
 *   IMAGE_PROVIDER=ideogram  → Ideogram
 *
 * Response:
 *   { imageData: string, revisedPrompt: string }
 *   imageData is a PNG data URI: "data:image/png;base64,..."
 */
import { Router, type IRouter } from "express";
import { generateImageBuffer, editImages } from "@workspace/integrations-openai-ai-server/image";
import fs   from "node:fs";
import os   from "node:os";
import path from "node:path";

const router: IRouter = Router();

// Maximum prompt length to avoid abuse
const MAX_PROMPT_LEN = 1000;

// ── Provider implementations ──────────────────────────────────────────────────

async function generateWithOpenAI(
  prompt: string,
): Promise<{ imageData: string; revisedPrompt: string }> {
  // generateImageBuffer uses gpt-image-1 — Replit integration, no key required
  const buffer = await generateImageBuffer(prompt, "1024x1024");
  return {
    imageData:     `data:image/png;base64,${buffer.toString("base64")}`,
    revisedPrompt: prompt, // gpt-image-1 does not return a revised prompt
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/generate", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt field is required" });
    return;
  }

  const cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LEN);
  const provider    = process.env["IMAGE_PROVIDER"] ?? "openai";

  try {
    let result: { imageData: string; revisedPrompt: string };

    if (provider === "openai") {
      result = await generateWithOpenAI(cleanPrompt);
    } else {
      res.status(501).json({ error: `Unknown IMAGE_PROVIDER: "${provider}"` });
      return;
    }

    res.json(result);

  } catch (err: unknown) {
    req.log?.error({ err, provider }, "image generation failed");

    const msg          = err instanceof Error ? err.message : "";
    const isRateLimit  = msg.includes("Rate limit") || msg.includes("429");

    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? "rate_limited" : "Image generation failed",
    });
  }
});

// ── Edit endpoint ─────────────────────────────────────────────────────────────
// POST /api/image/edit
// Accepts { imageBase64, prompt } — rewrites the image based on the instruction.
// Uses a temp PNG file so we can pass a file path to editImages().

router.post("/edit", async (req, res) => {
  const { imageBase64, prompt } = req.body as {
    imageBase64?: string;
    prompt?:      string;
  };

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "imageBase64 field is required" });
    return;
  }
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt field is required" });
    return;
  }

  // Strip data-URI prefix if present
  const rawBase64    = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer  = Buffer.from(rawBase64, "base64");
  const cleanPrompt  = prompt.trim().slice(0, MAX_PROMPT_LEN);

  // Write to a temp file — editImages() expects file paths
  const tmpPath = path.join(os.tmpdir(), `akilcep-edit-${Date.now()}.png`);

  try {
    fs.writeFileSync(tmpPath, imageBuffer);

    const resultBuffer = await editImages([tmpPath], cleanPrompt);
    const imageData    = `data:image/png;base64,${resultBuffer.toString("base64")}`;

    res.json({ imageData });

  } catch (err: unknown) {
    req.log?.error({ err }, "image edit failed");

    const msg         = err instanceof Error ? err.message : "";
    const isRateLimit = msg.includes("Rate limit") || msg.includes("429");

    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? "rate_limited" : "Image edit failed",
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
  }
});

export default router;
