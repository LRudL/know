import { supabase } from "@/lib/supabase";
import { debug } from "@/lib/debug";
import { EventSourcePolyfill } from "event-source-polyfill";
import { StreamParser, StreamChunk } from "./streamParser";

export interface ChatSession {
  id: string;
  user_id: string;
  document_id: string;
  created_at: string;
}

export interface ChatMessageContent {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  content: ChatMessageContent;
  created_at: string;
}

export class SessionService {
  static async getOrCreateSession(documentId: string): Promise<ChatSession> {
    try {
      // Get current user's session to ensure we're authenticated
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession?.user?.id) throw new Error("No authenticated user");

      // First try to get existing session
      const { data: existingSession, error: fetchError } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("document_id", documentId)
        .eq("user_id", authSession.user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If session exists, return it
      if (existingSession) {
        return existingSession;
      }

      // If no session exists, create new one
      const { data: newSession, error: insertError } = await supabase
        .from("chat_sessions")
        .insert([
          {
            document_id: documentId,
            user_id: authSession.user.id,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!newSession) throw new Error("Failed to create session");

      return newSession;
    } catch (error) {
      debug.error("Error in getOrCreateSession:", error);
      throw error;
    }
  }

  static async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const { data: session, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;
      return session;
    } catch (error) {
      debug.error("Error in getSession:", error);
      return null;
    }
  }

  static async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at");

      if (error) throw error;
      return messages || [];
    } catch (error) {
      debug.error("Error in getSessionMessages:", error);
      return [];
    }
  }

  static async clearSessionMessages(sessionId: string): Promise<void> {
    try {
      debug.log(`[Clear] Starting deletion for session ${sessionId}`);

      const { data: before } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("session_id", sessionId);

      const deleteResult = await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId);

      // Verify deletion worked
      const { data: remaining, error: verifyError } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("session_id", sessionId);

      if (verifyError) {
        throw new Error("Verification failed: " + verifyError.message);
      }

      if (remaining && remaining.length > 0) {
        throw new Error(
          "Messages remain after deletion: " + remaining.length + " messages"
        );
      }

      debug.log("[Clear] Deletion completed successfully");
    } catch (error) {
      debug.error("[Clear] Full error in clearSessionMessages:", error);
      throw error;
    }
  }

  static async streamMessage(
    sessionId: string,
    message: string,
    callbacks: {
      onChunk: (chunks: StreamChunk[]) => void;
      onError: (error: Error) => void;
      onEnd: () => void;
    }
  ): Promise<() => void> {
    // returns cleanup function
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    debug.log("Creating EventSource connection");
    const eventSource = new EventSourcePolyfill(
      `/api/chat/stream?message=${encodeURIComponent(
        message
      )}&session_id=${sessionId}`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );

    const streamParser = new StreamParser();

    eventSource.onmessage = (event) => {
      if (event.data === "[END]") {
        eventSource.close();
        callbacks.onEnd();
        return;
      }

      if (event.data.startsWith("Error:")) {
        debug.error("Received error from stream:", event.data);
        eventSource.close();
        callbacks.onError(new Error(event.data));
        return;
      }

      const chunks = streamParser.parseChunk(event.data);
      callbacks.onChunk(chunks);
    };

    eventSource.onerror = (error) => {
      debug.error("EventSource error:", error);
      eventSource.close();
      callbacks.onError(new Error("Stream connection failed"));
    };

    // Also add onopen for debugging
    eventSource.onopen = () => {
      debug.log("EventSource connection opened");
    };

    return () => eventSource.close();
  }
}
