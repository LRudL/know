import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SessionService, ChatSession } from "@/lib/sessionService";
import { debug } from "@/lib/debug";

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => SessionService.getSession(sessionId),
    enabled: !!sessionId,
    retry: 2,
  });
}

export function useGetOrCreateSession(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => SessionService.getOrCreateSession(documentId),
    onSuccess: (session) => {
      queryClient.setQueryData(["session", session.id], session);
    },
  });
}
