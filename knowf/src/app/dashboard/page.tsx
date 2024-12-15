"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import { DocumentService } from "@/lib/documentService";
import { useDocumentGraph } from "@/hooks/useKnowledgeGraph";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ChatCard } from "@/components/ChatCard";
import { Header } from "@/components/Header";
import { Flex, Text, Button, Grid } from "@radix-ui/themes";
import {
  ClockIcon,
  ChatBubbleIcon,
  CaretRightIcon,
} from "@radix-ui/react-icons";
import { UploadButton } from "@/components/UploadButton";

// Create a client
const queryClient = new QueryClient();

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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
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
      setUploaded(true);
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      uploadDocument(file);
    } catch (error) {
      debug.error("Error uploading file:", error);
      setUploading(false);
    }
  };

  // Get the latest document ID safely
  const latestDocumentId = documents?.[documents.length - 1]?.id;

  // Only call useDocumentGraph when we have a valid document ID
  const { graph, generateGraph, isGenerating } = useDocumentGraph(
    latestDocumentId || null // Pass null instead of undefined
  );

  const [isGeneratingState, setIsGeneratingState] = useState(isGenerating);

  const { mutate: deleteDocument, isPending: isDeletingDocument } = useMutation(
    {
      mutationFn: () => DocumentService.deleteDocument(documents?.at(-1)?.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      },
      onError: (error) => {
        debug.error("Error deleting document:", error);
      },
    }
  );

  useEffect(() => {
    if (graph) {
      setIsGeneratingState(false);
    }
  }, [graph]);

  const handleStartSession = async () => {
    if (!latestDocumentId) return;

    setIsGeneratingState(true);
    try {
      await generateGraph();
    } catch (error) {
      debug.error("Error generating graph:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!user) return null;

  return (
    <Flex
      direction="column"
      width="100%"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <Header back={false} />
      <Flex
        direction="column"
        align="center"
        gap="4"
        p="4"
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          paddingTop: "var(--space-6)",
        }}
      >
        {/* Welcome Text */}
        <Flex
          direction="column"
          align="center"
          gap="2"
          style={{
            maxWidth: "600px",
            width: "100%",
            marginBottom: "var(--space-4)",
          }}
        >
          <Text size="6" weight="regular">
            Welcome back
          </Text>
          <Flex align="center" gap="2">
            <ClockIcon width="20" height="20" />
            <Text size="2">Ready for today's lesson?</Text>
          </Flex>
        </Flex>

        {/* Upload Button with all necessary props */}
        <UploadButton
          uploading={uploading}
          uploaded={uploaded}
          documents={documents}
          isGeneratingState={isGeneratingState}
          onUpload={handleFileUpload}
          onStartSession={handleStartSession}
        />

        {/* Documents List */}
        <Flex
          direction="column"
          gap="3"
          style={{ width: "100%", alignItems: "center" }}
        >
          {documents.map((doc) => (
            <ChatCard key={doc.id} doc={doc} />
          ))}
        </Flex>
      </Flex>
    </Flex>
  );
}
