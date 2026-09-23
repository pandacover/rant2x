export type ArticleDraft = {
  title: string;
  body: string;
};

const FILLER = /\b(?:um+|uh+|erm+|hmm+)\b[,.]?/gi;

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

function titleFromLead(lead: string): string {
  const withoutPunct = lead.replace(/[.!?]+$/g, "").trim();
  const words = withoutPunct.split(/\s+/).filter(Boolean);
  const clipped = words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : withoutPunct;
  if (!clipped) return "A rant, rewritten";
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function paragraphize(sentences: string[]): string {
  if (sentences.length === 0) return "";
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    chunks.push(sentences.slice(i, i + 3).join(" "));
  }
  return chunks.join("\n\n");
}

/** Deterministic fallback used when no AI key is configured. */
export function demoRewrite(rant: string): ArticleDraft {
  const cleaned = rant.replace(FILLER, " ").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(cleaned);
  const title = titleFromLead(sentences[0] ?? cleaned);
  const bodySentences = sentences.length > 1 ? sentences.slice(1) : sentences;
  const body = paragraphize(bodySentences);

  return {
    title,
    body:
      body ||
      "This rant needs a little more raw material. Add another sentence or two, then try again.",
  };
}

export function formatArticleForClipboard(title: string, body: string): string {
  return `${title.trim()}\n\n${body.trim()}`.trim();
}
