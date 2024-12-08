"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Document, DocumentService } from "@/lib/documentService";
import { useDocumentGraph } from "@/hooks/useKnowledgeGraph";
import { usePromptName } from "@/hooks/usePromptName";
import { useGetOrCreateSession } from "@/hooks/useSession";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import { Flex, Text, Card, Button, Grid } from "@radix-ui/themes";

export const ChatCard = ({ doc }: { doc: Document }) => {

  const queryClient = useQueryClient();
  const {
    graph,
    generateGraph,
    isGenerating,
    deleteGraph,
    isDeleting,
    exists,
  } = useDocumentGraph(doc.id);

  const { data: promptName } = usePromptName(graph?.prompt_id ?? null);

  const { mutate: deleteDocument, isPending: isDeletingDocument } = useMutation(
    {
      mutationFn: () => DocumentService.deleteDocument(doc.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      },
      onError: (error) => {
        debug.error("Error deleting document:", error);
      },
    }
  );

  const router = useRouter();
  const { mutate: startSession, isPending: isStartingSession } =
    useGetOrCreateSession(doc.id);

  const handleStartSession = () => {
    startSession(undefined, {
      onSuccess: (session) => {
        router.push(`/session/${session.id}`);
      },
    });
  };

  const handleDeleteDocument = () => {
    const confirmMessage = `Are you sure you want to delete "${doc.title}"?\n\nThis will also delete:\n- All chat sessions\n- Knowledge graphs\n- Learning progress\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      deleteDocument();
    }
  };

  return (
    <Card
    style={{
      display: "flex",
      height: "150px",
      width: "300px",
      padding: "var(--space-4)",
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-start",
      alignSelf: "stretch"
    }}
  >
    <Text size="2" weight="regular">
      {doc.title}
    </Text>
    <Grid style={{gap: "16px"}} columns="3" rows="repeat(1, auto)" width="auto">
      {graph?.status === "processing" ? (
        <Button size="1" variant="solid" disabled={true}>
          Loading...
        </Button>
      ) : (graph?.status === "complete" ? (
        <>
          <Button
            onClick={() => router.push(`/graphview/${graph?.id}`)}
            size="1"
            variant="solid"
          >
            View Map
          </Button>
          <Button
            onClick={() => handleStartSession()}
            size="1"
            variant="solid"
          >
            Session
          </Button>
        </>
      ) : null)}
      <Button
        color="ruby"
        onClick={() => handleDeleteDocument()}
        size="1"
        variant="solid"
      >
        Delete
      </Button>
    </Grid>
  </Card>
  )
}