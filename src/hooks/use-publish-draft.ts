"use client";

import { useSyncExternalStore } from "react";
import {
  loadPublishDraft,
  subscribePublishDraft,
  type PublishDraft,
} from "@/lib/publish-draft";

function noopSubscribe() {
  return () => {};
}

/** False during SSR/hydration, true once the client snapshot is used. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function usePublishDraft(): {
  ready: boolean;
  draft: PublishDraft | null;
} {
  const ready = useIsClient();
  const draft = useSyncExternalStore(
    subscribePublishDraft,
    loadPublishDraft,
    () => null
  );
  return { ready, draft };
}
