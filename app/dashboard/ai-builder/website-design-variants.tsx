"use client";

import { useEffect, useState } from "react";

type Variant = {
  id: string;
  name: string;
  positioning: string;
  visual_mood: string;
  typography_direction: string;
  color_direction: string;
  layout_strategy: string;
  component_strategy: string;
  motion_direction: string;
  best_for: string;
  implementation_notes?: string[];
};

type VariantPayload = {
  version: number;
  generated_at: string;
  variants: Variant[];
  source?: string;
};

export default function WebsiteDesignVariants({
  projectId,
  route,
  onAsk,
}: {
  projectId: string;
  route: string;
  onAsk: (prompt: string) => void;
}) {
  const [payload, setPayload] = useState<VariantPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/design-variants", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Design directions could not be loaded.");
      setPayload(data.variants || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Design directions could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/design-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: "Explore premium visual directions for " + route + " while preserving the current business purpose and information architecture." })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Design directions could not be generated.");
      setPayload(data.designVariants || null);
      setOpen(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Design directions could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-indigo-300/[.08] bg-indigo-300/[.02] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-300/[.08] border border-indigo-300/[.08] text-indigo-100 text-[9px]">◇</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] uppercase tracking-[.18em] text-white/25">Design directions</span>
          <span className="block text-[8px] text-white/42 mt-0.5">{payload?.variants?.length || 0} saved visual concept{payload?.variants?.length === 1 ? "" : "s"}</span>
        </span>
        <span className="text-white/20">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] p-3">
          {payload?.variants?.length ? (
            <div className="space-y-2">
              {payload.variants.map((variant) => (
                <article key={variant.id} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium text-white/68">{variant.name}</div>
                      <div className="text-[7px] uppercase tracking-[.14em] text-indigo-200/50 mt-1">{variant.visual_mood}</div>
                    </div>
                    <button
                      onClick={() => onAsk(
                        "Use the saved design direction '" + variant.name + "' for the " + route +
                        " page. Positioning: " + variant.positioning +
                        ". Typography: " + variant.typography_direction +
                        ". Colors: " + variant.color_direction +
                        ". Layout: " + variant.layout_strategy +
                        ". Components: " + variant.component_strategy +
                        ". Motion: " + variant.motion_direction +
                        ". Show the exact affected files and a source-backed implementation plan before changing anything."
                      )}
                      className="shrink-0 rounded-lg bg-white text-black px-2.5 py-1.5 text-[7px]"
                    >
                      Use direction
                    </button>
                  </div>
                  <p className="text-[8px] leading-4 text-white/28 mt-2">{variant.positioning}</p>

                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {[
                      ["Typography", variant.typography_direction],
                      ["Color", variant.color_direction],
                      ["Layout", variant.layout_strategy],
                      ["Components", variant.component_strategy],
                      ["Motion", variant.motion_direction],
                      ["Best for", variant.best_for],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[.05] bg-black/10 p-2">
                        <div className="text-[6px] uppercase tracking-wider text-white/20">{label}</div>
                        <div className="text-[7px] text-white/36 mt-1 leading-3.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {!!variant.implementation_notes?.length && (
                    <div className="mt-2 rounded-xl border border-white/[.05] bg-black/10 p-2">
                      <div className="text-[6px] uppercase tracking-wider text-white/20">Implementation notes</div>
                      <div className="mt-1 space-y-0.5">
                        {variant.implementation_notes.slice(0, 4).map(note => <div key={note} className="text-[7px] text-white/25">• {note}</div>)}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[.07] p-4 text-center text-[8px] text-white/25">
              No design directions have been saved yet.
            </div>
          )}

          {error && <div className="mt-2 text-[7px] text-red-300/70">{error}</div>}
          <button onClick={() => void generate()} disabled={busy} className="mt-2 w-full rounded-xl border border-white/[.06] px-3 py-2 text-[7px] text-white/35 disabled:opacity-30">
            {busy ? "Generating directions…" : payload?.variants?.length ? "Generate new directions" : "Generate design directions"}
          </button>
        </div>
      )}
    </section>
  );
}
