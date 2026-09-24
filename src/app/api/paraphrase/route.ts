import { z } from "zod";
import {
  chatContentToText,
  getOpenRouterApiKey,
  missingOpenRouterKeyMessage,
  OPENROUTER_CHAT_URL,
  openRouterHeaders,
  PARAPHRASE_MODEL,
  PARAPHRASE_SYSTEM_PROMPT,
  publicOpenRouterError,
  readOpenRouterJson,
} from "@/lib/openrouter";

export const maxDuration = 60;

const requestSchema = z.object({
  text: z.string().trim().min(1, "Draft text is required").max(20_000),
});

export async function POST(request: Request) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return Response.json({ error: missingOpenRouterKeyMessage() }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json(
      { error: "Send JSON with a text string." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid draft text." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey, "application/json"),
      body: JSON.stringify({
        model: PARAPHRASE_MODEL,
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: "system", content: PARAPHRASE_SYSTEM_PROMPT },
          { role: "user", content: parsed.data.text },
        ],
      }),
    });
    const body = await readOpenRouterJson(response);

    if (!response.ok) {
      return Response.json(
        { error: publicOpenRouterError(response.status, body, apiKey) },
        { status: response.status === 401 ? 503 : 502 }
      );
    }

    const choices = (body as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? choices[0] : null;
    const content =
      first && typeof first === "object"
        ? (first as { message?: { content?: unknown } }).message?.content
        : undefined;
    const text = chatContentToText(content);

    if (!text) {
      return Response.json(
        { error: "The model returned empty text. Try again." },
        { status: 502 }
      );
    }

    return Response.json({ text });
  } catch {
    return Response.json(
      { error: "Could not reach OpenRouter. Try again." },
      { status: 502 }
    );
  }
}
