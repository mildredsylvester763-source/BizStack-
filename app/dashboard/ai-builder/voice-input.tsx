"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export default function VoiceInput({ onTranscript, disabled = false }: Props) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const recognition = useRef<any>(null);
  const finalText = useRef("");

  useEffect(() => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(Boolean(Speech));
    return () => {
      try { recognition.current?.abort?.(); } catch {}
    };
  }, []);

  function start() {
    if (disabled || active) return;
    setError("");
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setSupported(false);
      setError("Voice dictation is not supported in this browser.");
      return;
    }

    try {
      const r = new Speech();
      r.lang = "en-NG";
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      finalText.current = "";

      r.onstart = () => setActive(true);
      r.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || "";
        }
        transcript = transcript.trim();
        if (transcript) {
          finalText.current = transcript;
          onTranscript(transcript);
        }
      };
      r.onerror = (event: any) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          setError("Microphone permission is blocked. Allow microphone access and try again.");
        } else if (event?.error !== "aborted" && event?.error !== "no-speech") {
          setError("Voice input could not start. Try again.");
        }
        setActive(false);
        recognition.current = null;
      };
      r.onend = () => {
        setActive(false);
        recognition.current = null;
      };

      recognition.current = r;
      r.start();
    } catch {
      setActive(false);
      recognition.current = null;
      setError("Voice input could not start. Try again.");
    }
  }

  function stop() {
    try { recognition.current?.stop?.(); } catch {}
    recognition.current = null;
    setActive(false);
  }

  return (
    <div className="relative shrink-0">
      {active && (
        <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 flex items-center gap-2 rounded-full border border-indigo-300/15 bg-[#171a21]/95 px-3 py-2 shadow-[0_12px_35px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <span className="flex items-center gap-[2px] h-3">
            {[0,1,2,3,4].map((i) => (
              <span key={i} className="w-[2px] rounded-full bg-indigo-300 animate-pulse" style={{ height: (7 + (i % 3) * 3) + "px", animationDelay: (i * 90) + "ms" }} />
            ))}
          </span>
          <span className="text-[8px] text-white/60 whitespace-nowrap">Listening…</span>
          <button type="button" onClick={stop} className="text-[8px] text-white/35 hover:text-white/70">Stop</button>
        </div>
      )}

      {error && (
        <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 max-w-[250px] rounded-xl border border-red-300/10 bg-[#171217]/95 px-3 py-2 text-[8px] leading-4 text-red-100/65 shadow-xl">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => active ? stop() : start()}
        disabled={disabled}
        aria-label={active ? "Stop voice input" : "Dictate a message"}
        title={active ? "Stop voice input" : supported === false ? "Voice input unavailable" : "Dictate with microphone"}
        className={[
          "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-150",
          active
            ? "border-indigo-300/30 bg-indigo-400/15 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,.18)]"
            : "border-transparent bg-white/[.045] text-white/40 hover:border-white/[.08] hover:bg-white/[.075] hover:text-white/70",
          disabled ? "opacity-30 cursor-not-allowed" : ""
        ].join(" ")}
      >
        {active && <span className="absolute inset-0 rounded-xl border border-indigo-300/20 animate-ping opacity-20" />}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="relative h-[17px] w-[17px] fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="3" width="8" height="12" rx="4" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </button>
    </div>
  );
}
