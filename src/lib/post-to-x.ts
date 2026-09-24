/**
 * X does not document an Articles compose intent that accepts title/body
 * query params. The web editor lives at /compose/articles and is filled
 * by pasting. Tweet intents (`/intent/post?text=`) prefill short posts only.
 */
export const X_ARTICLES_COMPOSE_URL = "https://x.com/compose/articles";
export const CLIPBOARD_PREVIEW_CHARS = 280;

export function articlesDestinationHostname(
  url = X_ARTICLES_COMPOSE_URL
): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "x.com";
  }
}

export function truncateClipboardPreview(
  text: string,
  max = CLIPBOARD_PREVIEW_CHARS
): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function openXArticles(): void {
  window.location.assign(X_ARTICLES_COMPOSE_URL);
}
