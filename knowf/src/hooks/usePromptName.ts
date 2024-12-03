import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function usePromptName(promptId: string | null) {
  return useQuery({
    queryKey: ["promptName", promptId],
    queryFn: async () => {
      if (!promptId) return "unknown prompt";

      const { data, error } = await supabase
        .from("prompts")
        .select("name")
        .eq("id", promptId)
        .single();

      if (error || !data) return "unknown prompt";
      return data.name;
    },
    enabled: true,
  });
}
