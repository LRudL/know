"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { debug } from "@/lib/debug";
import { Prompt } from "./userSettings";
import { ensureUserSettings } from "./userSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

// Save status type for the top bar
type SaveStatus = "saved" | "unsaved" | "saving";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isLoading, setIsLoading] = useState(true);

  // Add auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load prompts and user settings
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Ensure user settings exist
        await ensureUserSettings(user.id);

        // Load all prompts (both default and user-specific)
        const { data: promptsData, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order("created_at");

        if (promptsError) {
          debug.error("Error loading prompts:", promptsError);
          return;
        }

        // Load user settings to get selected prompt
        const { data: settingsData, error: settingsError } = await supabase
          .from("user_settings")
          .select("current_prompt_id")
          .eq("user_id", user.id)
          .single();

        if (settingsError) {
          debug.error("Error loading user settings:", settingsError);
          return;
        }

        setPrompts(promptsData);
        setSelectedPromptId(settingsData?.current_prompt_id);
      } catch (err) {
        debug.error("Unexpected error loading settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaveStatus("saving");
    try {
      // Remember which prompt was selected
      const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

      // If selected prompt was a user prompt, temporarily set to default
      if (selectedPrompt?.user_id === user.id) {
        const defaultPrompt = prompts.find((p) => p.user_id === null);
        const { error: settingsError } = await supabase
          .from("user_settings")
          .update({ current_prompt_id: defaultPrompt?.id ?? null })
          .eq("user_id", user.id);

        if (settingsError) throw settingsError;
      }

      // Delete and reinsert prompts
      const { error: deleteError } = await supabase
        .from("prompts")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      const userPrompts = prompts
        .filter((p) => p.user_id === user.id)
        .map((prompt) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...rest } = prompt;
          return rest;
        });

      const { data: newPrompts, error: insertError } = await supabase
        .from("prompts")
        .insert(userPrompts)
        .select();

      if (insertError) throw insertError;

      // If we had a user prompt selected, find its new version
      if (selectedPrompt?.user_id === user.id && newPrompts) {
        const newVersion = newPrompts.find(
          (p) => p.name === selectedPrompt.name
        );
        if (newVersion) {
          const { error: settingsError } = await supabase
            .from("user_settings")
            .update({ current_prompt_id: newVersion.id })
            .eq("user_id", user.id);

          if (settingsError) throw settingsError;
          setSelectedPromptId(newVersion.id);
        }
      }

      // Reload all prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from("prompts")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("created_at");

      if (promptsError) throw promptsError;

      setPrompts(promptsData);
      setSaveStatus("saved");
    } catch (err) {
      debug.error("Error saving settings:", err);
      setSaveStatus("unsaved");
    }
  };

  const handleAddPrompt = () => {
    if (!user) return;

    // Find existing prompts with the name "New Prompt" or "New Prompt (n)"
    const existingNames = new Set(
      prompts.filter((p) => p.user_id === user.id).map((p) => p.name)
    );

    // Generate a unique name
    let newName = "New Prompt";
    let counter = 1;
    while (existingNames.has(newName)) {
      newName = `New Prompt (${counter})`;
      counter++;
    }

    const newPrompt: Omit<Prompt, "id"> = {
      user_id: user.id,
      name: newName,
      prompt_type: "pair",
      prompt_texts: {
        brainstorm_prompt: "",
        final_prompt: "",
      },
      is_active: true,
    };

    const tempPrompt = { ...newPrompt, id: `temp_${Date.now()}` };
    setPrompts([...prompts, tempPrompt]);
    setSaveStatus("unsaved");
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!user) return;

    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt || prompt.user_id === null) return; // Can't delete default prompts

    if (!confirm("Are you sure you want to delete this prompt?")) return;

    // If this was the selected prompt, update user settings first
    if (selectedPromptId === promptId) {
      const defaultPrompt = prompts.find((p) => p.user_id === null);
      const newSelectedId = defaultPrompt?.id ?? null;

      const { error: settingsError } = await supabase
        .from("user_settings")
        .update({ current_prompt_id: newSelectedId })
        .eq("user_id", user.id);

      if (settingsError) {
        debug.error("Error updating user settings:", settingsError);
        return;
      }

      setSelectedPromptId(newSelectedId);
    }

    // Now safe to update local state
    setPrompts(prompts.filter((p) => p.id !== promptId));
    setSaveStatus("unsaved");
  };

  if (loading || isLoading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen p-4">
      {/* Save Status Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b p-4 flex justify-between items-center z-50">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-blue-500 hover:text-blue-700"
        >
          ← Back to Dashboard
        </button>
        <div className="flex items-center gap-4">
          <div>{saveStatus}</div>
          <button
            onClick={handleSave}
            disabled={saveStatus === "saved"}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-16">
        {" "}
        {/* Add margin to account for fixed header */}
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        {/* Prompt Selector */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Prompt</h2>
          <select
            value={selectedPromptId || ""}
            onChange={(e) => {
              setSelectedPromptId(e.target.value || null);
              setSaveStatus("unsaved");
            }}
            className="w-full max-w-md p-2 border rounded"
          >
            <option value="">Select a prompt</option>
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name} {prompt.user_id === null ? "(Default)" : ""}
              </option>
            ))}
          </select>
        </div>
        {/* Prompts Editor */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Prompts</h2>
            <button
              onClick={handleAddPrompt}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Add New Prompt
            </button>
          </div>

          {/* Prompt Sections */}
          {prompts.map((prompt) => (
            <div key={prompt.id} className="mb-8 p-4 border rounded">
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  value={prompt.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    // Check if another prompt (excluding this one) has this name
                    const isDuplicate = prompts.some(
                      (p) =>
                        p.id !== prompt.id &&
                        p.user_id === user.id &&
                        p.name === newName
                    );

                    if (isDuplicate) {
                      alert("Can't have duplicate prompt names");
                      return;
                    }

                    const updatedPrompts = prompts.map((p) =>
                      p.id === prompt.id ? { ...p, name: newName } : p
                    );
                    setPrompts(updatedPrompts);
                    setSaveStatus("unsaved");
                  }}
                  disabled={prompt.user_id === null}
                  className="text-lg font-semibold p-2 border rounded"
                />
                {prompt.user_id !== null && (
                  <button
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2">Brainstorm Prompt</label>
                  <textarea
                    value={prompt.prompt_texts.brainstorm_prompt}
                    onChange={(e) => {
                      const updatedPrompts = prompts.map((p) =>
                        p.id === prompt.id
                          ? {
                              ...p,
                              prompt_texts: {
                                ...p.prompt_texts,
                                brainstorm_prompt: e.target.value,
                              },
                            }
                          : p
                      );
                      setPrompts(updatedPrompts);
                      setSaveStatus("unsaved");
                    }}
                    disabled={prompt.user_id === null}
                    className="w-full h-32 p-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block mb-2">Final Prompt</label>
                  <textarea
                    value={prompt.prompt_texts.final_prompt}
                    onChange={(e) => {
                      const updatedPrompts = prompts.map((p) =>
                        p.id === prompt.id
                          ? {
                              ...p,
                              prompt_texts: {
                                ...p.prompt_texts,
                                final_prompt: e.target.value,
                              },
                            }
                          : p
                      );
                      setPrompts(updatedPrompts);
                      setSaveStatus("unsaved");
                    }}
                    disabled={prompt.user_id === null}
                    className="w-full h-32 p-2 border rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
