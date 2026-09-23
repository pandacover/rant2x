"use client";

import { useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MicIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { formatArticleForClipboard } from "@/lib/article";
import { copyAndOpenXArticles, X_ARTICLES_COMPOSE_URL } from "@/lib/post-to-x";

type Draft = {
  title: string;
  body: string;
  demo: boolean;
};

export function RantStudio() {
  const [rant, setRant] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const { supported, listening, start, stop } = useSpeechToText(
    rant,
    setRant,
    (message) => toast.error(message)
  );

  const canRewrite = rant.trim().length > 0 && !rewriting;
  const canPost =
    Boolean(draft?.title.trim() && draft?.body.trim()) && !posting;
  const wordCount = useMemo(
    () => rant.trim().split(/\s+/).filter(Boolean).length,
    [rant]
  );

  async function handleMic() {
    if (listening) {
      stop();
      toast.success("Recording stopped");
      return;
    }
    const result = start();
    if (!result?.ok) {
      toast.error(
        result?.error === "unsupported"
          ? "Voice capture isn’t available in this browser. Paste or type instead."
          : "Couldn’t start the microphone. Check permissions and try again."
      );
      return;
    }
    toast.message("Listening… speak your rant");
  }

  async function handleRewrite() {
    if (!canRewrite) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rant: rant.trim() }),
      });
      const data = (await response.json()) as Draft & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Rewrite failed");
      }
      setDraft({
        title: data.title,
        body: data.body,
        demo: Boolean(data.demo),
      });
      toast.success(
        data.demo
          ? "Demo draft ready — add an AI key for a model rewrite"
          : "Article draft ready"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not rewrite the rant.";
      setRewriteError(message);
      toast.error(message);
    } finally {
      setRewriting(false);
    }
  }

  async function handleCopy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        formatArticleForClipboard(draft.title, draft.body)
      );
      toast.success("Article copied");
    } catch {
      toast.error("Clipboard blocked. Select the draft and copy manually.");
    }
  }

  async function handlePostOnX() {
    if (!draft || !canPost) return;
    setPosting(true);
    try {
      const text = formatArticleForClipboard(draft.title, draft.body);
      const { copied, opened } = await copyAndOpenXArticles(text);

      if (copied && opened) {
        toast.success("Paste in the Articles editor, then publish on X.");
        return;
      }
      if (copied && !opened) {
        toast.message("Article copied. Popup blocked — opening X Articles here.", {
          duration: 6000,
        });
        window.location.assign(X_ARTICLES_COMPOSE_URL);
        return;
      }
      if (!copied && opened) {
        toast.warning(
          "X Articles opened, but clipboard was blocked. Use Copy, then paste."
        );
        return;
      }
      toast.error("Couldn’t copy or open X. Copy the draft, then visit x.com/compose/articles.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Guest · no account
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Rant to X
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Speak (or paste) a rant. We turn it into a polished X Article you can
          edit, then open X’s Articles editor with the draft on your clipboard.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Your rant</CardTitle>
              <CardDescription>
                Record with the mic or type. The transcript is the source for
                the rewrite.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {listening ? (
                <Badge variant="destructive">Recording</Badge>
              ) : null}
              {supported === false ? (
                <Badge variant="outline">Voice unavailable</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {supported === false ? (
            <Alert>
              <AlertCircleIcon />
              <AlertTitle>This browser can’t capture speech</AlertTitle>
              <AlertDescription>
                Chrome, Edge, and Safari support the Web Speech API. Paste or
                type your rant below — the rest of the flow still works.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="lg"
              variant={listening ? "destructive" : "default"}
              onClick={handleMic}
              disabled={supported === false}
              aria-pressed={listening}
            >
              {listening ? (
                <SquareIcon data-icon="inline-start" />
              ) : (
                <MicIcon data-icon="inline-start" />
              )}
              {listening ? "Stop" : "Record"}
            </Button>
            {listening ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
                </span>
                Live transcript below
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {wordCount === 0
                  ? "Nothing captured yet"
                  : `${wordCount} word${wordCount === 1 ? "" : "s"}`}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rant">Transcript</Label>
            <Textarea
              id="rant"
              value={rant}
              onChange={(event) => setRant(event.target.value)}
              readOnly={listening}
              placeholder={
                supported === false
                  ? "Paste or type the rant you want turned into an article…"
                  : "Hit Record and talk, or paste a rant here…"
              }
              className="min-h-40 resize-y text-base md:min-h-48"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            We don’t save rants. Rewrite runs on the server only for this
            request.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={handleRewrite}
            disabled={!canRewrite}
          >
            {rewriting ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            Turn into article
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Article draft</CardTitle>
              <CardDescription>
                Edit freely. Post on X copies the draft and opens the Articles
                composer.
              </CardDescription>
            </div>
            {draft?.demo ? <Badge variant="secondary">Demo rewrite</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {rewriting ? (
            <div className="space-y-3" aria-busy="true" aria-label="Rewriting">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-2/3" />
            </div>
          ) : null}

          {!rewriting && rewriteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Rewrite failed</AlertTitle>
              <AlertDescription>{rewriteError}</AlertDescription>
            </Alert>
          ) : null}

          {!rewriting && !draft && !rewriteError ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No draft yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture a rant, then hit Turn into article. Title and body show
                up here for editing.
              </p>
            </div>
          ) : null}

          {!rewriting && draft ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  className="h-10 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  value={draft.body}
                  onChange={(event) =>
                    setDraft({ ...draft, body: event.target.value })
                  }
                  className="min-h-56 resize-y text-base leading-relaxed md:min-h-72"
                />
              </div>
            </>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Paste in the Articles editor, then publish on X.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCopy}
              disabled={!draft}
            >
              <CopyIcon data-icon="inline-start" />
              Copy
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handlePostOnX}
              disabled={!canPost}
            >
              {posting ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <ExternalLinkIcon data-icon="inline-start" />
              )}
              Post on X
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
