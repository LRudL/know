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
import { AudioPlayer } from "@/components/audioplayer";
import { SpeechInput } from "@/components/SpeechInput";
import {
  ChatMessage,
  ChatMessageManager,
  ChatMessageProps,
} from "@/components/ChatMessage";
import { Header } from "@/components/Header";
import { Flex } from "@radix-ui/themes";
import { StreamParser } from "@/lib/streamParser";
import { Separator } from "@radix-ui/themes";

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
  // START UNDELETABLE COMMENTS
  // VERY IMPORTANT: This is needed in the new React version:
  const unwrappedParams = React.use(params);
  // we CANNOT just use params.id because it's a Promise
  // do not change this OR the these comments
  // END UNDELETABLE COMMENTS

  const sessionId = unwrappedParams.id;
  const { data: session, isLoading, error } = useSession(sessionId);
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
  const isInitialLoadRef = useRef(true);
  const hasCheckedMessagesRef = useRef(false);
  const isSendingInitialMessageRef = useRef(false);

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
    let isActive = true;

    async function loadMessages() {
      debug.log("loadMessages called with refs state:", {
        hasCheckedMessages: hasCheckedMessagesRef.current,
        isSendingInitial: isSendingInitialMessageRef.current,
        isActive,
      });

      // Don't proceed if we're already sending or component is unmounted
      if (!isActive) {
        debug.log("Skipping: Component not active");
        return;
      }
      if (isSendingInitialMessageRef.current) {
        debug.log("Skipping: Already sending initial message");
        return;
      }

      try {
        const sessionMessages = await SessionService.getSessionMessages(
          sessionId
        );
        debug.log("Fetched session messages:", sessionMessages.length);

        if (!isActive) return;

        setMessages(
          sessionMessages.map((msg) => ({
            role: msg.content.role,
            content: msg.content.content,
            isLatest: false,
          }))
        );

        // If this is our first check and there are no messages, send initial message
        if (
          !hasCheckedMessagesRef.current &&
          sessionMessages.length === 0 &&
          !isStreaming
        ) {
          debug.log(
            "No messages found and first check, sending initial message"
          );
          hasCheckedMessagesRef.current = true;
          isSendingInitialMessageRef.current = true;
          await sendMessage("I'm ready to get started.");
        }

        // Mark that we've checked messages regardless of result
        hasCheckedMessagesRef.current = true;
      } catch (error) {
        debug.error("Error in initial message load:", error);
      } finally {
        if (isActive) {
          isSendingInitialMessageRef.current = false;
          debug.log("Finalizing loadMessages with refs state:", {
            hasCheckedMessages: hasCheckedMessagesRef.current,
            isSendingInitial: isSendingInitialMessageRef.current,
          });
        }
      }
    }

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (error) {
    return <div>Error loading session</div>;
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

  // Add this new component for the circular record button
  function CircularRecordButton({
    onTranscript,
    sessionId,
  }: {
    onTranscript: (text: string) => void;
    sessionId: string;
  }) {
    const [isRecording, setIsRecording] = useState(false);

    const handleTranscript = (text: string) => {
      setIsRecording(false);
      onTranscript(text);
      sendMessage(text);
    };

    const baseStyle = {
      borderRadius: "50%",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: "none",
    };

    return (
      <div className="flex items-center justify-center w-full h-full">
        <SpeechInput
          onTranscript={handleTranscript}
          sessionId={sessionId}
          className={`w-[300px] h-[300px] rounded-full transition-colors flex items-center justify-center text-white text-4xl font-bold cursor-pointer ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[var(--accent-9)] hover:bg-[var(--accent-10)]"
          }`}
          buttonStyle={baseStyle}
          buttonText={isRecording ? "Click to Send" : "Click to Speak"}
          isRecording={isRecording}
          onRecordingStateChange={setIsRecording}
        />
      </div>
    );
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
                onKeyPress={(e) =>
                  e.key === "Enter" && !isStreaming && sendMessage()
                }
                className="w-full p-2 border rounded"
                placeholder="Type your message..."
                disabled={isStreaming}
              />
            </div>
            <button
              onClick={() => sendMessage()}
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
            <CircularRecordButton
              onTranscript={(text) => setInputText(text)}
              sessionId={sessionId}
            />
          )}
        </div>
      </div>

      {isTTSEnabled && <AudioPlayer text={ttsText} />}
    </Flex>
  );
}
