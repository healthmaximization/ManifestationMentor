type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function askOpenRouter(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "AI Manifestation Advisor"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openrouter/owl-alpha",
      messages,
      temperature: 0.78
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "I could not generate a response yet.";
}
