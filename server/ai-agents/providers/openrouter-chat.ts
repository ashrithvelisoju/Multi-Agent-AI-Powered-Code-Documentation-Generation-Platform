import Bytez from "bytez.js";

const OLLAMA_BASE_URL = "https://api.ollama.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";

const bytez = new Bytez(process.env.BYTEZ_API_KEY || "");

export interface ChatStreamMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Stream chat response using Ollama native API (qwen3-coder:480b-cloud).
 * Falls back to Bytez (non-streaming) if Ollama fails.
 */
export async function* streamChatResponse(
  messages: ChatStreamMessage[],
  model: string = "qwen3-coder:480b-cloud"
): AsyncGenerator<string, void, unknown> {
  try {
    yield* streamFromOllama(messages, model);
  } catch (err) {
    console.error("Ollama streaming failed, falling back to Bytez:", err);

    try {
      const content = await callBytezFallback(messages);
      // Yield word by word to simulate streaming
      const words = content.split(" ");
      for (const word of words) {
        yield word + " ";
      }
    } catch (bytezErr) {
      console.error("Bytez fallback also failed:", bytezErr);
      yield "Sorry, I'm unable to respond right now. Both AI providers are unavailable. Please try again later.";
    }
  }
}

async function* streamFromOllama(
  messages: ChatStreamMessage[],
  model: string
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY ? { "Authorization": `Bearer ${OLLAMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Ollama API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Ollama returned no response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const content = parsed.message?.content;
        if (content) {
          yield content;
        }
        if (parsed.done) {
          return;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.trim());
      const content = parsed.message?.content;
      if (content) {
        yield content;
      }
    } catch {
      // ignore
    }
  }
}

async function callBytezFallback(messages: ChatStreamMessage[]): Promise<string> {
  const bytezModel = bytez.model("Qwen/Qwen3-235B-A22B");
  const input = messages.map((m) => [m.role, m.content]);
  const result = await bytezModel.run(input, { max_new_tokens: 2048 });

  let content: string;
  if (typeof result === "object" && result !== null && "output" in result) {
    const output = (result as any).output;
    if ((result as any).error) {
      throw new Error(`Bytez error: ${(result as any).error}`);
    }
    if (typeof output === "string") {
      content = output;
    } else if (Array.isArray(output)) {
      const lastItem = output[output.length - 1];
      if (typeof lastItem === "object" && lastItem?.generated_text) {
        content = lastItem.generated_text;
      } else if (typeof lastItem === "string") {
        content = lastItem;
      } else {
        content = JSON.stringify(output);
      }
    } else if (typeof output === "object" && output?.generated_text) {
      content = output.generated_text;
    } else {
      content = JSON.stringify(output);
    }
  } else {
    content = String(result);
  }

  if (!content) throw new Error("Bytez returned empty response");
  return content;
}
