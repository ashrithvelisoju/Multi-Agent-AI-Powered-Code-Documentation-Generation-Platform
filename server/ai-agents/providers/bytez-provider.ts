import Bytez from "bytez.js";
import type { AIProvider, ChatMessage, ProviderResponse } from "./types.js";

const bytez = new Bytez(process.env.BYTEZ_API_KEY || "");

export const bytezProvider: AIProvider = {
  name: "bytez",

  async call(model, messages, options = {}) {
    const instance = bytez.model(model);

    const input = messages.map((m) => [m.role, m.content]);

    const params: Record<string, any> = {};
    if (options.temperature !== undefined) params.temperature = options.temperature;
    if (options.maxTokens !== undefined) params.max_new_tokens = options.maxTokens;

    const result = await instance.run(input, Object.keys(params).length > 0 ? params : undefined);

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

    return { content, provider: "bytez", model };
  },
};
