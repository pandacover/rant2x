export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const AUDIO_ACCEPT =
  "audio/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.oga,.flac,.mpeg,.mpga,.aac";

const AUDIO_EXTENSIONS = new Set([
  "webm",
  "mp3",
  "mp4",
  "m4a",
  "wav",
  "ogg",
  "oga",
  "flac",
  "mpeg",
  "mpga",
  "aac",
]);

export function mergeTranscript(current: string, next: string): string {
  const a = current.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

export function extensionFromMime(mime: string): string | null {
  const type = mime.toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) {
    return "m4a";
  }
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg") || type.includes("oga")) return "ogg";
  if (type.includes("flac")) return "flac";
  if (type.includes("webm")) return "webm";
  return null;
}

export function audioFilename(file: File): string {
  const name = file.name?.trim() || "rant";
  const base = name.split(/[/\\]/).pop() || "rant";
  if (base.includes(".")) return base.slice(0, 180);
  const ext = extensionFromMime(file.type) ?? "webm";
  return `${base.slice(0, 120)}.${ext}`;
}

export function isAllowedAudioFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("audio/")) return true;
  if (mime === "video/webm" || mime === "video/mp4") return true;
  const ext = audioFilename(file).split(".").pop()?.toLowerCase();
  return Boolean(ext && AUDIO_EXTENSIONS.has(ext));
}
