/**
 * X does not document an Articles compose intent that accepts title/body
 * query params. The web editor lives at /compose/articles and is filled
 * by pasting. Tweet intents (`/intent/post?text=`) prefill short posts only.
 */
export const X_ARTICLES_COMPOSE_URL = "https://x.com/compose/articles";

export async function copyAndOpenXArticles(text: string): Promise<{
  copied: boolean;
  opened: boolean;
}> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = false;
  }

  const popup = window.open(X_ARTICLES_COMPOSE_URL, "_blank", "noopener,noreferrer");
  return { copied, opened: popup !== null };
}
