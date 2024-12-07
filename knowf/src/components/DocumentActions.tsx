import { useRouter } from "next/navigation";
import Link from "next/link";
import { Document, DocumentService } from "@/lib/documentService";
import { useDocumentGraph } from "@/hooks/useKnowledgeGraph";
import { usePromptName } from "@/hooks/usePromptName";
import { useGetOrCreateSession } from "@/hooks/useSession";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debug } from "@/lib/debug";

export function DocumentActions({ doc }: { doc: Document }) {
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
        ) : graph?.status === "processing" ? (
          <div className="bg-yellow-500 text-white rounded px-4 py-2">
            Processing Map...
          </div>
        ) : (
          <>
            <Link
              href={`/graphview/${graph?.id}`}
              className="bg-green-500 text-white rounded px-4 py-2"
            >
              View Map (from prompt: {promptName})
            </Link>
            <button
              onClick={() => deleteGraph()}
              disabled={isDeleting}
              className="bg-red-500 text-white rounded px-4 py-2 disabled:bg-red-300"
            >
              {isDeleting ? "Deleting..." : "Delete Map"}
            </button>
          </>
        )}
        <button
          onClick={handleDeleteDocument}
          disabled={isDeletingDocument}
          className="bg-red-700 text-white rounded px-4 py-2 disabled:bg-red-600"
        >
          {isDeletingDocument ? "Deleting..." : "Delete Document"}
        </button>
        <button
          onClick={handleStartSession}
          disabled={isStartingSession}
          className="bg-purple-500 text-white rounded px-4 py-2 disabled:bg-purple-300"
        >
          {isStartingSession ? "Starting..." : "Session"}
        </button>
      </div>
    </td>
  );
}
