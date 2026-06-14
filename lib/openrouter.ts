type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AskOpenRouterOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
};

export async function askOpenRouter(messages: ChatMessage[], options: AskOpenRouterOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const attempts = Math.max(1, (options.retries ?? 0) + 1);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = windowlessSetTimeout(() => controller.abort(), options.timeoutMs ?? 25000);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": "AI Manifestation Advisor"
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? "openrouter/owl-alpha",
          messages,
          temperature: options.temperature ?? 0.78,
          max_tokens: options.maxTokens
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${text.slice(0, 500)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() ?? "I could not generate a response yet.";
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed.");
}

function windowlessSetTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}
