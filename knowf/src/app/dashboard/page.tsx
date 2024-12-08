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
import { UploadCard } from "@/components/UploadCard";
import { ChatCard } from "@/components/ChatCard";
import { Header } from "@/components/Header";
import { Flex, Text, Button, Grid } from "@radix-ui/themes";
import { ClockIcon, ChatBubbleIcon, CaretRightIcon } from "@radix-ui/react-icons";


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
    uploadDocument(file);
  };

  const { graph, generateGraph, isGenerating } = useDocumentGraph(documents?.at(-1)?.id);

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

  if (loading) {
    return <div>Loading...</div>;
  } 
  if (!user) return null;

  return (
    <Flex 
      className="dashboard-background" 
      style={{  
        backgroundColor: "var(--color-background)"
      }} 
      display="flex" 
      width="100%" 
      height="100vh" 
      direction="column"
      align="start"
    >
      <Header back={false}/>
      <Flex 
        className="body" 
        style={{
          alignSelf: "stretch"
        }} 
        display="flex" 
        p="7" 
        direction="column" 
        align="center" 
        gap="7" 
        flexGrow="1"
      >
        <Flex
          className="body-container"
          display="flex"
          maxWidth="940px"
          align="start"
          gap="5"
        >
          <Flex 
            className="pdf-section"
            display="flex" 
            direction="column" 
            align="start"
            gap="5"
          >
            <Flex
              className="title"
              display="flex"
              maxWidth="300px"
              direction="column"
              justify="center"
              align="start"
              gap="3"
            >
              <Text size="6" weight="regular">
                Welcome back, Luke
              </Text>
              <Flex display="flex" align="center" gap="3">
                <ClockIcon width="24" height="24"/>
                <Flex display="flex" direction="column">
                  <Text size="2" weight="regular">It is 2:30 pm in the afternoon.</Text>
                  <Text size="2" weight="regular">Ready for today's lesson?</Text>
                </Flex>
              </Flex>
            </Flex>
            <UploadCard
              uploading={uploading}
              uploaded={uploaded}
              documents={documents}
              isGeneratingState={isGeneratingState}
              handleFileUpload={handleFileUpload}
              handleStartSession={() => generateGraph()}
            />
          </Flex>
          <Flex
            className="chat-history-container"
            style={{
              alignSelf: "stretch"
            }}
            display="flex"
            direction="column"
            justify="end"
            align="start"
            gap="5"
          >    
            <Flex
              className="recent-chat-container"
              display="flex"
              width="615px"
              height="var(--space-5)"
              justify="between"
              align="center"
            >
              <Flex
                className="our-recent-chats"
                display="flex"
                justify="center"
                align="center"
                gap="3"
              >
                <ChatBubbleIcon width="16" height="16"/>
                <Text size="2" weight="regular">Our recent chats</Text>
              </Flex>
              <Button color="gray" size="1" variant="ghost">
                Show all
                <CaretRightIcon width="16" height="16"/>
              </Button>
            </Flex>
            <Grid style={{gap: "20px"}} columns="2" rows="repeat(3, 150px)" width="auto">
              {documents.map((doc) => (
                <ChatCard key={doc.id} doc={doc}/>
              ))
              }
            </Grid>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}
