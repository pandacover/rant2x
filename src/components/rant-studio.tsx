"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MicIcon,
  SparklesIcon,
  SquareIcon,
  UploadIcon,
  WandSparklesIcon,
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
import {
  extensionForMime,
  formatElapsed,
  useAudioRecorder,
} from "@/hooks/use-audio-recorder";
import { usePublishDraft } from "@/hooks/use-publish-draft";
import { formatArticleForClipboard } from "@/lib/article";
import {
  AUDIO_ACCEPT,
  audioFilename,
  isAllowedAudioFile,
  MAX_AUDIO_BYTES,
  mergeTranscript,
} from "@/lib/audio";
import { savePublishDraft } from "@/lib/publish-draft";

type Draft = {
  title: string;
  body: string;
  demo: boolean;
};

type ApiTextResponse = {
  text?: string;
  error?: string;
};

export function RantStudio() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ready, draft: stored } = usePublishDraft();
  const [rant, setRant] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [paraphrasing, setParaphrasing] = useState<"rant" | "body" | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [paraphraseError, setParaphraseError] = useState<{
    target: "rant" | "body";
    message: string;
  } | null>(null);
  const [appliedStore, setAppliedStore] = useState(false);
  const transcribeRecordingRef = useRef<(blob: Blob | null) => Promise<void>>(
    async () => {}
  );

  const { supported, recording, elapsedMs, start, stop } = useAudioRecorder(
    (blob) => {
      toast.message("Recording hit the 5 minute limit");
      void transcribeRecordingRef.current(blob);
    }
  );

  if (ready && !appliedStore) {
    setAppliedStore(true);
    if (stored) {
      setDraft({
        title: stored.title,
        body: stored.body,
        demo: stored.demo ?? false,
      });
      if (stored.rant) setRant(stored.rant);
    }
  }

  const busy = rewriting || transcribing || paraphrasing !== null || recording;
  const canRewrite = rant.trim().length > 0 && !busy;
  const canParaphraseRant = rant.trim().length > 0 && !busy;
  const canParaphraseBody = Boolean(draft?.body.trim()) && !busy;
  const canPost = Boolean(draft?.title.trim() && draft?.body.trim());
  const wordCount = useMemo(
    () => rant.trim().split(/\s+/).filter(Boolean).length,
    [rant]
  );

  async function transcribeFile(file: File) {
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const form = new FormData();
      form.append("file", file, audioFilename(file));
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as ApiTextResponse;
      if (!response.ok || !data.text?.trim()) {
        throw new Error(data.error || "Transcription failed");
      }
      setRant((current) => mergeTranscript(current, data.text!));
      toast.success("Transcript added to your rant");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not transcribe audio.";
      setTranscribeError(message);
      toast.error(message);
    } finally {
      setTranscribing(false);
    }
  }

  async function transcribeRecording(blob: Blob | null) {
    if (!blob || blob.size <= 0) {
      const message = "Recording was empty. Try again.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }
    if (blob.size > MAX_AUDIO_BYTES) {
      const message = "Audio is too large. Use a file under 25 MB.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }
    const filename = `rant.${extensionForMime(blob.type)}`;
    await transcribeFile(
      new File([blob], filename, { type: blob.type || "audio/webm" })
    );
  }
  transcribeRecordingRef.current = transcribeRecording;

  async function handleMic() {
    if (recording) {
      const blob = await stop();
      await transcribeRecording(blob);
      return;
    }

    const result = await start();
    if (!result.ok) {
      const message =
        result.error === "unsupported"
          ? "Recording isn’t available in this browser. Upload a file or type instead."
          : result.error === "permission"
            ? "Microphone permission denied. Upload a file or type instead."
            : result.error === "no-mic"
              ? "No microphone found. Upload a file or type instead."
              : "Couldn’t start the microphone. Check permissions and try again.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }
    toast.message("Recording… tap Stop when you’re done");
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!isAllowedAudioFile(file)) {
      const message = "Use mp3, wav, webm, m4a, ogg, or flac audio.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }
    if (file.size <= 0) {
      const message = "Audio file is empty.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      const message = "Audio is too large. Use a file under 25 MB.";
      setTranscribeError(message);
      toast.error(message);
      return;
    }

    await transcribeFile(file);
  }

  async function paraphraseText(text: string): Promise<string> {
    const response = await fetch("/api/paraphrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    const data = (await response.json()) as ApiTextResponse;
    if (!response.ok || !data.text?.trim()) {
      throw new Error(data.error || "Paraphrase failed");
    }
    return data.text.trim();
  }

  async function handleParaphraseRant() {
    if (!canParaphraseRant) return;
    setParaphrasing("rant");
    setParaphraseError(null);
    try {
      const next = await paraphraseText(rant);
      setRant(next);
      toast.success("Rant paraphrased");
    } catch (error) {
      setParaphraseError({
        target: "rant",
        message:
          error instanceof Error ? error.message : "Could not paraphrase the rant.",
      });
      toast.error(
        error instanceof Error ? error.message : "Could not paraphrase the rant."
      );
    } finally {
      setParaphrasing(null);
    }
  }

  async function handleParaphraseBody() {
    if (!draft || !canParaphraseBody) return;
    setParaphrasing("body");
    setParaphraseError(null);
    try {
      const next = await paraphraseText(draft.body);
      setDraft({ ...draft, body: next });
      toast.success("Draft paraphrased");
    } catch (error) {
      setParaphraseError({
        target: "body",
        message:
          error instanceof Error
            ? error.message
            : "Could not paraphrase the draft.",
      });
      toast.error(
        error instanceof Error ? error.message : "Could not paraphrase the draft."
      );
    } finally {
      setParaphrasing(null);
    }
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

  function handlePostOnX() {
    if (!draft || !canPost) return;
    try {
      savePublishDraft({
        title: draft.title,
        body: draft.body,
        rant,
        demo: draft.demo,
      });
    } catch {
      toast.error(
        "Couldn’t store the draft for publish. Use Copy, then open X Articles."
      );
      return;
    }
    router.push("/publish");
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
          Record or upload audio. We transcribe it into your rant. Paraphrase
          lightly if you want, then turn it into an X Article. Post on X copies
          the article and opens X Articles so you can paste.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Your rant</CardTitle>
              <CardDescription>
                Record, upload audio, or type. Whisper transcribes on the
                server. Paraphrase cleans the draft without turning it into an
                article.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {recording ? <Badge variant="destructive">Recording</Badge> : null}
              {transcribing ? <Badge variant="secondary">Transcribing</Badge> : null}
              {supported === false ? (
                <Badge variant="outline">Mic unavailable</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {supported === false ? (
            <Alert>
              <AlertCircleIcon />
              <AlertTitle>This browser can’t record audio</AlertTitle>
              <AlertDescription>
                Upload an audio file or type your rant below. The rest of the
                flow still works.
              </AlertDescription>
            </Alert>
          ) : null}

          {transcribeError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Transcription failed</AlertTitle>
              <AlertDescription>{transcribeError}</AlertDescription>
            </Alert>
          ) : null}

          {paraphraseError?.target === "rant" ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Paraphrase failed</AlertTitle>
              <AlertDescription>{paraphraseError.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="lg"
              variant={recording ? "destructive" : "default"}
              onClick={handleMic}
              disabled={supported === false || transcribing || paraphrasing !== null}
              aria-pressed={recording}
            >
              {recording ? (
                <SquareIcon data-icon="inline-start" />
              ) : transcribing ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <MicIcon data-icon="inline-start" />
              )}
              {recording ? "Stop" : transcribing ? "Transcribing" : "Record"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <UploadIcon data-icon="inline-start" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              className="sr-only"
              aria-label="Upload audio to transcribe"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            {recording ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
                </span>
                {formatElapsed(elapsedMs)} · tap Stop to transcribe
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
              readOnly={recording || transcribing}
              placeholder={
                supported === false
                  ? "Upload audio or paste the rant you want turned into an article…"
                  : "Hit Record, upload audio, or paste a rant here…"
              }
              className="min-h-40 resize-y text-base md:min-h-48"
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Audio and paraphrase run on the server. We don’t save rants.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleParaphraseRant}
              disabled={!canParaphraseRant}
            >
              {paraphrasing === "rant" ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <WandSparklesIcon data-icon="inline-start" />
              )}
              Paraphrase
            </Button>
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
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Article draft</CardTitle>
              <CardDescription>
                Edit freely. Paraphrase lightly cleans the body. Post on X
                opens a confirmation page — one more tap copies the article and
                opens X Articles for paste.
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

          {!rewriting && paraphraseError?.target === "body" ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Paraphrase failed</AlertTitle>
              <AlertDescription>{paraphraseError.message}</AlertDescription>
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
        <CardFooter className="flex-col items-stretch gap-3">
          <p className="text-xs text-muted-foreground">
            Copy stays on this page. Post on X asks you to copy, then opens
            Articles.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleParaphraseBody}
              disabled={!canParaphraseBody}
            >
              {paraphrasing === "body" ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <WandSparklesIcon data-icon="inline-start" />
              )}
              Paraphrase
            </Button>
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
              <ExternalLinkIcon data-icon="inline-start" />
              Post on X
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
