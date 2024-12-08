"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import { Document } from "@/lib/documentService";
import { DocumentActions } from "@/components/DocumentActions";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Consider all data stale immediately
      refetchOnWindowFocus: true,
    },
  },
});

// Wrap the dashboard content
export default function DashboardWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

async function fetchDocuments(userId: string | undefined) {
  if (!userId) return [];
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    debug.error("Error fetching documents:", error);
    throw error;
  }
  return documents;
}

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: () => fetchDocuments(user?.id),
    enabled: !!user?.id,
  });

  const { mutate: uploadDocument } = useMutation({
    mutationFn: async (file: File) => {
      const timestamp = new Date().getTime();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `${user?.id}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert([
        {
          user_id: user?.id,
          title: file.name,
          file_size: file.size,
          storage_path: filePath,
        },
      ]);

      if (insertError) {
        // Cleanup the uploaded file if metadata insertion fails
        await supabase.storage.from("documents").remove([filePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      debug.error("Upload process failed:", error);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    uploadDocument(file);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      debug.log("Signed out successfully, redirecting to login");
    } catch (error) {
      debug.error("Error during sign out process:", error);
    } finally {
      // Always redirect to login
      router.push("/login");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/session")}
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent px-4 py-2"
          >
            Chat
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent px-4 py-2"
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent px-4 py-2"
          >
            Sign Out
          </button>
        </div>
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
    </div>
  );
}
