import AsyncStorage from "@react-native-async-storage/async-storage";
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
  imageUri?: string;  // local photo URI for camera-captured messages
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
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
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  // Fallback for local dev without EXPO_PUBLIC_DOMAIN
  return "/api";
}

interface ChatContextType {
  conversations:        Conversation[];
  currentConversation:  Conversation | null;
  isTyping:             boolean;
  /** True while Gemini Vision is processing a captured photo. */
  visionPending:        boolean;
  selectedModel:        string;
  setSelectedModel:     (model: string) => void;
  sendMessage:          (content: string) => void;
  /** Inject a real voice exchange (user + AI) directly — no API call. */
  injectMessages:       (userText: string, aiText: string) => void;
  /** Inject user photo message and call Gemini Vision in background. */
  startVisionAnalysis:  (imageBase64: string, imageUri: string) => void;
  startNewConversation: () => void;
  loadConversation:     (id: string) => void;
  deleteConversation:   (id: string) => void;
  currentMessages:      Message[];
}

const ChatContext = createContext<ChatContextType | null>(null);

const STORAGE_KEY = "@akilcep_conversations";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations,       setConversations]       = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isTyping,            setIsTyping]            = useState(false);
  const [visionPending,       setVisionPending]       = useState(false);
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

  const loadConversation = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (conv) setCurrentConversation(conv);
    },
    [conversations]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      void saveConversations(updated);
      if (currentConversation?.id === id) setCurrentConversation(null);
    },
    [conversations, currentConversation]
  );

  const persistConversation = useCallback(
    (finalConv: Conversation) => {
      setCurrentConversation(finalConv);
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
    (content: string) => {
      if (!content.trim()) return;

      // Cancel previous in-flight request
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const userMsg: Message = {
        id:        generateId(),
        role:      "user",
        content:   content.trim(),
        timestamp: Date.now(),
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
          const res = await fetch(`${getApiBase()}/gemini/chat`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            signal:  abort.signal,
            body:    JSON.stringify({
              message: content.trim(),
              history: historyForApi,
            }),
          });

          if (abort.signal.aborted) return;

          let aiText: string;

          if (res.status === 429) {
            // Rate-limit: technical details stay in server logs
            aiText = "AKILCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.";
          } else if (!res.ok) {
            aiText = "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.";
          } else {
            const data = await res.json() as { ok: boolean; response?: string; error?: string };
            aiText =
              data.ok && data.response
                ? data.response
                : data.error === "rate_limited"
                  ? "AKILCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
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
            content:   "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
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
    (imageBase64: string, imageUri: string) => {
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
            body:    JSON.stringify({ image: imageBase64, mimeType: "image/jpeg" }),
          });

          if (abort.signal.aborted) return;

          let aiText: string;

          if (res.status === 429) {
            // Rate-limit: server already retried 3×; technical details stay in logs
            aiText = "AKILCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin.";
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
                  ? "AKILCEP şu anda yoğun. Lütfen 1 dakika sonra tekrar deneyin."
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
        selectedModel,
        setSelectedModel,
        sendMessage,
        injectMessages,
        startVisionAnalysis,
        startNewConversation,
        loadConversation,
        deleteConversation,
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
