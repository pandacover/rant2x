import {
  audioFilename,
  isAllowedAudioFile,
  MAX_AUDIO_BYTES,
} from "@/lib/audio";
import {
  getOpenRouterApiKey,
  missingOpenRouterKeyMessage,
  OPENROUTER_TRANSCRIBE_URL,
  openRouterHeaders,
  publicOpenRouterError,
  readOpenRouterJson,
  STT_MODEL,
} from "@/lib/openrouter";

export const maxDuration = 60;

function transcriptFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const text = (body as { text?: unknown }).text;
  if (typeof text === "string") return text.trim();
  return "";
}

export async function POST(request: Request) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return Response.json({ error: missingOpenRouterKeyMessage() }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "Send audio as multipart form data with a file field." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Attach an audio file in the file field." },
      { status: 400 }
    );
  }

  if (file.size <= 0) {
    return Response.json({ error: "Audio file is empty." }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "Audio is too large. Use a file under 25 MB." },
      { status: 413 }
    );
  }

  if (!isAllowedAudioFile(file)) {
    return Response.json(
      { error: "Use mp3, wav, webm, m4a, ogg, or flac audio." },
      { status: 400 }
    );
  }

  const filename = audioFilename(file);
  const upstream = new FormData();
  upstream.append("file", file, filename);
  upstream.append("model", STT_MODEL);
  upstream.append("response_format", "json");

  try {
    const response = await fetch(OPENROUTER_TRANSCRIBE_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: upstream,
    });
    const body = await readOpenRouterJson(response);

    if (!response.ok) {
      return Response.json(
        { error: publicOpenRouterError(response.status, body, apiKey) },
        { status: response.status === 401 ? 503 : 502 }
      );
    }

    const text = transcriptFromBody(body);
    if (!text) {
      return Response.json(
        { error: "No speech detected. Try a clearer clip." },
        { status: 422 }
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
