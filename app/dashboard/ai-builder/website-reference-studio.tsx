"use client";

import { useEffect, useRef, useState } from "react";

type Reference = {
  id: string;
  attachment_id: string;
  name: string;
  kind: string;
  summary: string;
  layout_observations?: string[];
  typography_observations?: string[];
  color_observations?: string[];
  component_observations?: string[];
  responsive_observations?: string[];
  implementation_guidance?: string[];
  generated_at: string;
  source?: string;
};

export default function WebsiteReferenceStudio({
  projectId,
  onAsk,
}: {
  projectId: string;
  onAsk: (prompt: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/reference-designs", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Reference designs could not be loaded.");
      setReferences(Array.isArray(data.references) ? data.references : []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Reference designs could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function uploadReference(file: File) {
    setBusy(true);
    setError("");
    setStatus("Uploading reference…");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const upload = await fetch("/api/assistant/attachments", { method: "POST", body: form });
      const uploaded = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploaded.attachment?.id) throw new Error(uploaded.error || "Reference upload failed.");

      setStatus("Analyzing visual reference…");
      const analysis = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/reference-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId: uploaded.attachment.id,
          instruction: "Extract useful layout, typography, color, component and responsive principles. Adapt the design language; do not copy the source."
        })
      });
      const result = await analysis.json().catch(() => ({}));
      if (!analysis.ok) throw new Error(result.error || "Reference analysis failed.");
      setReferences(Array.isArray(result.references) ? result.references : []);
      setOpen(true);
      setStatus("Reference analyzed.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Reference analysis failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-cyan-300/[.08] bg-cyan-300/[.018] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-300/[.07] border border-cyan-300/[.08] text-cyan-100 text-[9px]">▧</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] uppercase tracking-[.18em] text-white/25">Reference studio</span>
          <span className="block text-[8px] text-white/42 mt-0.5">{references.length} saved visual reference{references.length === 1 ? "" : "s"}</span>
        </span>
        <span className="text-white/20">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] p-3">
          <input
            ref={input}
            type="file"
            accept="image/*,.pdf,.docx,.txt,.md,.html"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void uploadReference(file);
            }}
          />

          <div className="rounded-2xl border border-dashed border-cyan-300/[.12] bg-cyan-300/[.025] p-4 text-center">
            <div className="text-[8px] uppercase tracking-[.18em] text-cyan-100/55">Reference → implementation context</div>
            <p className="text-[8px] leading-4 text-white/25 mt-2">Upload a screenshot or visual document. BizStack analyzes the observable design language and saves it beside the real project source.</p>
            <button onClick={() => input.current?.click()} disabled={busy} className="mt-3 rounded-xl bg-white text-black px-3 py-2 text-[8px] disabled:opacity-30">
              {busy ? "Working…" : "Add reference"}
            </button>
            {status && <div className="text-[7px] text-cyan-100/45 mt-2">{status}</div>}
          </div>

          {references.length > 0 && (
            <div className="mt-3 space-y-2">
              {references.slice(0, 6).map(reference => (
                <article key={reference.id} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] text-white/55 truncate">{reference.name}</div>
                      <div className="text-[6px] uppercase tracking-[.14em] text-cyan-100/45 mt-1">{reference.kind} · {reference.source || "reference"}</div>
                    </div>
                    <button onClick={() => onAsk("Use the saved reference design '" + reference.name + "' as visual implementation context. Preserve BizStack's own identity, do not copy the source, and show affected files and design-system changes before editing.")} className="shrink-0 rounded-lg bg-cyan-300/[.08] border border-cyan-300/[.1] px-2.5 py-1.5 text-[7px] text-cyan-100">
                      Use reference
                    </button>
                  </div>

                  <p className="text-[8px] leading-4 text-white/28 mt-2">{reference.summary}</p>

                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {[
                      ["Layout", reference.layout_observations],
                      ["Typography", reference.typography_observations],
                      ["Color", reference.color_observations],
                      ["Responsive", reference.responsive_observations],
                    ].map(([label, values]) => (
                      <div key={String(label)} className="rounded-xl border border-white/[.05] bg-black/10 p-2">
                        <div className="text-[6px] uppercase tracking-wider text-white/20">{label}</div>
                        <div className="mt-1 space-y-0.5">
                          {(Array.isArray(values) ? values : values ? [values] : []).slice(0, 3).map((value: string) => <div key={value} className="text-[7px] leading-3 text-white/27">• {value}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {error && <div className="mt-2 text-[7px] text-red-300/70">{error}</div>}
        </div>
      )}
    </section>
  );
}
