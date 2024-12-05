"use client";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { EventSourcePolyfill } from "event-source-polyfill";

// This is a test page for debugging the streaming endpoint.

export default function StreamTest() {
  const [messages, setMessages] = useState<string[]>([]);

  async function startStream() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    const evtSource = new EventSourcePolyfill("/api/test/stream", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    evtSource.onmessage = (event) => {
      console.log("Message received:", event.data);
      setMessages((prev) => [...prev, event.data]);
    };

    evtSource.onerror = (error) => {
      console.error("EventSource error:", error);
      evtSource.close();
    };
  }

  return (
    <div>
      <button onClick={startStream}>Start Stream</button>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
    </div>
  );
}
