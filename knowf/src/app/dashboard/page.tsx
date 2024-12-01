"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchDocuments();
    }
  }, [user, loading, router]);

  const fetchDocuments = async () => {
    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user?.id);

    if (error) {
      debug.error("Error fetching documents:", error);
    } else {
      console.log("Documents:", documents);
      setDocuments(documents);
    }
  };

  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const filePath = `${user?.id}/${file.name}`;
    setUploading(true);

    const { data, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      debug.error("Error uploading file:", uploadError);
      setUploading(false);
      return;
    }

    debug.log("File uploaded successfully:", data);

    const { error: insertError } = await supabase.from("documents").insert([
      {
        user_id: user?.id,
        title: file.name,
        file_size: file.size,
        storage_path: filePath,
      },
    ]);

    if (insertError) {
      debug.error("Error inserting document metadata:", insertError);
    } else {
      debug.log("Document metadata inserted successfully");
      fetchDocuments();
    }

    setUploading(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
      debug.log("User signed out successfully");
    } catch (error) {
      debug.error("Error signing out:", error);
    }
  };

  const handleDeleteDocument = async (
    documentId: string,
    storagePath: string
  ) => {
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      debug.error("Error deleting document metadata:", deleteError);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([storagePath]);

    if (storageError) {
      debug.error("Error deleting document from storage:", storageError);
    } else {
      debug.log("Document deleted successfully");
      fetchDocuments();
    }
  };

  const generateKnowledgeMap = async (documentId: string) => {
    try {
      const response = await fetch(`/api/generate_knowledge_map`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate knowledge map");
      }

      const data = await response.json();
      debug.log("Knowledge map generated successfully:", data);
      // Optionally, you can update the UI or state based on the response
    } catch (error) {
      debug.error("Error generating knowledge map:", error);
    }
  };

  const getDocumentContent = async (documentId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `/api/documents/document_content?document_id=${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch document content");
      const content = await response.blob();
      return content;
    } catch (error) {
      debug.error("Error fetching document content:", error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent px-4 py-2"
        >
          Sign Out
        </button>
      </div>
      <p>Welcome, {user.email}</p>
      <p className="text-sm text-gray-500">User ID: {user.id}</p>

      <div className="mb-8">
        <input type="file" onChange={handleFileUpload} />
        {uploading && <p>Uploading...</p>}
      </div>

      <div>
        <h2 className="text-xl font-semibold">Uploaded Documents</h2>
        <table className="min-w-full border-collapse border border-gray-200">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2">Document Title</th>
              <th className="border border-gray-300 p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="border border-gray-300 p-2">{doc.title}</td>
                <td className="border border-gray-300 p-2">
                  <button
                    onClick={() => generateKnowledgeMap(doc.id)}
                    className="mr-2 bg-blue-500 text-white rounded px-4 py-2"
                  >
                    Generate Knowledge Map
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteDocument(doc.id, doc.storage_path)
                    }
                    className="bg-red-500 text-white rounded px-4 py-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* More dashboard content will go here */}
    </div>
  );
}
