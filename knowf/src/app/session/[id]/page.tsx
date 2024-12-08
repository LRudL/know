"use client";

import { useState, useRef, useEffect } from "react";
//import { use } from 'react';
import { debug } from "@/lib/debug";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EventSourcePolyfill } from "event-source-polyfill";
import { useSession } from "@/hooks/useSession";
import { SessionService, ChatMessageContent } from "@/lib/sessionService";
import QueryProvider from "@/providers/query-provider";
import React from "react";
import { TTSStreamer } from "@/components/ttsstreamer";
import { AudioPlayer } from "@/components/audioplayer";
import { SpeechInput } from "@/components/SpeechInput";
import {
  ChatMessage,
  ChatMessageManager,
  ChatMessageProps,
} from "@/components/ChatMessage";
import {
  RenderLevelProvider,
  RenderLevelSelector,
} from "@/components/ChatMessageRenderLevel";
import { StreamParser } from "@/lib/streamParser";

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
  const [ttsText, setTTSText] = useState<string>("");
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [streamParser] = useState(() => new StreamParser());
  const hasInitializedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (messageText: string = inputText) => {
    if (!messageText.trim()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    debug.log("Starting new message stream");

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: messageText.trim(),
        isLatest: false,
      },
    ]);

    setInputText("");
    setIsStreaming(true);

    // Add initial AI message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        isLatest: true,
      },
    ]);

    try {
      debug.log("Creating EventSource connection");
      const eventSource = new EventSourcePolyfill(
        `/api/chat/stream?message=${encodeURIComponent(
          messageText.trim()
        )}&session_id=${sessionId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
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

        if (event.data.startsWith("Error:")) {
          debug.error("Received error from stream:", event.data);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: "Sorry, an error occurred. Please try again.",
              isLatest: true,
            },
          ]);
          eventSource.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
          return;
        }

        const chunks = streamParser.parseChunk(event.data);

        // Update messages
        setMessages((prev) =>
          ChatMessageManager.updateLatestMessage(prev, chunks)
        );

        // Only send non-thinking text to TTS
        chunks
          .filter((chunk) => chunk.type === "text")
          .forEach((chunk) => {
            setTTSText(chunk.content);
          });

        scrollToBottom();
      };

      eventSource.onerror = (error) => {
        debug.error("EventSource error:", error);
        eventSource.close();
        setIsStreaming(false);
        eventSourceRef.current = null;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, an error occurred. Please try again.",
            isLatest: true,
          },
        ]);
      };
    } catch (error) {
      debug.error("Error in chat:", error);
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, an error occurred. Please try again.",
          isLatest: true,
        },
      ]);
    }
  };

  useEffect(() => {
    async function loadMessages() {
      if (hasInitializedRef.current) return;

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

      if (sessionMessages.length === 0 && !isStreaming) {
        console.log("AUTO SENDING INITIAL MESSAGE");
        hasInitializedRef.current = true;
        sendMessage("I'm ready to get started.");
      }
    }
    loadMessages();
  }, [sessionId, isStreaming]);

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
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Chat Session</h1>
          <Link
            href="/dashboard"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
          >
            Back to Dashboard
          </Link>
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
          <div className="ml-auto">
            <RenderLevelSelector />
          </div>
        </div>
        <p className="text-sm text-gray-500">Session ID: {sessionId}</p>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
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
        <div className="flex gap-2 p-4 border-t">
          <div className="flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && !isStreaming && sendMessage()
              }
              className="w-full p-2 border rounded"
              placeholder="Type your message..."
              disabled={isStreaming}
            />
          </div>

          {isSpeechEnabled && (
            <SpeechInput
              onTranscript={(text) => {
                setInputText(text);
              }}
              sessionId={sessionId}
              className="flex-shrink-0"
            />
          )}

          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !inputText.trim()}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {isStreaming ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {isTTSEnabled && <AudioPlayer text={ttsText} />}
    </div>
  );
}
