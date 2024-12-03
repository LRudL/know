import { supabase } from "@/lib/supabase";

type PromptType = "pair";

export interface Prompt {
  id: string;
  user_id: string | null;
  name: string;
  prompt_type: PromptType;
  prompt_texts: {
    brainstorm_prompt: string;
    final_prompt: string;
  };
  is_active: boolean;
}

export interface UserSettings {
  user_id: string;
  current_prompt_id: string | null;
}

export async function ensureUserSettings(userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select()
    .eq("user_id", userId)
    .single();

  if (!data) {
    await supabase.from("user_settings").insert({ user_id: userId });
  }
}

export async function getCurrentPromptId(
  userId: string | null
): Promise<string> {
  if (userId) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("current_prompt_id")
      .eq("user_id", userId)
      .single();

    if (settings?.current_prompt_id) {
      return settings.current_prompt_id;
    }
  }

  // Fall back to default prompt
  const { data: defaultPrompt } = await supabase
    .from("prompts")
    .select("id")
    .is("user_id", null)
    .single();

  if (!defaultPrompt) {
    throw new Error("No default prompt found");
  }

  return defaultPrompt.id;
}

export async function getPromptTexts(promptId: string) {
  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("prompt_texts")
    .eq("id", promptId)
    .single();

  if (error) throw error;
  if (!prompt) throw new Error("Prompt not found");

  return prompt.prompt_texts;
}

export async function getCurrentPrompt(userId: string) {
  const promptId = await getCurrentPromptId(userId);
  return getPromptTexts(promptId);
}
