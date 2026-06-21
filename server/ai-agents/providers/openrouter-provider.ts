import OpenAI from "openai";
import type { AIProvider, ChatMessage, ProviderResponse } from "./types.js";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://repo-doc-generator.app",
    "X-Title": "Repo-Doc-Generator",
  },
});

export const openrouterProvider: AIProvider = {
  name: "openrouter",

  async call(model, messages, options = {}) {
    const response = await openrouter.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned empty response");

    return { content, provider: "openrouter", model };
  },
};
