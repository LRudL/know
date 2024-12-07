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
  const { data: session, isLoading } = useSession(sessionId);
  const [messages, setMessages] = useState<ChatMessageContent[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMessages() {
      const sessionMessages = await SessionService.getSessionMessages(
        sessionId
      );
      setMessages(sessionMessages.map((msg) => msg.content));
    }
    loadMessages();
  }, [sessionId]);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (!session) {
    return <div>Session not found</div>;
  }

  // Auto-scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    debug.log("Starting new message stream");
    const userMessage: ChatMessageContent = {
      role: "user",
      content: inputText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      debug.log("Creating EventSource connection");
      const eventSource = new EventSourcePolyfill(
        `/api/chat/stream?message=${encodeURIComponent(
          inputText
        )}&session_id=${sessionId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        debug.log("EventSource connection opened");
      };

      eventSource.onmessage = (event) => {
        // debug.log("Raw event received:", event);
        // debug.log("Event data:", event.data);

        if (event.data === "[END]") {
          debug.log("Received end of stream signal");
          eventSource.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
          return;
        }

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = { ...newMessages[newMessages.length - 1] };
          lastMessage.content = lastMessage.content + event.data;
          return [...newMessages.slice(0, -1), lastMessage];
        });
        scrollToBottom();
      };

      eventSource.onerror = (error) => {
        debug.log("EventSource readyState:", eventSource.readyState);
        // EventSourcePolyfill.CLOSED is 2
        if (eventSource.readyState === 2) {
          debug.log("EventSource connection closed normally");
        } else {
          debug.error("EventSource error:", error);
          debug.log("EventSource full state:", {
            readyState: eventSource.readyState,
            url: eventSource.url,
            withCredentials: eventSource.withCredentials,
          });
        }
        eventSource.close();
        setIsStreaming(false);
        eventSourceRef.current = null;
      };
    } catch (error) {
      debug.error("Error in chat:", error);
      setIsStreaming(false);
    }
  };

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
        </div>
        <p className="text-sm text-gray-500">Session ID: {sessionId}</p>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-100 ml-auto max-w-[80%]"
                  : "bg-gray-100 mr-auto max-w-[80%]"
              }`}
            >
              {message.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" && !isStreaming && sendMessage()
            }
            className="flex-1 p-2 border rounded"
            placeholder="Type your message..."
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !inputText.trim()}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {isStreaming ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
