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
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
}

export const AI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", badge: "En güçlü" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", badge: "Hızlı" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5", badge: "Ekonomik" },
  { id: "claude-3-opus", name: "Claude 3", badge: "Analitik" },
];

const AI_RESPONSES = [
  "Elbette, bu konuda size yardımcı olmaktan mutluluk duyarım. Sorunuzu daha iyi anlamak için biraz daha detay verebilir misiniz?",
  "Harika bir soru! Bu konuyu birkaç farklı perspektiften ele alabiliriz. İlk olarak temel kavramları inceleyelim.",
  "Bu ilginç bir konu. Size adım adım açıklayayım: Öncelikle temel prensipleri anlamak önemli.",
  "Tabii ki! İşte bu konuda bilmeniz gereken en önemli noktalar:\n\n1. Temel kavramları kavramak\n2. Pratik uygulamalar\n3. İleri düzey konular\n\nHerhangi bir konuyu daha detaylı açıklamamı ister misiniz?",
  "Anlıyorum. Bu durumda size en doğru yaklaşımı önermek isterim. Genellikle bu tür sorunlar birkaç farklı yöntemle çözülebilir.",
  "Mükemmel bir bakış açısı! Araştırmalar gösteriyor ki bu yaklaşım gerçekten etkili sonuçlar veriyor. Sizinle bu konuyu daha derinlemesine inceleyebiliriz.",
  "Kesinlikle! Bu konuda düşünceleriniz çok değerli. İzninizle birkaç önemli noktanın altını çizmek istiyorum.",
  "Bu soruya yanıt vermek için birkaç faktörü göz önünde bulundurmamız gerekiyor. Bağlamınıza göre size özel bir öneri sunabilirim.",
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function getAIResponse(): string {
  return AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isTyping: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  sendMessage: (content: string) => void;
  startNewConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  currentMessages: Message[];
}

const ChatContext = createContext<ChatContextType | null>(null);

const STORAGE_KEY = "@akilcep_conversations";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadConversations();
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
    const newConv: Conversation = {
      id: generateId(),
      title: "Yeni Sohbet",
      messages: [],
      createdAt: Date.now(),
      model: selectedModel,
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
      saveConversations(updated);
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }
    },
    [conversations, currentConversation]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      let conv = currentConversation;
      if (!conv) {
        conv = {
          id: generateId(),
          title:
            content.trim().slice(0, 40) +
            (content.trim().length > 40 ? "..." : ""),
          messages: [],
          createdAt: Date.now(),
          model: selectedModel,
        };
      }

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, userMsg],
        title:
          conv.messages.length === 0
            ? content.trim().slice(0, 40) +
              (content.trim().length > 40 ? "..." : "")
            : conv.title,
      };

      setCurrentConversation(updatedConv);
      setIsTyping(true);

      const delay = 800 + Math.random() * 1200;
      typingTimer.current = setTimeout(() => {
        const aiMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: getAIResponse(),
          timestamp: Date.now(),
        };

        const finalConv: Conversation = {
          ...updatedConv,
          messages: [...updatedConv.messages, aiMsg],
        };

        setCurrentConversation(finalConv);
        setIsTyping(false);

        setConversations((prev) => {
          const exists = prev.find((c) => c.id === finalConv.id);
          const updated = exists
            ? prev.map((c) => (c.id === finalConv.id ? finalConv : c))
            : [finalConv, ...prev];
          saveConversations(updated);
          return updated;
        });
      }, delay);
    },
    [currentConversation, selectedModel]
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
        selectedModel,
        setSelectedModel,
        sendMessage,
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
