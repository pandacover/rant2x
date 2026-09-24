"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  ClipboardCopyIcon,
  CopyIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatArticleForClipboard } from "@/lib/article";
import { usePublishDraft } from "@/hooks/use-publish-draft";
import {
  articlesDestinationHostname,
  CLIPBOARD_PREVIEW_CHARS,
  copyTextToClipboard,
  openXArticles,
  truncateClipboardPreview,
  X_ARTICLES_COMPOSE_URL,
} from "@/lib/post-to-x";

export function PublishContinue() {
  const { ready, draft } = usePublishDraft();
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedFallback, setCopiedFallback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clipboardText = useMemo(() => {
    if (!draft) return "";
    return formatArticleForClipboard(draft.title, draft.body);
  }, [draft]);

  const hostname = articlesDestinationHostname();
  const preview = useMemo(
    () => (clipboardText ? truncateClipboardPreview(clipboardText) : ""),
    [clipboardText]
  );

  async function copyWithSelectableFallback(text: string): Promise<boolean> {
    if (await copyTextToClipboard(text)) return true;

    const node = textareaRef.current;
    if (!node) return false;
    node.focus();
    node.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }

  async function handleCopyAndContinue() {
    if (!clipboardText) return;
    setBusy(true);
    const copied = await copyTextToClipboard(clipboardText);
    if (!copied) {
      setFallback(true);
      setBusy(false);
      return;
    }
    openXArticles();
  }

  async function handleCopyFallback() {
    const ok = await copyWithSelectableFallback(clipboardText);
    if (ok) {
      setCopiedFallback(true);
      toast.success("Article copied");
      return;
    }
    toast.error("Select the text and copy it manually.");
  }

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 md:py-12">
        <div className="space-y-3" aria-busy="true" aria-label="Loading draft">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 md:py-12">
        <Card>
          <CardHeader>
            <CardTitle>No draft on this tab</CardTitle>
            <CardDescription>
              Article text is kept in this tab only (not in the URL), so a
              refresh after closing the studio or a new tab won’t have it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircleIcon />
              <AlertTitle>Start from the studio</AlertTitle>
              <AlertDescription>
                Write a title and body, then tap Post on X. That stores the
                draft here and brings you to Copy &amp; continue.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button asChild size="lg">
              <Link href="/">Back to studio</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Ready to post
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Copy &amp; continue
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This step copies your article, then opens{" "}
          <span className="font-medium text-foreground">{hostname}</span> so
          you can paste in the Articles editor.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Destination</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{hostname}</span>
            <span className="text-muted-foreground">
              {" "}
              · {X_ARTICLES_COMPOSE_URL.replace(/^https:\/\//, "")}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Clipboard preview</p>
            <blockquote className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
              {preview}
            </blockquote>
            {clipboardText.length > CLIPBOARD_PREVIEW_CHARS ? (
              <p className="text-xs text-muted-foreground">
                {clipboardText.length.toLocaleString()} characters total
              </p>
            ) : null}
          </div>

          <Alert>
            <InfoIcon />
            <AlertTitle>Why this extra tap?</AlertTitle>
            <AlertDescription>
              Browsers block clipboard writes unless they happen in the same
              moment as a user gesture. Copy &amp; continue copies, then opens
              X Articles. There is no silent redirect and no X OAuth.
            </AlertDescription>
          </Alert>

          {fallback ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Clipboard was blocked</AlertTitle>
              <AlertDescription>
                Copy the full text below, then open Articles. Some browsers
                need a permission prompt or an https context.
              </AlertDescription>
            </Alert>
          ) : null}

          {fallback ? (
            <Textarea
              ref={textareaRef}
              readOnly
              value={clipboardText}
              aria-label="Article text to copy manually"
              className="min-h-48 resize-y font-mono text-sm leading-relaxed"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost" size="lg">
            <Link href="/">Back to draft</Link>
          </Button>
          {fallback ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleCopyFallback}
              >
                {copiedFallback ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copiedFallback ? "Copied" : "Copy text"}
              </Button>
              <Button type="button" size="lg" onClick={openXArticles}>
                <ExternalLinkIcon data-icon="inline-start" />
                Open Articles
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={handleCopyAndContinue}
              disabled={busy || !clipboardText}
            >
              <ClipboardCopyIcon data-icon="inline-start" />
              {busy ? "Opening…" : "Copy & continue"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
