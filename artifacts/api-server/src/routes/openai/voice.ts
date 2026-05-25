/**
 * POST /openai/conversations/:id/voice-messages
 * Accepts base64 audio, transcribes with gpt-4o-mini-transcribe,
 * generates reply with gpt-5.4, synthesises with OpenAI TTS,
 * streams transcript + base64 audio chunks back via SSE.
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

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
    send({ type: "user_transcript", data: userText });

    if (!userText) {
      send({ done: true });
      res.end();
      return;
    }

    // 2. Generate AI text reply
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "Sen AkılCEP — premium Türkçe yapay zeka asistanısın. " +
            "Yanıtların kısa, doğal, sıcak ve akıcı olmalı. " +
            "Sesli konuşma için tasarlandığın için cümleler net ve akıcı olsun.",
        },
        { role: "user", content: userText },
      ],
    });
    const assistantText = completion.choices[0]?.message?.content?.trim() ?? "";
    send({ type: "transcript", data: assistantText });

    // 3. Synthesise speech with alloy voice (calm, natural)
    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: assistantText,
      response_format: "mp3",
      speed: 0.92,
    });

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioB64 = Buffer.from(audioArrayBuffer).toString("base64");
    send({ type: "audio", data: audioB64, format: "mp3" });

    send({ done: true });
    res.end();
  } catch (err) {
    req.log?.error({ err }, "voice-messages error");
    send({ error: "Voice processing failed" });
    res.end();
  }
});

export default router;
