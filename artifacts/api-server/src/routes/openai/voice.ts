/**
 * POST /openai/conversations/:id/voice-messages
 * Accepts base64 audio, transcribes with gpt-4o-mini-transcribe,
 * generates a short Turkish reply with gpt-4o-mini.
 * Returns plain JSON — TTS is handled on-device via expo-speech.
 */
import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/conversations/:id/voice-messages", async (req, res) => {
  const { audio } = req.body as { audio?: string };
  if (!audio) {
    res.status(400).json({ error: "audio field required (base64)" });
    return;
  }

  try {
    // 1. Transcribe audio → text
    const audioBuffer = Buffer.from(audio, "base64");
    const file = new File([audioBuffer], "voice.m4a", { type: "audio/m4a" });

    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
      response_format: "json",
    });
    const userText = transcription.text?.trim() ?? "";

    if (!userText) {
      res.json({ userText: "", assistantText: "" });
      return;
    }

    // 2. Generate short AI reply (voice-friendly, natural Turkish)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 256,
      messages: [
        {
          role: "system",
          content:
            "Sen AkılCEP — premium Türkçe yapay zeka asistanısın. " +
            "Yanıtların kısa (1-3 cümle), doğal, sıcak ve sesli konuşmaya uygun olmalı. " +
            "Madde işareti, liste veya özel karakter kullanma.",
        },
        { role: "user", content: userText },
      ],
    });
    const assistantText = completion.choices[0]?.message?.content?.trim() ?? "";

    res.json({ userText, assistantText });
  } catch (err) {
    req.log?.error({ err }, "voice-messages error");
    res.status(500).json({ error: "Voice processing failed" });
  }
});

export default router;
