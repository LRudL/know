"use client";
import { useRouter } from "next/navigation";
import { Document, DocumentService } from "@/lib/documentService";
import { useDocumentGraph } from "@/hooks/useKnowledgeGraph";
import { usePromptName } from "@/hooks/usePromptName";
import { useGetOrCreateSession } from "@/hooks/useSession";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debug } from "@/lib/debug";
import { supabase } from "@/lib/supabase";
import { Flex, Text, Card, Button } from "@radix-ui/themes";

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

  const { mutate: deleteProgress, isPending: isDeletingProgress } = useMutation(
    {
      mutationFn: async () => {
        const { error } = await supabase
          .from("learning_progress")
          .delete()
          .match({ graph_id: graph?.id });
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["learning-progress"] });
      },
      onError: (error) => {
        debug.error("Error deleting progress:", error);
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

  const handleDeleteMap = () => {
    if (
      window.confirm(
        `Are you sure you want to delete the knowledge map for "${doc.title}"?\nThis will also delete all learning progress.`
      )
    ) {
      deleteGraph();
    }
  };

  const handleDeleteProgress = () => {
    if (
      window.confirm(
        `Are you sure you want to delete all learning progress for "${doc.title}"?`
      )
    ) {
      deleteProgress();
    }
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
        width: "100%",
        maxWidth: "600px",
        padding: "var(--space-4)",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <Text size="3" weight="medium">
        {doc.title}
      </Text>
      <Flex direction="column" gap="2">
        <Flex gap="2">
          {!exists ? (
            <Button disabled={isGenerating} size="2" variant="solid">
              {isGenerating ? "Loading..." : "Start"}
            </Button>
          ) : graph?.status === "processing" ? (
            <Button size="2" variant="solid" disabled={true}>
              Loading...
            </Button>
          ) : (
            <>
              <Button
                onClick={() => router.push(`/graphview/${graph?.id}`)}
                size="2"
                variant="solid"
              >
                View Map
              </Button>
              <Button
                onClick={() => handleStartSession()}
                size="2"
                variant="solid"
              >
                Start Session
              </Button>
            </>
          )}
        </Flex>

        {exists && (
          <Flex gap="2">
            <Button
              color="gray"
              onClick={handleDeleteMap}
              size="2"
              variant="outline"
              style={{
                borderColor: "black",
                "--accent-9": "black",
              }}
            >
              Delete Map
            </Button>
            <Button
              color="gray"
              onClick={handleDeleteProgress}
              size="2"
              variant="outline"
              style={{
                borderColor: "black",
                "--accent-9": "black",
              }}
            >
              Delete Progress
            </Button>
            <Button
              color="gray"
              onClick={handleDeleteDocument}
              size="2"
              variant="outline"
              style={{
                borderColor: "black",
                "--accent-9": "black",
              }}
            >
              Delete Document
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );
};
