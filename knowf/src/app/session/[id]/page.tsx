"use client";

import { useState, useRef, useEffect } from "react";
import { debug } from "@/lib/debug";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { SessionService, ChatMessageContent } from "@/lib/sessionService";
import QueryProvider from "@/providers/query-provider";
import React from "react";
import { AudioPlayer } from "@/components/audioplayer";
import { SpeechInput } from "@/components/SpeechInput";
import {
  ChatMessage,
  ChatMessageManager,
  ChatMessageProps,
} from "@/components/ChatMessage";
import { Header } from "@/components/Header";
import { Flex } from "@radix-ui/themes";
import { Separator } from "@radix-ui/themes";
import { VoiceButton } from "@/components/VoiceButton";
import { useChat } from "@/hooks/useChat";

export default function ChatSessionWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <QueryProvider>
      <ChatSession params={params} />
    </QueryProvider>
  );
}

function ChatSession({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const sessionId = unwrappedParams.id;
  const { data: session, isLoading, error } = useSession(sessionId);
  const { messages, isStreaming, ttsText, sendMessage, clearHistory } =
    useChat(sessionId);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const hasInitializedRef = useRef(false);
  const hasCheckedMessagesRef = useRef(false);
  const isSendingInitialMessageRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      if (!isActive || isSendingInitialMessageRef.current) return;

      try {
        if (
          !hasCheckedMessagesRef.current &&
          messages.length === 0 &&
          !isStreaming
        ) {
          debug.log(
            "No messages found and first check, sending initial message"
          );
          hasCheckedMessagesRef.current = true;
          isSendingInitialMessageRef.current = true;
          await sendMessage("I'm ready to get started.");
        }
        hasCheckedMessagesRef.current = true;
      } catch (error) {
        debug.error("Error in initial message load:", error);
      } finally {
        if (isActive) {
          isSendingInitialMessageRef.current = false;
        }
      }
    }

    loadMessages();
    return () => {
      isActive = false;
    };
  }, [sessionId, messages.length, isStreaming, sendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (error) {
    return <div>Error loading session</div>;
  }

  if (!session) {
    return <div>Session not found</div>;
  }

  return (
    <Flex
      className="dashboard-background"
      style={{
        backgroundColor: "var(--color-background)",
        height: "100vh", // Full viewport height
        overflow: "hidden", // Prevent page-level scroll
      }}
      display="flex"
      direction="column"
    >
      <Header back={true} />
      <div className="px-10 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={clearHistory}
            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors"
          >
            Clear History
          </button>
          <button
            onClick={() => setIsTTSEnabled(!isTTSEnabled)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
          >
            {isTTSEnabled ? "🔇 Mute TTS" : "🔈 Unmute TTS"}
          </button>
          <button
            onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
          >
            {isSpeechEnabled ? "🎤 Disable Voice" : "🎤 Enable Voice"}
          </button>
        </div>
      </div>
      <Separator orientation="horizontal" size="4" />

      {/* Main content area */}
      <div className="flex flex-1" style={{ overflow: "hidden" }}>
        {/* Left side - Chat with scrolling */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {/* Messages container */}
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`message-${index}`}>
                  {ChatMessageManager.renderMessage({
                    ...message,
                    isLatest: index === messages.length - 1,
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* Input area fixed at bottom */}
          <div className="flex gap-2 p-4 border-t">
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isStreaming && inputText.trim()) {
                    sendMessage(inputText);
                    setInputText("");
                  }
                }}
                className="w-full p-2 border rounded"
                placeholder="Type your message..."
                disabled={isStreaming}
              />
            </div>
            <button
              onClick={() => {
                sendMessage(inputText);
                setInputText("");
              }}
              disabled={isStreaming || !inputText.trim()}
              className="p-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
            >
              {isStreaming ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        {/* Right side - Record button (no scroll) */}
        <div className="w-1/2 flex items-center justify-center border-l">
          {isSpeechEnabled && (
            <VoiceButton
              onTranscript={(text) => setInputText(text)}
              sessionId={sessionId}
              size="large"
              onSend={sendMessage}
            />
          )}
        </div>
      </div>

      {isTTSEnabled && <AudioPlayer text={ttsText} />}
    </Flex>
  );
}
