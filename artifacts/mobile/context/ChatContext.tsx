import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  imageUri?:  string;  // local photo URI for camera-captured messages
  imageData?: string;  // generated image as base64 data URI (data:image/png;base64,...)
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  kind: "image" | "file";
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
}

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

// ── Image generation detection ────────────────────────────────────────────────
// Returns true when the user's message is asking to generate/create/draw an image.
// Two-signal heuristic: requires both a creation/delivery verb AND a visual noun.
// Visual nouns include both explicit image words ("resim", "görsel") and common
// describable subjects ("gül", "araba", "manzara") that imply a picture when
// paired with a generation verb.
function isImageRequest(text: string): boolean {
  const t = text.toLowerCase().trim();

  // Explicit text / code / reasoning intent — bail immediately
  const textKeywords = [
    "kod ", "code", "script", "program", "makale", "rapor", "özet",
    "açıkla", "anlat", "tarif et", "hesapla", "çevir",
    "nedir", "neden", "nasıl", "ne zaman", "kim", "kaç",
    "what is", "how to", "explain", "summarize",
  ];
  if (textKeywords.some((k) => t.includes(k))) return false;

  // ── Creation / delivery verbs ─────────────────────────────────────────────
  const generationVerbs = [
    // Turkish — creation
    "oluştur", "üret", "yarat", "çiz", "tasarla", "çizdir", "resmet",
    // Turkish — delivery / request (common in "X'ini ver / göster")
    "ver", "getir", "göster", "hazırla", "yap",
    // English
    "generate", "create", "draw", "design", "make", "show", "give",
  ];

  // ── Visual nouns ──────────────────────────────────────────────────────────
  const imageNouns = [
    // Explicit image words
    "resim", "görsel", "fotoğraf", "görüntü", "çizim", "illüstrasyon",
    "poster", "logo", "banner", "sanat", "tablo", "duvar kağıdı",
    "image", "picture", "photo", "illustration", "painting", "artwork", "wallpaper",
    // Scenes / settings
    "manzara", "sahne", "arka plan", "peyzaj", "ortam",
    "landscape", "background", "scene",
    // Nature
    "gül", "çiçek", "ağaç", "orman", "dağ", "deniz", "göl", "nehir",
    "şelale", "çimen", "plaj", "ada", "gökyüzü", "bulut", "gün batımı",
    "gün doğumu", "ay", "yıldız", "güneş", "kar", "yağmur",
    // Animals
    "köpek", "kedi", "kuş", "at", "aslan", "kaplan", "ayı", "fil",
    "balık", "kelebek", "ejderha", "canavar",
    // Objects / places
    "araba", "araç", "ev", "bina", "kule", "köprü", "şehir", "köy",
    "kale", "uzay", "gezegen", "robot",
    // Food / fashion
    "yemek", "pasta", "pizza", "kahve", "çay",
    "ayakkabı", "elbise", "kıyafet", "çanta",
    // People / characters
    "insan", "adam", "kadın", "çocuk", "karakter", "kahraman", "ninja",
    "astronot", "savaşçı",
  ];

  const hasVerb = generationVerbs.some((v) => t.includes(v));
  const hasNoun = imageNouns.some((n) => t.includes(n));
  return hasVerb && hasNoun;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
  /** Private conversations are never persisted and never appear in history. */
  isPrivate?: boolean;
}

export const AI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Hızlı"    },
  { id: "gemini-2.5-pro",   name: "Gemini 2.5 Pro",   badge: "En güçlü" },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Resolve API base — works both in dev (proxied) and production
function getApiBase(): string {
  return "https://6b195a2e-c87f-4826-a304-801ef9d75712-00-1rby46999ylmh.sisko.replit.dev/api";
}

interface ChatContextType {
  conversations:        Conversation[];
  currentConversation:  Conversation | null;
  isTyping:             boolean;
  /** True while Gemini Vision is processing a captured photo. */
  visionPending:        boolean;
  /** True while an AI image is being generated or edited. */
  imagePending:         boolean;
  /** Label shown in TypingIndicator while imagePending is true. */
  imagePendingLabel:    string;
  /** Edit an existing generated image with a new instruction. */
  editImage:            (sourceImageData: string, instruction: string) => void;
  selectedModel:        string;
  setSelectedModel:     (model: string) => void;
  sendMessage:          (content: string, attachments?: ChatAttachment[]) => void;
  /** Inject a real voice exchange (user + AI) directly — no API call. */
  injectMessages:       (userText: string, aiText: string) => void;
  /** Inject user photo message and call Gemini Vision in background.
   *  Pass `question` to override the default analysis prompt (e.g. spoken voice question). */
  startVisionAnalysis:  (imageBase64: string, imageUri: string, question?: string) => void;
  startNewConversation:    () => void;
  startSecretConversation: () => void;
  loadConversation:        (id: string) => void;
  deleteConversation:      (id: string) => void;
  deleteAllConversations:  () => void;
  currentMessages:      Message[];
}

const ChatContext = createContext<ChatContextType | null>(null);

const STORAGE_KEY = "@akilcep_conversations";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations,       setConversations]       = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isTyping,            setIsTyping]            = useState(false);
  const [visionPending,       setVisionPending]       = useState(false);
  const [imagePending,        setImagePending]        = useState(false);
  const [imagePendingLabel,   setImagePendingLabel]   = useState("Görsel oluşturuluyor…");
  const [selectedModel,       setSelectedModel]       = useState("gemini-2.5-flash");

  // Abort controller for in-flight Gemini requests
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void loadConversations();
  }, []);

  // Cleanup on unmount — cancel any pending request
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loadConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Conversation[];
        setConversations(parsed);
      }
    } catch {}
  };

  const saveConversations = async (convs: Conversation[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
    } catch {}
  };

  const startNewConversation = useCallback(() => {
    // Cancel any in-flight request when starting fresh
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);

    const newConv: Conversation = {
      id:        generateId(),
      title:     "Yeni Sohbet",
      messages:  [],
      createdAt: Date.now(),
      model:     selectedModel,
    };
    setCurrentConversation(newConv);
  }, [selectedModel]);

  // Private conversation — never saved to storage, never appears in history
  const startSecretConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);

    const secretConv: Conversation = {
      id:        generateId(),
      title:     "Gizli Sohbet",
      messages:  [],
      createdAt: Date.now(),
      model:     selectedModel,
      isPrivate: true,
    };
    setCurrentConversation(secretConv);
    // Intentionally NOT added to conversations list or persisted
  }, [selectedModel]);

  const loadConversation = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (conv) setCurrentConversation(conv);
    },
    [conversations]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((current) => {
        const updated = current.filter((conversation) => conversation.id !== id);
        void saveConversations(updated);
        return updated;
      });
      setCurrentConversation((current) => {
        if (current?.id !== id) return current;
        abortRef.current?.abort();
        abortRef.current = null;
        setIsTyping(false);
        return null;
      });
    },
    []
  );

  const deleteAllConversations = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);
    setVisionPending(false);
    setImagePending(false);
    setCurrentConversation(null);
    setConversations([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const persistConversation = useCallback(
    (finalConv: Conversation) => {
      setCurrentConversation(finalConv);
      // Private conversations are never stored or listed in history
      if (finalConv.isPrivate) return;
      setConversations((prev) => {
        const exists  = prev.find((c) => c.id === finalConv.id);
        const updated = exists
          ? prev.map((c) => (c.id === finalConv.id ? finalConv : c))
          : [finalConv, ...prev];
        void saveConversations(updated);
        return updated;
      });
    },
    []
  );

  const sendMessage = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      if (!content.trim() && attachments.length === 0) return;

      // Cancel previous in-flight request
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const userMsg: Message = {
        id:        generateId(),
        role:      "user",
        content:   content.trim(),
        timestamp: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      };

      // Build or continue conversation
      let conv = currentConversation;
      if (!conv) {
        conv = {
          id:        generateId(),
          title:     content.trim().slice(0, 40) + (content.trim().length > 40 ? "…" : ""),
          messages:  [],
          createdAt: Date.now(),
          model:     selectedModel,
        };
      }

      // Previous messages become the history sent to Gemini
      const historyForApi = conv.messages.map((m) => ({
        role:    m.role,
        content: m.content,
      }));

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, userMsg],
        // Auto-title from first message
        title:
          conv.messages.length === 0
            ? content.trim().slice(0, 40) + (content.trim().length > 40 ? "…" : "")
            : conv.title,
      };

      setCurrentConversation(updatedConv);
      setIsTyping(true);

      void (async () => {
        try {
          // ── Image generation fast-path ────────────────────────────────────────
          if (attachments.length === 0 && isImageRequest(content.trim())) {
            setImagePendingLabel("Görsel oluşturuluyor…");
            setImagePending(true);
            let aiMsg: Message;

            try {
              const imgRes = await fetch(`${getApiBase()}/image/generate`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                signal:  abort.signal,
                body:    JSON.stringify({ prompt: content.trim() }),
              });

              if (abort.signal.aborted) return;

              if (imgRes.status === 429) {
                aiMsg = {
                  id:        generateId(),
                  role:      "assistant",
                  content:   "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.",
                  timestamp: Date.now(),
                };
              } else if (!imgRes.ok) {
                aiMsg = {
                  id:        generateId(),
                  role:      "assistant",
                  content:   "Görsel oluşturulamadı. Lütfen tekrar deneyin.",
                  timestamp: Date.now(),
                };
              } else {
                const d = await imgRes.json() as {
                  imageData?:     string;
                  revisedPrompt?: string;
                  error?:         string;
                };

                if (d.imageData) {
                  aiMsg = {
                    id:           generateId(),
                    role:         "assistant",
                    content:      d.revisedPrompt ?? "Görsel oluşturuldu.",
                    timestamp:    Date.now(),
                    imageData:    d.imageData,
                  };
                } else {
                  aiMsg = {
                    id:        generateId(),
                    role:      "assistant",
                    content:   d.error === "rate_limited"
                      ? "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
                      : (d.error ?? "Görsel oluşturulamadı."),
                    timestamp: Date.now(),
                  };
                }
              }
            } catch (imgErr: unknown) {
              if ((imgErr as { name?: string })?.name === "AbortError") return;
              aiMsg = {
                id:        generateId(),
                role:      "assistant",
                content:   "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
                timestamp: Date.now(),
              };
            }

            if (abort.signal.aborted) return;

            const imgFinalConv: Conversation = {
              ...updatedConv,
              messages: [...updatedConv.messages, aiMsg],
            };
            setIsTyping(false);
            setImagePending(false);
            persistConversation(imgFinalConv);
            if (abortRef.current === abort) abortRef.current = null;
            return; // Skip regular Gemini chat flow
          }

          // ── Regular Gemini chat ───────────────────────────────────────────────
          const messageForApi = content.trim() || "Ekli içerikleri analiz et.";
          if (attachments.length > MAX_ATTACHMENT_COUNT) {
            throw new Error("attachment_count");
          }
          const inlineAttachments = (
            await Promise.all(
              attachments.map(async (attachment) => {
                try {
                  const mimeType = attachment.mimeType || (attachment.kind === "image" ? "image/jpeg" : "");
                  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
                    throw new Error("attachment_type");
                  }
                  if (OFFICE_ATTACHMENT_MIME_TYPES.has(mimeType)) {
                    return {
                      data: "",
                      mimeType,
                      name: attachment.name,
                      decodedBytes: 0,
                      metadataOnly: true,
                    };
                  }
                  const data = await FileSystem.readAsStringAsync(attachment.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                  const decodedBytes = Math.floor((data.length * 3) / 4);
                  if (decodedBytes > MAX_ATTACHMENT_BYTES) {
                    throw new Error("attachment_size");
                  }
                  return {
                    data,
                    mimeType,
                    name: attachment.name,
                    decodedBytes,
                  };
                } catch (error) {
                  console.warn("[chat] attachment read failed:", attachment.name ?? attachment.uri, error);
                  throw error;
                }
              }),
            )
          );
          const totalAttachmentBytes = inlineAttachments.reduce(
            (sum, attachment) => sum + attachment.decodedBytes,
            0,
          );
          if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
            throw new Error("attachment_total_size");
          }

          const res = await fetch(`${getApiBase()}/gemini/chat`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            signal:  abort.signal,
            body:    JSON.stringify({
              message: messageForApi,
              history: historyForApi,
              attachments: inlineAttachments.map(({ data, mimeType, name, metadataOnly }) => ({
                data,
                mimeType,
                name,
                metadataOnly,
              })),
            }),
          });

          if (abort.signal.aborted) return;

          let aiText: string;

          if (res.status === 429) {
            // Rate-limit: technical details stay in server logs
            aiText = "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.";
          } else if (!res.ok) {
            aiText = "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.";
          } else {
            const data = await res.json() as { ok: boolean; response?: string; error?: string };
            aiText =
              data.ok && data.response
                ? data.response
                : data.error === "rate_limited"
                  ? "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
                  : (data.error ?? "Beklenmedik bir hata oluştu.");
          }

          if (abort.signal.aborted) return;

          const aiMsg: Message = {
            id:        generateId(),
            role:      "assistant",
            content:   aiText,
            timestamp: Date.now(),
          };

          const finalConv: Conversation = {
            ...updatedConv,
            messages: [...updatedConv.messages, aiMsg],
          };

          setIsTyping(false);
          persistConversation(finalConv);

        } catch (err: unknown) {
          if ((err as { name?: string })?.name === "AbortError") return;

          if (abort.signal.aborted) return;

          const aiMsg: Message = {
            id:        generateId(),
            role:      "assistant",
            content:   err instanceof Error && err.message.startsWith("attachment_")
              ? "Eklerden biri okunamadı, desteklenmiyor veya boyut sınırını aşıyor. Eki kaldırıp tekrar deneyin."
              : "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
            timestamp: Date.now(),
          };

          const finalConv: Conversation = {
            ...updatedConv,
            messages: [...updatedConv.messages, aiMsg],
          };

          setIsTyping(false);
          persistConversation(finalConv);
        } finally {
          if (abortRef.current === abort) abortRef.current = null;
        }
      })();
    },
    [currentConversation, selectedModel, persistConversation]
  );

  /**
   * Capture a photo → inject user message with imageUri → call Gemini Vision
   * in the background → inject AI analysis when done.
   * Navigate to chat before calling this — loading indicator appears there.
   */
  const startVisionAnalysis = useCallback(
    (imageBase64: string, imageUri: string, question?: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const now = Date.now();
      const userMsg: Message = {
        id:        generateId(),
        role:      "user",
        content:   "Bu fotoğrafı analiz et.",
        timestamp: now,
        imageUri,
      };

      let conv = currentConversation;
      if (!conv) {
        conv = {
          id:        generateId(),
          title:     "Fotoğraf Analizi",
          messages:  [],
          createdAt: now,
          model:     selectedModel,
        };
      }

      const withUser: Conversation = {
        ...conv,
        title:    conv.messages.length === 0 ? "Fotoğraf Analizi" : conv.title,
        messages: [...conv.messages, userMsg],
      };

      setCurrentConversation(withUser);
      setIsTyping(true);
      setVisionPending(true);

      void (async () => {
        try {
          const res = await fetch(`${getApiBase()}/gemini/vision`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            signal:  abort.signal,
            body:    JSON.stringify({
              image:    imageBase64,
              mimeType: "image/jpeg",
              // When a spoken question is provided, override the default analysis prompt
              ...(question ? { prompt: question } : {}),
            }),
          });

          if (abort.signal.aborted) return;

          let aiText: string;

          if (res.status === 429) {
            // Rate-limit: server already retried 3×; technical details stay in logs
            aiText = "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.";
          } else {
            const ct = res.headers.get("content-type") ?? "";
            if (!ct.includes("application/json")) {
              aiText = res.status === 413
                ? "Fotoğraf çok büyük. Daha düşük kalitede tekrar deneyin."
                : `Sunucu hatası (${res.status}). Lütfen tekrar deneyin.`;
            } else {
              const data = await res.json() as { ok: boolean; analysis?: string; error?: string };
              aiText = data.ok && data.analysis
                ? data.analysis
                : data.error === "rate_limited"
                  ? "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
                  : (data.error ?? "Analiz tamamlanamadı. Tekrar deneyin.");
            }
          }

          if (abort.signal.aborted) return;

          const aiMsg: Message = {
            id:        generateId(),
            role:      "assistant",
            content:   aiText,
            timestamp: Date.now(),
          };

          setIsTyping(false);
          setVisionPending(false);
          persistConversation({
            ...withUser,
            messages: [...withUser.messages, aiMsg],
          });

        } catch (err: unknown) {
          if ((err as { name?: string })?.name === "AbortError") return;
          if (abort.signal.aborted) return;

          const aiMsg: Message = {
            id:        generateId(),
            role:      "assistant",
            content:   "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
            timestamp: Date.now(),
          };
          setIsTyping(false);
          setVisionPending(false);
          persistConversation({
            ...withUser,
            messages: [...withUser.messages, aiMsg],
          });
        } finally {
          if (abortRef.current === abort) abortRef.current = null;
        }
      })();
    },
    [currentConversation, selectedModel, persistConversation]
  );

  /**
   * Inject a voice exchange (Whisper user text + GPT reply) directly into
   * the current conversation — bypasses Gemini, no typing delay.
   */
  const injectMessages = useCallback(
    (userText: string, aiText: string) => {
      if (!userText.trim() && !aiText.trim()) return;

      // Cancel any in-flight text request
      abortRef.current?.abort();
      abortRef.current = null;
      setIsTyping(false);

      const now = Date.now();
      const userMsg: Message = {
        id:        generateId(),
        role:      "user",
        content:   userText.trim(),
        timestamp: now,
      };
      const aiMsg: Message = {
        id:        generateId(),
        role:      "assistant",
        content:   aiText.trim(),
        timestamp: now + 1,
      };

      setCurrentConversation((prev) => {
        const base: Conversation = prev ?? {
          id:        generateId(),
          title:     userText.trim().slice(0, 40) + (userText.trim().length > 40 ? "…" : ""),
          messages:  [],
          createdAt: now,
          model:     "gemini-2.5-flash",
        };

        const updated: Conversation = {
          ...base,
          title:    base.messages.length === 0 ? userMsg.content.slice(0, 40) : base.title,
          messages: [...base.messages, userMsg, aiMsg],
        };

        setConversations((convs) => {
          const exists  = convs.find((c) => c.id === updated.id);
          const next    = exists
            ? convs.map((c) => (c.id === updated.id ? updated : c))
            : [updated, ...convs];
          void saveConversations(next);
          return next;
        });

        return updated;
      });
    },
    []
  );

  /**
   * Edit an existing generated image.
   * Adds user instruction message + calls /api/image/edit → injects edited image as AI message.
   */
  const editImage = useCallback(
    (sourceImageData: string, instruction: string) => {
      if (!instruction.trim()) return;

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const userMsg: Message = {
        id:        generateId(),
        role:      "user",
        content:   `Görseli düzenle: ${instruction.trim()}`,
        timestamp: Date.now(),
      };

      let conv = currentConversation;
      if (!conv) {
        conv = {
          id:        generateId(),
          title:     "Görsel Düzenleme",
          messages:  [],
          createdAt: Date.now(),
          model:     selectedModel,
        };
      }

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, userMsg],
      };

      setCurrentConversation(updatedConv);
      setImagePendingLabel("Görsel düzenleniyor…");
      setImagePending(true);
      setIsTyping(true);

      // Strip data-URI prefix — only raw base64 goes over the wire
      const rawBase64 = sourceImageData.replace(/^data:image\/\w+;base64,/, "");

      void (async () => {
        let aiMsg: Message;

        try {
          const res = await fetch(`${getApiBase()}/image/edit`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            signal:  abort.signal,
            body:    JSON.stringify({ imageBase64: rawBase64, prompt: instruction.trim() }),
          });

          if (abort.signal.aborted) return;

          if (res.status === 429) {
            aiMsg = {
              id:        generateId(),
              role:      "assistant",
              content:   "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.",
              timestamp: Date.now(),
            };
          } else if (!res.ok) {
            aiMsg = {
              id:        generateId(),
              role:      "assistant",
              content:   "Görsel düzenlenemedi. Lütfen tekrar deneyin.",
              timestamp: Date.now(),
            };
          } else {
            const d = await res.json() as { imageData?: string; error?: string };

            if (d.imageData) {
              aiMsg = {
                id:        generateId(),
                role:      "assistant",
                content:   instruction.trim(),
                timestamp: Date.now(),
                imageData: d.imageData,
              };
            } else {
              aiMsg = {
                id:        generateId(),
                role:      "assistant",
                content:   d.error === "rate_limited"
                  ? "AkılCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
                  : "Görsel düzenlenemedi. Lütfen tekrar deneyin.",
                timestamp: Date.now(),
              };
            }
          }
        } catch (err: unknown) {
          if ((err as { name?: string })?.name === "AbortError") return;

          aiMsg = {
            id:        generateId(),
            role:      "assistant",
            content:   "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
            timestamp: Date.now(),
          };
        }

        if (abort.signal.aborted) return;

        setIsTyping(false);
        setImagePending(false);
        persistConversation({
          ...updatedConv,
          messages: [...updatedConv.messages, aiMsg!],
        });

        if (abortRef.current === abort) abortRef.current = null;
      })();
    },
    [currentConversation, selectedModel, persistConversation]
  );

  const currentMessages = currentConversation
    ? [...currentConversation.messages].reverse()
    : [];

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        isTyping,
        visionPending,
        imagePending,
        imagePendingLabel,
        editImage,
        selectedModel,
        setSelectedModel,
        sendMessage,
        injectMessages,
        startVisionAnalysis,
        startNewConversation,
        startSecretConversation,
        loadConversation,
        deleteConversation,
        deleteAllConversations,
        currentMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
