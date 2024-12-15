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

type ViewMode = "debug" | "chat" | "voice-only";

interface ViewSelectorProps {
  currentMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewSelector({ currentMode, onChange }: ViewSelectorProps) {
  return (
    <div className="flex gap-2">
      {(["debug", "voice-only"] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            currentMode === mode
              ? "bg-blue-500 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

interface ChatViewProps {
  messages: ChatMessageProps[];
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (text: string) => void;
  isStreaming: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function DebugView(props: ChatViewProps) {
  return (
    <div className="w-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {props.messages.map((message, index) => (
            <div key={`message-${index}`}>
              {ChatMessageManager.renderMessage({
                ...message,
                isLatest: index === props.messages.length - 1,
                showDebugInfo: true,
              })}
            </div>
          ))}
          <div ref={props.messagesEndRef} />
        </div>
      </div>
      <ChatInput {...props} />
    </div>
  );
}

function ChatView(props: ChatViewProps) {
  return (
    <div className="w-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {props.messages.map((message, index) => (
            <div key={`message-${index}`}>
              {ChatMessageManager.renderMessage({
                ...message,
                isLatest: index === props.messages.length - 1,
                showDebugInfo: false,
              })}
            </div>
          ))}
          <div ref={props.messagesEndRef} />
        </div>
      </div>
      <ChatInput {...props} />
    </div>
  );
}

function VoiceOnlyView({
  sessionId,
  sendMessage,
}: {
  sessionId: string;
  sendMessage: (text: string) => void;
}) {
  return (
    <div className="w-full flex items-center justify-center">
      <VoiceButton
        onTranscript={(text) => sendMessage(text)}
        sessionId={sessionId}
        size="large"
        onSend={sendMessage}
      />
    </div>
  );
}

function ChatInput({
  inputText,
  setInputText,
  sendMessage,
  isStreaming,
}: Partial<ChatViewProps>) {
  return (
    <div className="flex gap-2 p-4 border-t">
      <div className="flex-1">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText?.(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !isStreaming && inputText?.trim()) {
              sendMessage?.(inputText);
              setInputText?.("");
            }
          }}
          className="w-full p-2 border rounded"
          placeholder="Type your message..."
          disabled={isStreaming}
        />
      </div>
      <button
        onClick={() => {
          sendMessage?.(inputText || "");
          setInputText?.("");
        }}
        disabled={isStreaming || !inputText?.trim()}
        className="p-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
      >
        {isStreaming ? "Sending..." : "Send"}
      </button>
    </div>
  );
}

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
  const {
    messages,
    isStreaming,
    ttsText,
    sendMessage,
    clearHistory,
    isLoadingMessages,
  } = useChat(sessionId);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("debug");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading || isLoadingMessages) return <div>Loading session...</div>;
  if (error) return <div>Error loading session</div>;
  if (!session) return <div>Session not found</div>;

  const chatViewProps = {
    messages,
    inputText,
    setInputText,
    sendMessage,
    isStreaming,
    messagesEndRef,
  };

  return (
    <Flex
      className="dashboard-background"
      style={{
        backgroundColor: "var(--color-background)",
        height: "100vh",
        overflow: "hidden",
      }}
      display="flex"
      direction="column"
    >
      <Header back={true} />
      <div className="px-10 py-5">
        <div className="flex items-center gap-4">
          <ViewSelector currentMode={viewMode} onChange={setViewMode} />
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
        </div>
      </div>
      <Separator orientation="horizontal" size="4" />

      <div className="flex flex-1" style={{ overflow: "hidden" }}>
        {viewMode === "debug" && <DebugView {...chatViewProps} />}
        {viewMode === "chat" && <ChatView {...chatViewProps} />}
        {viewMode === "voice-only" && (
          <VoiceOnlyView sessionId={sessionId} sendMessage={sendMessage} />
        )}
      </div>

      {isTTSEnabled && <AudioPlayer text={ttsText} />}
    </Flex>
  );
}
