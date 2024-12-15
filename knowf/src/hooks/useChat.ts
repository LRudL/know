import { ChatMessageManager, ChatMessageProps } from "@/components/ChatMessage";
import { debug } from "@/lib/debug";
import { SessionService } from "@/lib/sessionService";
import { useState, useEffect } from "react";

// hooks/useChat.ts
export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttsText, setTTSText] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  useEffect(() => {
    async function loadExistingMessages() {
      try {
        const existingMessages = await SessionService.getSessionMessages(
          sessionId
        );
        if (existingMessages.length > 0) {
          const formattedMessages = existingMessages.map((msg, index) => ({
            role: msg.content.role,
            content: msg.content.content,
            isLatest: index === existingMessages.length - 1,
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        debug.error("Error loading existing messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    loadExistingMessages();
  }, [sessionId]);

  const sendMessage = async (messageText?: string) => {
    if (!messageText?.trim()) return;

    // Add user message and initial AI message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: messageText.trim(), isLatest: false },
      { role: "assistant", content: "", isLatest: true },
    ]);

    setIsStreaming(true);

    try {
      await SessionService.streamMessage(sessionId, messageText.trim(), {
        onChunk: (chunks) => {
          setMessages((prev) =>
            ChatMessageManager.updateLatestMessage(prev, chunks)
          );
          chunks
            .filter((chunk) => chunk.type === "text")
            .forEach((chunk) => setTTSText(chunk.content));
        },
        onError: (error) => {
          debug.error("Error in chat:", error);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: "Sorry, an error occurred. Please try again.",
              isLatest: true,
            },
          ]);
        },
        onEnd: () => setIsStreaming(false),
      });
    } catch (error) {
      debug.error("Error initiating chat:", error);
      setIsStreaming(false);
    }
  };

  return {
    messages,
    isStreaming,
    ttsText,
    sendMessage,
    clearHistory: () => SessionService.clearSessionMessages(sessionId),
    isLoadingMessages,
  };
}
