type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AskGeminiOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
};

export async function askGemini(messages: ChatMessage[], options: AskGeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY.");
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30000;
  const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const systemInstruction = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n")
      .trim();
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.72,
          maxOutputTokens: options.maxTokens
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error ${response.status}: ${text.slice(0, 500)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    return text || "I could not generate a response yet.";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The AI took too long to respond. Please try again.");
    }

    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
