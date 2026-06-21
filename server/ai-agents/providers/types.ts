export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelConfig {
  provider: "groq" | "openrouter" | "bytez";
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResponse {
  content: string;
  provider: string;
  model: string;
}

export interface AIProvider {
  name: string;
  call(model: string, messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<ProviderResponse>;
}
