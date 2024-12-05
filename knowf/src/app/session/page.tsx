"use client";

import { useState, useRef } from "react";
import { debug } from "@/lib/debug";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EventSourcePolyfill } from "event-source-polyfill";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatSession() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    const userMessage: Message = { role: "user", content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      debug.log("Creating EventSource connection");
      const eventSource = new EventSourcePolyfill(
        `/api/chat/stream?message=${encodeURIComponent(inputText)}`,
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
        </div>
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
          <div ref={messagesEndRef} /> {/* Scroll anchor */}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 p-2 border rounded"
            placeholder="Type your message..."
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
