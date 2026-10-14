/**
 * One voice session for the shared chat composer. Reuses the existing
 * expo-audio → voice-messages → expo-speech flow and EarthOrb's real meter.
 * STT is batch-based: only completed transcripts are exposed, never fake words.
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type AudioRecorder } from "expo-audio";
import { File } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, Platform } from "react-native";
import { getApiBase } from "@/context/ChatContext";
import { customFetch, type OpenaiVoiceMessageInput } from "@workspace/api-client-react";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";
type VoiceMode = "conversation" | "dictation";
interface Options {
  injectMessages: (userText: string, assistantText: string) => void;
  onDictation?: (text: string) => void;
  currentConversationId: string | null;
  blocked: boolean;
}
const API_BASE = getApiBase();

// Never log audio, transcripts, credentials, or full request URLs.
function errorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message : "Bilinmeyen ses hatası";
  return message
    .replace(/https?:\/\/\S+|Bearer\s+\S+|sk[-_][\w-]+/gi, "[gizlendi]")
    .slice(0, 200);
}

async function requestVoice(path: string, payload: object, signal: AbortSignal) {
  const body = await customFetch<{
    id?: number; text?: string; userText?: string; assistantText?: string; error?: string;
  }>(`${API_BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    signal, body: JSON.stringify(payload), responseType: "json",
  });
  if (!body || typeof body !== "object") throw new Error("Ses sunucusu geçerli JSON nesnesi döndürmedi.");
  if (body.error) {
    throw new Error(errorDetail(new Error(body.error)));
  }
  return body;
}

export function useVoiceSession(options: Options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("conversation");
  const modeRef = useRef<VoiceMode>("conversation");
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState<number | undefined>();
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.88);
  const settingsRef = useRef({ voiceReplyEnabled, speechRate });
  settingsRef.current = { voiceReplyEnabled, speechRate };
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderRef = useRef<AudioRecorder | null>(null);
  const processRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const operationRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");
  const enabledRef = useRef(false);
  const pausedRef = useRef(false);
  const liveRef = useRef(true);
  const focusedRef = useRef(true);
  const appActiveRef = useRef(AppState.currentState === "active");
  const startingRef = useRef(false);
  const permissionPendingRef = useRef(false);
  const cleanupRef = useRef<Promise<void>>(Promise.resolve());
  const serverConversationRef = useRef(0);
  const conversationRef = useRef(options.currentConversationId);
  const available = Platform.OS !== "web";

  const applyPhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    if (liveRef.current) setPhase(next);
  }, []);
  const isCurrent = (op: AbortController) =>
    !op.signal.aborted && operationRef.current === op && liveRef.current &&
    focusedRef.current && appActiveRef.current && enabledRef.current && !optionsRef.current.blocked;
  const showError = (message: string) => {
    // React Native Web's Alert is a no-op; keep unsupported-device feedback visible.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
      return;
    }
    Alert.alert("Sesli sohbet", message);
  };

  const endSession = useCallback((keepOpen: boolean): Promise<void> => {
    clearTimeout(resumeTimerRef.current);
    clearTimeout(speechTimerRef.current);
    resumeTimerRef.current = undefined;
    speechTimerRef.current = undefined;
    operationRef.current?.abort();
    operationRef.current = null;
    // Invalidate the operation before stopping native audio: stale network/TTS
    // callbacks must not publish a reply or schedule another listening turn.
    const keepEnabled = keepOpen && enabledRef.current;
    enabledRef.current = keepEnabled;
    pausedRef.current = keepEnabled;
    applyPhase("idle");
    if (liveRef.current) {
      setEnabled(keepEnabled);
      setPaused(keepEnabled);
      setLevel(undefined);
      if (!keepEnabled) {
        setUserText("");
        setAssistantText("");
      }
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    // Serialize cleanup so a previous stop cannot disable a newly started mic.
    const previous = cleanupRef.current;
    const stopped = (async () => {
      try { await Speech.stop(); } catch {}
      await previous;
      if (rec) { try { await rec.stop(); } catch {} }
      if (Platform.OS !== "web") {
        try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
      }
    })();
    cleanupRef.current = stopped;
    return stopped;
  }, [applyPhase]);

  const exit = useCallback(() => endSession(false), [endSession]);
  const stop = useCallback(() => endSession(true), [endSession]);

  useEffect(() => {
    liveRef.current = true;
    const subscription = AppState.addEventListener("change", state => {
      appActiveRef.current = state === "active";
      // Android's permission activity can pause ReactActivity. It is not an
      // explicit session exit; recording still waits for foreground below.
      if (state !== "active" && !permissionPendingRef.current) void exit();
    });
    return () => { liveRef.current = false; subscription.remove(); void exit(); };
  }, [exit]);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    return () => { focusedRef.current = false; void exit(); };
  }, [exit]));
  useEffect(() => {
    if (options.blocked) void exit();
  }, [options.blocked, exit]);
  useEffect(() => {
    const previous = conversationRef.current;
    conversationRef.current = options.currentConversationId;
    // Null→new ID can be our own first injected exchange, not navigation.
    if (previous !== null && previous !== options.currentConversationId) {
      serverConversationRef.current = 0;
      void exit();
    }
  }, [options.currentConversationId, exit]);

  useEffect(() => {
    if (phase !== "listening") { setLevel(undefined); return; }
    let speechSamples = 0;
    let heardSpeech = false;
    let quietSince: number | undefined;
    let missingMeterSamples = 0;
    const reportMissingMeter = (detail: string) => {
      if (modeRef.current !== "conversation" || ++missingMeterSamples < 15) return;
      console.warn("[VoiceSession]", { stage: "metering", detail });
      showError("Mikrofonun ses seviyesi alınamıyor; eller serbest konuşma tamamlanamıyor. Ses oturumu durduruldu.");
      void exit();
    };
    const timer = setInterval(() => {
      if (phaseRef.current !== "listening" || !enabledRef.current) return;
      try {
        const status = audioRecorder.getStatus();
        const metering = status.isRecording && typeof status.metering === "number"
          && Number.isFinite(status.metering) ? status.metering : undefined;
        setLevel(metering === undefined ? undefined : Math.max(0, Math.min(1, (metering + 60) / 60)));
        // Batch STT needs a completed recording. End conversation turns after
        // measured speech followed by a sustained pause, never silence alone.
        // Dictation and devices without metering retain manual completion.
        if (modeRef.current !== "conversation" || metering === undefined) {
          quietSince = undefined;
          speechSamples = 0;
          if (metering === undefined) reportMissingMeter("Recorder supplied no finite metering value.");
          return;
        }
        missingMeterSamples = 0;
        if (metering >= -42) {
          speechSamples = Math.min(3, speechSamples + 1);
          if (speechSamples >= 3) heardSpeech = true;
          quietSince = undefined;
        } else {
          speechSamples = 0;
          if (!heardSpeech) return;
          quietSince ??= Date.now();
          if (Date.now() - quietSince >= 1400) {
            // stopAndProcess synchronously leaves LISTENING, also guarding a
            // simultaneous manual stop against a second upload.
            void processRecordingRef.current?.();
          }
        }
      } catch (error) {
        quietSince = undefined;
        speechSamples = 0;
        setLevel(undefined);
        reportMissingMeter(errorDetail(error));
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, audioRecorder]);

  const waitForForeground = (operation: AbortController): Promise<boolean> => {
    if (appActiveRef.current) return Promise.resolve(true);
    return new Promise(resolve => {
      const finish = (active: boolean) => {
        clearTimeout(timer);
        subscription.remove();
        operation.signal.removeEventListener("abort", cancel);
        resolve(active);
      };
      const cancel = () => finish(false);
      const subscription = AppState.addEventListener("change", state => {
        if (state === "active") finish(true);
      });
      const timer = setTimeout(cancel, 5000);
      operation.signal.addEventListener("abort", cancel, { once: true });
      if (operation.signal.aborted) cancel();
    });
  };

  const startListening = async () => {
    if (!available || startingRef.current || phaseRef.current !== "idle"
      || optionsRef.current.blocked || !focusedRef.current || !appActiveRef.current) return;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = undefined;
    startingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    const operation = new AbortController();
    operationRef.current?.abort();
    operationRef.current = operation;
    enabledRef.current = true;
    setEnabled(true);
    setUserText("");
    setAssistantText("");
    applyPhase("idle");
    try {
      await cleanupRef.current;
      if (!isCurrent(operation)) return;
      permissionPendingRef.current = true;
      let permission;
      try { permission = await requestRecordingPermissionsAsync(); }
      finally { permissionPendingRef.current = false; }
      if (!await waitForForeground(operation)) {
        if (operationRef.current === operation) await exit();
        return;
      }
      if (!isCurrent(operation)) return;
      if (!permission.granted) {
        showError("Mikrofon izni verilmedi. Cihaz ayarlarından AkılCEP için mikrofon iznini açabilirsiniz.");
        await exit();
        return;
      }
      await Speech.stop();
      if (!isCurrent(operation)) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      if (!isCurrent(operation)) {
        try { await audioRecorder.stop(); } catch {}
        try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
        return;
      }
      audioRecorder.record();
      recorderRef.current = audioRecorder;
      applyPhase("listening");
    } catch (error) {
      if (isCurrent(operation)) {
        const detail = errorDetail(error);
        console.warn("[VoiceSession]", { stage: "microphone", detail });
        showError(`Mikrofon başlatılamadı: ${detail}`);
        await exit();
      }
    } finally { startingRef.current = false; }
  };

  startListeningRef.current = startListening;
  const resumeListening = (operation: AbortController) => {
    if (!isCurrent(operation) || modeRef.current !== "conversation") return;
    clearTimeout(resumeTimerRef.current);
    // Recorder stays stopped through TTS and the physical speaker's short tail.
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = undefined;
      if (isCurrent(operation)) void startListeningRef.current?.();
    }, 600);
  };

  const ensureConversation = async (operation: AbortController): Promise<number> => {
    if (serverConversationRef.current) return serverConversationRef.current;
    const body = await requestVoice("/openai/conversations", { title: "Sesli Sohbet" }, operation.signal);
    if (!isCurrent(operation)) throw new Error("cancelled");
    if (typeof body.id !== "number" || !Number.isInteger(body.id) || body.id <= 0) {
      throw new Error("Ses sunucusu geçerli oturum kimliği döndürmedi.");
    }
    serverConversationRef.current = body.id;
    return serverConversationRef.current;
  };

  const speakReply = (text: string, operation: AbortController) => {
    if (!isCurrent(operation)) return;
    if (!settingsRef.current.voiceReplyEnabled) {
      applyPhase("idle");
      resumeListening(operation);
      return;
    }
    let finished = false;
    const finish = (resume: boolean) => {
      if (finished || !isCurrent(operation)) return false;
      finished = true;
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = undefined;
      applyPhase("idle");
      if (resume) resumeListening(operation);
      return true;
    };
    try {
      speechTimerRef.current = setTimeout(() => {
        if (!finish(false)) return;
        showError("Sesli okuma zamanında tamamlanmadı. Ses oturumu durduruldu; yazılı yanıt korunuyor.");
        void exit();
      }, 120000);
      Speech.speak(text, {
        language: "tr-TR", rate: settingsRef.current.speechRate, pitch: 1,
        onStart: () => { if (!finished && isCurrent(operation)) applyPhase("speaking"); },
        onDone: () => { finish(true); },
        onStopped: () => {
          if (!finish(false)) return;
          showError("Sesli yanıt kesildi. Ses oturumu durduruldu; yazılı yanıt korunuyor.");
          void exit();
        },
        onError: (error) => {
          if (finish(false)) {
            const detail = errorDetail(error);
            console.warn("[VoiceSession]", { stage: "speech", detail });
            showError(`Sesli okuma kullanılamıyor: ${detail}. Yazılı yanıt sohbet geçmişinde kayıtlı.`);
            void exit();
          }
        },
      });
    } catch (error) {
      if (finish(false)) {
        const detail = errorDetail(error);
        console.warn("[VoiceSession]", { stage: "speech", detail });
        showError(`Sesli okuma başlatılamadı: ${detail}. Yanıt sohbet geçmişinde kayıtlı.`);
        void exit();
      }
    }
  };

  const stopAndProcess = async () => {
    const rec = recorderRef.current;
    const operation = operationRef.current;
    if (phaseRef.current !== "listening" || !rec || !operation || !isCurrent(operation)) return;
    recorderRef.current = null;
    applyPhase("thinking"); // Synchronous ref guard prevents a duplicate stop/send.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      await rec.stop();
      if (!isCurrent(operation)) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!rec.uri) throw new Error("Ses kaydı dosyası oluşturulmadı.");
      let audio: string;
      try { audio = await new File(rec.uri).base64(); }
      catch {
        const blob = await (await fetch(rec.uri)).blob();
        audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      if (!isCurrent(operation)) return;
      timeout = setTimeout(() => {
        timedOut = true;
        operation.abort();
        if (liveRef.current && operationRef.current === operation && enabledRef.current) {
          showError("Ses isteği zaman aşımına uğradı. Lütfen tekrar deneyin.");
          void exit();
        }
      }, 60000);
      // Batch STT exposes final text after the pause, never fabricated interim words.
      const result = await requestVoice("/openai/transcribe", { audio }, operation.signal);
      if (!isCurrent(operation)) return;
      const transcript = typeof result.text === "string" ? result.text.trim() : "";
      if (!transcript || transcript.length > 4000) {
        showError(transcript ? "Konuşma çok uzun. Daha kısa bir konuşma deneyin." : "Konuşma anlaşılamadı. Lütfen tekrar deneyin.");
        await exit();
        return;
      }
      if (modeRef.current === "dictation") {
        // Reuse the same recorder and existing STT-only route. A dictated draft
        // is not a conversation exchange and must never be injected or sent.
        clearTimeout(timeout);
        timeout = undefined;
        optionsRef.current.onDictation?.(transcript);
        await exit();
        return;
      }
      setUserText(transcript);
      optionsRef.current.injectMessages(transcript, "");
      const id = await ensureConversation(operation);
      if (!isCurrent(operation)) return;
      const voiceInput: OpenaiVoiceMessageInput = { text: transcript };
      const replyResult = await requestVoice(`/openai/conversations/${id}/voice-messages`, voiceInput, operation.signal);
      if (!isCurrent(operation)) return;
      clearTimeout(timeout);
      timeout = undefined;
      const reply = typeof replyResult.assistantText === "string" ? replyResult.assistantText.trim() : "";
      if (!reply) {
        showError("Konuşma anlaşılamadı veya yanıt alınamadı. Lütfen tekrar deneyin.");
        await exit();
        return;
      }
      setAssistantText(reply);
      // Final transcript is already sent. Never copy it into the editable draft.
      optionsRef.current.injectMessages("", reply);
      speakReply(reply, operation);
    } catch (error) {
      if (timedOut || !liveRef.current || operationRef.current !== operation || !enabledRef.current) return;
      const detail = errorDetail(error);
      console.warn("[VoiceSession]", { stage: "processing", detail });
      showError(operation.signal.aborted
        ? "Ses isteği zaman aşımına uğradı. Lütfen tekrar deneyin."
        : `Ses kaydı işlenemedi: ${detail}`);
      try { await rec.stop(); } catch {}
      await exit();
    } finally { if (timeout) clearTimeout(timeout); }
  };

  processRecordingRef.current = stopAndProcess;

  const enter = async ({ mode: nextMode = "conversation" }: { mode?: VoiceMode } = {}) => {
    if (optionsRef.current.blocked || startingRef.current) return;
    if (!available) {
      showError("Mikrofonla sesli sohbet yalnızca mobil cihazlarda çalışır. Yazılı sohbeti kullanabilirsiniz.");
      return;
    }
    if (enabledRef.current) await exit();
    modeRef.current = nextMode;
    setMode(nextMode);
    Keyboard.dismiss();
    enabledRef.current = true;
    setEnabled(true);
    await startListening();
  };
  const action = async () => {
    if (pausedRef.current && enabledRef.current) { await startListening(); return; }
    if (startingRef.current) { await exit(); return; }
    if (!enabledRef.current) { await enter(); return; }
    if (phaseRef.current === "idle") { await startListening(); return; }
    if (phaseRef.current === "listening") { await stopAndProcess(); return; }
    await exit();
  };
  return {
    enabled, paused, mode, phase, level, userText, assistantText, available,
    voiceReplyEnabled, setVoiceReplyEnabled, speechRate, setSpeechRate,
    enter, action, stop, exit,
  };
}
