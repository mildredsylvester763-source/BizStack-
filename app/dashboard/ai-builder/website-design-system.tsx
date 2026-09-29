"use client";

import { useEffect, useState } from "react";

type DesignSystem = {
  version: number;
  name: string;
  philosophy: string;
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, any>;
  radii?: Record<string, string>;
  shadows?: Record<string, string>;
  components?: Record<string, string>;
  motion?: Record<string, string>;
  accessibility?: string[];
  generated_at: string;
  source?: string;
};

const COLOR_KEYS = ["primary","secondary","accent","background","surface","text","muted_text","border","success","warning","danger"];

export default function WebsiteDesignSystem({
  projectId,
  onAsk,
}: {
  projectId: string;
  onAsk: (prompt: string) => void;
}) {
  const [system, setSystem] = useState<DesignSystem | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/design-system", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Design system could not be loaded.");
      setSystem(payload.designSystem || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Design system could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/design-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: "Create a premium visual system for the current website and preserve the saved Blueprint direction." })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Design system generation failed.");
      setSystem(payload.designSystem || null);
      setOpen(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Design system generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.02] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-300/[.08] border border-amber-300/[.08] text-amber-100 text-[9px]">◈</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] uppercase tracking-[.18em] text-white/25">Design system</span>
          <span className="block text-[8px] text-white/45 truncate mt-0.5">{system?.name || "Typography, color, spacing and component rules"}</span>
        </span>
        <span className="text-white/20">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] p-3">
          {system ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[.05] bg-white/[.02] p-3">
                <div className="text-[8px] text-white/55">{system.name}</div>
                <p className="text-[7px] leading-4 text-white/25 mt-1">{system.philosophy}</p>
              </div>

              <div>
                <div className="text-[7px] uppercase tracking-[.16em] text-white/20 mb-2">Palette</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {COLOR_KEYS.map(key => {
                    const value = String(system.colors?.[key] || "");
                    return <div key={key} className="rounded-xl border border-white/[.05] overflow-hidden bg-white/[.02]">
                      <div className="h-7" style={{ background: value || "rgba(255,255,255,.03)" }} />
                      <div className="px-2 py-1.5">
                        <div className="text-[6px] uppercase text-white/20">{key.replace("_"," ")}</div>
                        <div className="text-[6px] text-white/35 mt-0.5 truncate">{value || "—"}</div>
                      </div>
                    </div>;
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5">
                  <div className="text-[7px] uppercase tracking-wider text-white/20">Typography</div>
                  <div className="text-[8px] text-white/50 mt-2">{String(system.typography?.heading_family || "—")}</div>
                  <div className="text-[7px] text-white/25 mt-1">Body: {String(system.typography?.body_family || "—")}</div>
                  <div className="text-[7px] text-white/25 mt-1">Base: {String(system.typography?.base_size || "—")}</div>
                </div>
                <div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5">
                  <div className="text-[7px] uppercase tracking-wider text-white/20">Geometry</div>
                  <div className="text-[7px] text-white/35 mt-2">Control: {String(system.radii?.control || "—")}</div>
                  <div className="text-[7px] text-white/35 mt-1">Card: {String(system.radii?.card || "—")}</div>
                  <div className="text-[7px] text-white/35 mt-1">Modal: {String(system.radii?.modal || "—")}</div>
                </div>
              </div>

              <button onClick={() => onAsk("Use the saved BizStack design system as the visual source of truth for this website. Apply its typography, palette, spacing, radii, shadows and component rules consistently without copying external brands. Show a change plan before editing source.")} className="w-full rounded-xl bg-indigo-300/[.08] border border-indigo-300/[.1] px-3 py-2 text-[8px] text-indigo-100">
                Apply system consistently
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[.07] p-4 text-center">
              <div className="text-[8px] text-white/25">No saved design system yet.</div>
            </div>
          )}

          {error && <div className="mt-2 text-[7px] text-red-300/70">{error}</div>}
          <button onClick={() => void generate()} disabled={busy} className="mt-2 w-full rounded-xl border border-white/[.06] px-3 py-2 text-[7px] text-white/35 disabled:opacity-30">
            {busy ? "Generating visual system…" : system ? "Regenerate system" : "Generate visual system"}
          </button>
        </div>
      )}
    </section>
  );
}
