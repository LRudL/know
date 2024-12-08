import { supabase } from "@/lib/supabase";
import { debug } from "@/lib/debug";

export interface Document {
  id: string;
  title: string;
  file_size: number;
  storage_path: string;
  user_id: string;
  created_at: string;
}

export class DocumentService {
  static async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document first to get storage path
      const { data: doc, error: fetchError } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("id", documentId)
        .single();

      if (fetchError) throw fetchError;

      // Find all chat sessions for this document
      const { data: sessions, error: sessionsError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("document_id", documentId);

      if (sessionsError) throw sessionsError;

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);

        // Delete all messages from these sessions
        const { error: messagesError } = await supabase
          .from("chat_messages")
          .delete()
          .in("session_id", sessionIds);

        if (messagesError) {
          debug.error("Error deleting chat messages:", messagesError);
          throw messagesError;
        }

        // Delete the sessions
        const { error: sessionsDeleteError } = await supabase
          .from("chat_sessions")
          .delete()
          .in("id", sessionIds);

        if (sessionsDeleteError) {
          debug.error("Error deleting chat sessions:", sessionsDeleteError);
          throw sessionsDeleteError;
        }
      }

      // Delete from documents table
      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (deleteError) throw deleteError;

      // Delete from storage
      if (doc?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([doc.storage_path]);

        if (storageError) {
          debug.error("Error deleting document from storage:", storageError);
        }
      }
    } catch (error) {
      debug.error("Error in deleteDocument:", error);
      throw error;
    }
  }
}
