import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { KnowledgeGraphService, KnowledgeGraph } from "@/lib/graphService";
import { debug } from "@/lib/debug";

interface UseGraphResult {
  graph: KnowledgeGraph | null;
  isLoading: boolean;
  exists: boolean;
}

// For direct graph access - used in graph view
export function useGraph(graphId: string): UseGraphResult {
  const queryClient = useQueryClient();
  const queryKey = ["graph", graphId];

  const { data, isLoading } = useQuery<KnowledgeGraph | null, Error>({
    queryKey,
    queryFn: () => KnowledgeGraphService.getGraph(graphId),
    enabled: !!graphId && graphId.trim() !== "",
  });

  return {
    graph: data || null,
    isLoading: isLoading && !!graphId && graphId.trim() !== "",
    exists: !!data,
  };
}

// For document->graph relationship - used in dashboard
export function useDocumentGraph(documentId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["document-graph", documentId];

  const { data: graph, isLoading } = useQuery<KnowledgeGraph | null, Error>({
    queryKey,
    queryFn: () => KnowledgeGraphService.getGraphForDocument(documentId),
    refetchInterval: (query) => {
      debug.log("[Poll] Checking if should continue polling:", {
        status: query.state.data?.status,
        exists: !!query.state.data,
      });
      return query.state.data?.status === "processing" ? 2000 : false;
    },
  });

  // Mutation for generating graph
  const {
    mutate: generateGraph,
    isPending: isGenerating,
  }: UseMutationResult<string, Error, void> = useMutation({
    mutationFn: () => KnowledgeGraphService.generateGraph(documentId),
    onMutate: async () => {
      // Set initial optimistic data
      const newGraph = {
        id: "pending",
        nodes: [],
        edges: [],
        status: "processing",
      };
      queryClient.setQueryData(queryKey, newGraph);
      return { previousGraph: null };
    },
    onError: (error) => {
      debug.error("Error generating graph:", error);
      // Never clear processing state on timeout - backend is still working
      if (!(error instanceof Error && error.message.includes("timeout"))) {
        queryClient.setQueryData(queryKey, null);
      }
      // Add this to force a refetch after error
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation for deleting graph
  const {
    mutate: deleteGraph,
    isPending: isDeleting,
  }: UseMutationResult<void, Error, void> = useMutation({
    mutationFn: async () => {
      if (!graph?.id) throw new Error("No graph to delete");
      await KnowledgeGraphService.deleteGraphByDocumentId(documentId);
      await new Promise((resolve) => setTimeout(resolve, 400));
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
    onError: (error) => {
      debug.error("Error deleting graph:", error);
    },
  });

  return {
    graph,
    isLoading,
    generateGraph,
    isGenerating,
    deleteGraph,
    isDeleting,
    exists: !!graph,
    status: graph?.status,
    error: graph?.error_message,
  };
}
