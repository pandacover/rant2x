import { openai } from "@ai-sdk/openai";

export function hasAiCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);
}

export function getRewriteModel() {
  if (process.env.AI_GATEWAY_API_KEY) {
    return "openai/gpt-5.4";
  }
  return openai("gpt-5.4");
}
