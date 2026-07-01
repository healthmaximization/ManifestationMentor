type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AskOpenRouterOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
  models?: string[];
  includeConfiguredModel?: boolean;
  includeDefaultFallbacks?: boolean;
};

const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-coder:free";
const OPENROUTER_MODEL_FALLBACKS = [DEFAULT_OPENROUTER_MODEL, "nvidia/nemotron-3-ultra-550b-a55b:free"];

export async function askOpenRouter(messages: ChatMessage[], options: AskOpenRouterOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const attempts = Math.max(1, (options.retries ?? 0) + 1);
  const modelCandidates = getOpenRouterModelCandidates(
    options.models,
    options.includeConfiguredModel ?? true,
    options.includeDefaultFallbacks ?? true
  );
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const model of modelCandidates) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 45000;
      const timeout = timeoutMs > 0 ? windowlessSetTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
            "X-Title": "Subliminal Academy"
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.78,
            max_tokens: options.maxTokens
          })
        });

        if (!response.ok) {
          const text = await response.text();
          lastError = new Error(`OpenRouter error ${response.status} for ${model}: ${text.slice(0, 500)}`);

          if (shouldTryNextModel(response.status, text) && model !== modelCandidates[modelCandidates.length - 1]) {
            continue;
          }

          throw lastError;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() ?? "I could not generate a response yet.";
      } catch (error) {
        lastError = error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("The AI took too long to respond. Please try again.");
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed.");
}

function getOpenRouterModelCandidates(
  preferredModels: string[] = [],
  includeConfiguredModel: boolean,
  includeDefaultFallbacks: boolean
) {
  const configuredModels =
    includeConfiguredModel
      ? process.env.OPENROUTER_MODEL?.split(",")
          .map((model) => model.trim())
          .filter(Boolean) ?? []
      : [];
  const fallbackModels = includeDefaultFallbacks ? OPENROUTER_MODEL_FALLBACKS : [];

  return [...new Set([...preferredModels, ...configuredModels, ...fallbackModels])];
}

function shouldTryNextModel(status: number, responseText: string) {
  const normalizedText = responseText.toLowerCase();

  return (
    (status === 404 && normalizedText.includes("no endpoints found")) ||
    status === 402 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

function windowlessSetTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}
