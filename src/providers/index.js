import anthropic from "./anthropic.js";
import groq from "./groq.js";
import ollama from "./ollama.js";

const PROVIDERS = { anthropic, groq, ollama };

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

export function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) {
    throw new Error(
      `Unknown provider "${name}". Choices: ${PROVIDER_NAMES.join(", ")}`,
    );
  }
  return p;
}

export function resolveConfig(provider) {
  switch (provider.name) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing in .env");
      return {
        apiKey,
        model: process.env.ANTHROPIC_MODEL || provider.defaultModel,
      };
    }
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey)
        throw new Error(
          "GROQ_API_KEY missing in .env — get one free at https://console.groq.com",
        );
      return {
        apiKey,
        model: process.env.GROQ_MODEL || provider.defaultModel,
      };
    }
    case "ollama": {
      return {
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: process.env.OLLAMA_MODEL || provider.defaultModel,
      };
    }
    default:
      throw new Error(`No config resolver for provider "${provider.name}"`);
  }
}
