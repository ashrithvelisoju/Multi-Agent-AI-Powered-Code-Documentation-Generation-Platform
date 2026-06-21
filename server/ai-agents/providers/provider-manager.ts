import type { AIProvider, ChatMessage, ModelConfig, ProviderResponse } from "./types.js";
import { groqProvider } from "./groq-provider.js";
import { openrouterProvider } from "./openrouter-provider.js";
import { bytezProvider } from "./bytez-provider.js";

export type AgentName = "reader" | "searcher" | "writer" | "verifier" | "diagram";

interface AgentConfig {
  primary: ModelConfig;
  backup: ModelConfig;
}

const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  reader: {
    primary: { provider: "groq", model: "openai/gpt-oss-120b" },
    backup: { provider: "bytez", model: "openai/gpt-oss-20b" },
  },
  searcher: {
    primary: { provider: "openrouter", model: "qwen/qwen3-32b" },
    backup: { provider: "bytez", model: "Qwen/Qwen3-4B-Instruct-2507" },
  },
  writer: {
    primary: { provider: "groq", model: "llama-3.3-70b-versatile" },
    backup: { provider: "bytez", model: "meta-llama/Meta-Llama-3-8B" },
  },
  verifier: {
    primary: { provider: "groq", model: "llama-3.1-8b-instant" },
    backup: { provider: "bytez", model: "Qwen/Qwen3-4B-Thinking-2507" },
  },
  diagram: {
    primary: { provider: "openrouter", model: "qwen/qwen3-4b:free" },
    backup: { provider: "bytez", model: "Qwen/Qwen2-VL-2B-Instruct" },
  },
};

const providers: Record<string, AIProvider> = {
  groq: groqProvider,
  openrouter: openrouterProvider,
  bytez: bytezProvider,
};

export const providerManager = {
  async call(
    agentName: AgentName,
    messages: ChatMessage[],
    overrides?: { temperature?: number; maxTokens?: number }
  ): Promise<ProviderResponse> {
    const config = AGENT_CONFIGS[agentName];

    // Try primary provider
    try {
      const provider = providers[config.primary.provider];
      console.log(`[${agentName}] Calling primary: ${config.primary.provider}/${config.primary.model}`);

      return await provider.call(config.primary.model, messages, {
        temperature: overrides?.temperature ?? config.primary.temperature,
        maxTokens: overrides?.maxTokens ?? config.primary.maxTokens,
      });
    } catch (primaryError: any) {
      console.warn(
        `[${agentName}] Primary provider failed (${config.primary.provider}/${config.primary.model}): ${primaryError?.message || primaryError}`
      );
    }

    // Fallback to Bytez backup
    try {
      const provider = providers[config.backup.provider];
      console.log(`[${agentName}] Falling back to backup: ${config.backup.provider}/${config.backup.model}`);

      return await provider.call(config.backup.model, messages, {
        temperature: overrides?.temperature ?? config.backup.temperature,
        maxTokens: overrides?.maxTokens ?? config.backup.maxTokens,
      });
    } catch (backupError: any) {
      console.error(
        `[${agentName}] Backup provider also failed (${config.backup.provider}/${config.backup.model}): ${backupError?.message || backupError}`
      );
      throw new Error(
        `[${agentName}] All providers failed. Primary: ${config.primary.provider}/${config.primary.model}, Backup: ${config.backup.provider}/${config.backup.model}`
      );
    }
  },
};
