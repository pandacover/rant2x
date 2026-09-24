export type PublishDraft = {
  title: string;
  body: string;
  /** Optional so Back to studio can restore the transcript. */
  rant?: string;
  demo?: boolean;
};

/** Tab-scoped; never put article bodies in the URL. */
export const PUBLISH_DRAFT_STORAGE_KEY = "rant2x:publish-draft";

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedDraft: PublishDraft | null = null;

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function emitPublishDraftChange() {
  for (const listener of listeners) listener();
}

function parsePublishDraft(raw: string | null): PublishDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as PublishDraft).title !== "string" ||
      typeof (parsed as PublishDraft).body !== "string"
    ) {
      return null;
    }
    const title = (parsed as PublishDraft).title;
    const body = (parsed as PublishDraft).body;
    if (!title.trim() || !body.trim()) return null;
    const rant = (parsed as PublishDraft).rant;
    const demo = (parsed as PublishDraft).demo;
    return {
      title,
      body,
      rant: typeof rant === "string" ? rant : undefined,
      demo: typeof demo === "boolean" ? demo : undefined,
    };
  } catch {
    return null;
  }
}

export function savePublishDraft(draft: PublishDraft): void {
  const store = sessionStore();
  if (!store) {
    throw new Error("sessionStorage is unavailable in this browser.");
  }
  const raw = JSON.stringify({
    title: draft.title,
    body: draft.body,
    rant: draft.rant,
    demo: draft.demo,
  });
  store.setItem(PUBLISH_DRAFT_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedDraft = parsePublishDraft(raw);
  emitPublishDraftChange();
}

export function loadPublishDraft(): PublishDraft | null {
  const store = sessionStore();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(PUBLISH_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedDraft;
  cachedRaw = raw;
  cachedDraft = parsePublishDraft(raw);
  return cachedDraft;
}

export function subscribePublishDraft(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onStoreChange);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (
      event.key !== PUBLISH_DRAFT_STORAGE_KEY &&
      event.key !== null
    ) {
      return;
    }
    cachedRaw = undefined;
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}
