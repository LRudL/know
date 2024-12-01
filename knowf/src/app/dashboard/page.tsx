"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useDocumentGraph } from "@/hooks/useKnowledgeGraph";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

function DocumentActions({ doc }: { doc: any }) {
  const queryClient = useQueryClient();
  const {
    graph,
    isLoading,
    generateGraph,
    isGenerating,
    deleteGraph,
    isDeleting,
    exists,
  } = useDocumentGraph(doc.id);

  const { mutate: deleteDocument, isPending: isDeletingDocument } = useMutation(
    {
      mutationFn: async () => {
        // Delete from documents table
        const { error: deleteError } = await supabase
          .from("documents")
          .delete()
          .eq("id", doc.id);

        if (deleteError) throw deleteError;

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([doc.storage_path]);

        if (storageError) {
          debug.error("Error deleting document from storage:", storageError);
        }
      },
      onSuccess: () => {
        // Invalidate the documents query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      },
      onError: (error) => {
        debug.error("Error deleting document:", error);
      },
    }
  );

  return (
    <td className="border border-gray-300 p-2">
      <div className="flex gap-2">
        {!exists ? (
          <button
            onClick={() => generateGraph()}
            disabled={isGenerating}
            className="bg-blue-500 text-white rounded px-4 py-2 disabled:bg-blue-300"
          >
            {isGenerating ? "Generating..." : "Generate Knowledge Map"}
          </button>
        ) : (
          <>
            <Link
              href={`/graphview/${graph?.id}`}
              className="bg-green-500 text-white rounded px-4 py-2"
            >
              View Map
            </Link>
            <button
              onClick={() => {
                debug.log("Delete button clicked");
                deleteGraph();
              }}
              disabled={isDeleting}
              className="bg-red-500 text-white rounded px-4 py-2 disabled:bg-red-300"
            >
              {isDeleting ? "Deleting..." : "Delete Map"}
            </button>
          </>
        )}
        <button
          onClick={() => deleteDocument()}
          disabled={isDeletingDocument}
          className="bg-red-700 text-white rounded px-4 py-2"
        >
          Delete Document
        </button>
      </div>
    </td>
  );
}

// Wrap the dashboard content
export default function DashboardWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

function Dashboard() {
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
      setDocuments(documents);
    }
  };

  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    // Add timestamp to filename to ensure uniqueness
    const timestamp = new Date().getTime();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `${user?.id}/${fileName}`;
    setUploading(true);

    try {
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
          title: file.name, // Keep original filename as title
          file_size: file.size,
          storage_path: filePath,
        },
      ]);

      if (insertError) {
        debug.error("Error inserting document metadata:", insertError);
        // Cleanup the uploaded file if metadata insertion fails
        await supabase.storage.from("documents").remove([filePath]);
      } else {
        debug.log("Document metadata inserted successfully");
        fetchDocuments();
      }
    } catch (error) {
      debug.error("Upload process failed:", error);
    } finally {
      setUploading(false);
    }
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
                <DocumentActions doc={doc} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* More dashboard content will go here */}
    </div>
  );
}
