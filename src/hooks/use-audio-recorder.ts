"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStartError =
  | "unsupported"
  | "permission"
  | "no-mic"
  | "start-failed";

const MAX_RECORDING_MS = 5 * 60 * 1000;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function extensionForMime(mime: string): string {
  const type = mime.toLowerCase();
  if (type.includes("mp4") || type.includes("aac") || type.includes("m4a")) {
    return "m4a";
  }
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}

function recorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function useAudioRecorder(onAutoStop?: (blob: Blob | null) => void) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const limitTimerRef = useRef<number | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (limitTimerRef.current !== null) {
      window.clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(
    (blob: Blob | null) => {
      clearTimers();
      cleanupStream();
      recorderRef.current = null;
      setRecording(false);
      stopResolverRef.current?.(blob);
      stopResolverRef.current = null;
    },
    [cleanupStream, clearTimers]
  );

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      finishRecording(null);
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      try {
        if (recorder.state === "recording") recorder.requestData();
        recorder.stop();
      } catch {
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeRef.current })
            : null;
        finishRecording(blob);
      }
    });
  }, [finishRecording]);

  const start = useCallback(async () => {
    if (!recorderSupported()) {
      return { ok: false as const, error: "unsupported" as const };
    }

    if (recorderRef.current) {
      await stop();
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return { ok: false as const, error: "permission" as const };
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        return { ok: false as const, error: "no-mic" as const };
      }
      return { ok: false as const, error: "start-failed" as const };
    }

    const mime = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      return { ok: false as const, error: "start-failed" as const };
    }

    chunksRef.current = [];
    mimeRef.current = recorder.mimeType || mime || "audio/webm";
    streamRef.current = stream;
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      finishRecording(null);
    };

    recorder.onstop = () => {
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: mimeRef.current })
          : new Blob([], { type: mimeRef.current });
      finishRecording(blob);
    };

    try {
      recorder.start(1000);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      streamRef.current = null;
      setRecording(false);
      return { ok: false as const, error: "start-failed" as const };
    }

    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);

    limitTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const blob = await stop();
        onAutoStopRef.current?.(blob);
      })();
    }, MAX_RECORDING_MS);

    return { ok: true as const };
  }, [finishRecording, stop]);

  useEffect(() => {
    setSupported(recorderSupported());
    return () => {
      clearTimers();
      cleanupStream();
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, [cleanupStream, clearTimers]);

  return {
    supported,
    recording,
    elapsedMs,
    start,
    stop,
  };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
