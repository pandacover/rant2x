import "server-only";

export const OPENROUTER_TRANSCRIBE_URL =
  "https://openrouter.ai/api/v1/audio/transcriptions";
export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export const STT_MODEL = "openai/whisper-large-v3-turbo";
export const PARAPHRASE_MODEL = "deepseek/deepseek-v4-flash-0731";

export const PARAPHRASE_SYSTEM_PROMPT = `Keep your language simple to read and easy to understand. Do not use em-dashes as they break reading flow. Every new section of your response should be in a new paragraph. Keep responses short; the reader has trouble focusing and cannot read large responses. Avoid using the “this is not x, this is y” pattern. Avoid making claims without verifying and validating first (for example do not say “most of x is y” without verification). Condense lines as much as possible but still be coherent.

You can change or add things where needed. Understand and preserve bullet points. Do not over-rephrase: only change wherever necessary.`;

const OPENROUTER_KEY_PATTERN = /sk-or-v1-[a-zA-Z0-9_-]+/gi;

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? key : null;
}

export function missingOpenRouterKeyMessage(): string {
  return "OpenRouter is not configured. Set OPENROUTER_API_KEY on the server.";
}

export function openRouterHeaders(
  apiKey: string,
  contentType?: string
): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "X-OpenRouter-Title": "Rant to X",
  };
  if (contentType) headers["Content-Type"] = contentType;

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) {
    headers["HTTP-Referer"] = host.startsWith("http") ? host : `https://${host}`;
  }

  return headers;
}

export function redactSecrets(text: string, apiKey?: string | null): string {
  let next = text;
  if (apiKey) next = next.split(apiKey).join("[redacted]");
  return next.replace(OPENROUTER_KEY_PATTERN, "[redacted]");
}

function messageFromOpenRouterBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

export function publicOpenRouterError(
  status: number,
  body: unknown,
  apiKey?: string | null
): string {
  if (status === 401 || status === 403) {
    return "OpenRouter key is missing or invalid.";
  }
  if (status === 402) {
    return "OpenRouter credits are exhausted.";
  }
  if (status === 413) {
    return "Audio is too large. Use a file under 25 MB.";
  }
  if (status === 429) {
    return "OpenRouter is rate-limiting. Try again shortly.";
  }

  const raw = messageFromOpenRouterBody(body);
  if (raw) {
    const safe = redactSecrets(raw, apiKey);
    if (safe.length <= 180 && !/bearer\s+/i.test(safe)) {
      return safe;
    }
  }

  return "OpenRouter failed. Try again.";
}

export async function readOpenRouterJson(
  response: Response
): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 180) };
  }
}

export function chatContentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("")
    .trim();
}
