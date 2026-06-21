import Groq from "groq-sdk";
import type { AIProvider, ChatMessage, ProviderResponse } from "./types.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const groqProvider: AIProvider = {
  name: "groq",

  async call(model, messages, options = {}) {
    const response = await groq.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.5,
      max_completion_tokens: options.maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Groq returned empty response");

    return { content, provider: "groq", model };
  },
};
