import { DEFAULT_STYLE, DEFAULT_SYSTEM_PROMPT } from "@/lib/config";
import type { Database } from "@/lib/supabase/types";

type Config = Database["public"]["Tables"]["manifestation_training_config"]["Row"];
type Doc = Database["public"]["Tables"]["manifestation_training_documents"]["Row"];

export function buildCoachSystemPrompt(config: Config | null, docs: Doc[]) {
  const active = config ?? {
    id: "default",
    tone: DEFAULT_STYLE.tone,
    response_length: DEFAULT_STYLE.response_length,
    personality_traits: DEFAULT_STYLE.personality_traits,
    custom_instructions: DEFAULT_STYLE.custom_instructions,
    methodology: "hybrid",
    banned_phrases: [],
    qa_pairs: [],
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    updated_at: new Date().toISOString()
  };

  const knowledge = docs
    .filter((doc) => doc.extracted_text)
    .slice(0, 8)
    .map((doc) => `Source: ${doc.file_name}\n${doc.extracted_text?.slice(0, 6000)}`)
    .join("\n\n---\n\n");

  return `${active.system_prompt}

Owner configuration:
- Tone: ${active.tone}
- Response length: ${active.response_length}
- Personality traits: ${active.personality_traits.join(", ") || "supportive"}
- Preferred methodology: ${active.methodology || "hybrid"}
- Custom instructions: ${active.custom_instructions || "None"}
- Banned phrases/topics: ${active.banned_phrases.join(", ") || "None"}

Custom Q&A guidance:
${JSON.stringify(active.qa_pairs ?? [], null, 2)}

Uploaded knowledge excerpts:
${knowledge || "No uploaded knowledge has been indexed yet."}

Use uploaded knowledge when relevant, but do not mention internal file names unless asked. If a request conflicts with banned phrases/topics, redirect gently.`;
}
