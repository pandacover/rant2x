"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText(
  currentText: string,
  onText: (next: string) => void,
  onError?: (message: string) => void
) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const prefixRef = useRef("");
  const finalRef = useRef("");
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  const currentTextRef = useRef(currentText);

  onTextRef.current = onText;
  onErrorRef.current = onError;
  currentTextRef.current = currentText;

  useEffect(() => {
    setSupported(getSpeechCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return { ok: false as const, error: "unsupported" as const };

    recognitionRef.current?.stop();

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    prefixRef.current = currentTextRef.current.trim();
    finalRef.current = "";
    listeningRef.current = true;
    setListening(true);

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalRef.current = `${finalRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      const next = [prefixRef.current, finalRef.current, interim.trim()]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      onTextRef.current(next);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      listeningRef.current = false;
      setListening(false);
      if (event.error === "not-allowed") {
        onErrorRef.current?.("Microphone permission denied. Paste or type instead.");
        return;
      }
      onErrorRef.current?.("Voice capture hit an error. Paste or type instead.");
    };

    recognition.onend = () => {
      if (!listeningRef.current) return;
      try {
        recognition.start();
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return { ok: true as const };
    } catch {
      listeningRef.current = false;
      setListening(false);
      return { ok: false as const, error: "start-failed" as const };
    }
  }, []);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { supported, listening, start, stop };
}
