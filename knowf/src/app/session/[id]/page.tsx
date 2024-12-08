"use client";

import { useState, useRef, useEffect } from "react";
import { debug } from "@/lib/debug";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EventSourcePolyfill } from "event-source-polyfill";
import { useSession } from "@/hooks/useSession";
import { SessionService, ChatMessageContent } from "@/lib/sessionService";
import QueryProvider from "@/providers/query-provider";
import React from "react";
import {
  ChatMessage,
  ChatMessageManager,
  ChatMessageProps,
} from "@/components/ChatMessage";
import {
  RenderLevelProvider,
  RenderLevelSelector,
} from "@/components/ChatMessageRenderLevel";
import { Header } from "@/components/Header";
import { Flex } from "@radix-ui/themes";

export default function ChatSessionWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <QueryProvider>
      <RenderLevelProvider>
        <ChatSession params={params} />
      </RenderLevelProvider>
    </QueryProvider>
  );
}

function ChatSession({ params }: { params: Promise<{ id: string }> }) {
  // START UNDELETABLE COMMENTS
  // VERY IMPORTANT: This is needed in the new React version:
  const unwrappedParams = React.use(params);
  // we CANNOT just use params.id because it's a Promise
  // do not change this OR the these comments
  // END UNDELETABLE COMMENTS

  const sessionId = unwrappedParams.id;
  const { data: session, isLoading } = useSession(sessionId);
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    debug.log("Starting new message stream");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setInputText("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const eventSource = await SessionService.sendMessage(
        sessionId,
        messageText
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (event.data === "[END]") {
          debug.log("Received end of stream signal");
          eventSource.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
          return;
        }

        setMessages((prev) =>
          ChatMessageManager.updateLatestMessage(prev, event.data)
        );
        scrollToBottom();
      };

      eventSource.onerror = (error) => {
        debug.error("EventSource error:", error);
        eventSource.close();
        setIsStreaming(false);
        eventSourceRef.current = null;
      };
    } catch (error) {
      debug.error("Error in chat:", error);
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    async function loadMessages() {
      const sessionMessages = await SessionService.getSessionMessages(
        sessionId
      );
      setMessages(
        sessionMessages.map((msg) => ({
          role: msg.content.role,
          content: msg.content.content,
          isLatest: false,
        }))
      );

      // If no messages exist, automatically send initial message
      if (sessionMessages.length === 0) {
        handleSendMessage("I'm ready to get started.");
      }
    }
    loadMessages();
  }, [sessionId]);

  // Use handleSendMessage directly with the current input text
  const onSendClick = () => handleSendMessage(inputText);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (!session) {
    return <div>Session not found</div>;
  }

  const clearHistory = async () => {
    try {
      await SessionService.clearSessionMessages(sessionId);
      setMessages([]);
      debug.log("Chat history cleared successfully");
    } catch (error) {
      debug.error("Full error stack in clearHistory:", error);
      console.error("Complete error:", error);
      alert(`Failed to clear chat history: ${(error as Error).message}`);
    }
  };

  return (
    <Flex 
      className="dashboard-background" 
      style={{  
        backgroundColor: "var(--color-background)"
      }} 
      display="flex" 
      width="100%" 
      height="100vh" 
      direction="column"
      align="start"
    >
      <Header back={true}/>    
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.map((message, index) => (
            <div key={`message-${index}`}>
              {ChatMessageManager.renderMessage({
                role: message.role,
                content: message.content,
                isLatest: index === messages.length - 1,
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                e.preventDefault();
                onSendClick();
              }
            }}
            className="flex-1 p-2 border rounded resize-none"
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isStreaming}
            rows={1}
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={onSendClick}
            disabled={isStreaming || !inputText.trim()}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {isStreaming ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </Flex>
  );
}
