"use client";

import { useEffect, useState } from "react";

type SiteSystems = {
  content: any;
  seo: any;
  growth: any;
};

export default function WebsiteSiteSystems({
  projectId,
  route,
  onAsk,
}: {
  projectId: string;
  route: string;
  onAsk: (prompt: string) => void;
}) {
  const [systems, setSystems] = useState<SiteSystems>({ content: null, seo: null, growth: null });
  const [active, setActive] = useState<"content" | "seo" | "growth">("content");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/site-systems", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Site systems could not be loaded.");
      setSystems(data.systems || { content: null, seo: null, growth: null });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Site systems could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function generate(kind: "content" | "seo" | "growth") {
    if (busy) return;
    setBusy(true);
    setError("");
    setActive(kind);
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/site-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, brief: "Develop the " + kind + " system for " + route + " and the wider website without inventing existing business performance." })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Site system generation failed.");
      setSystems(previous => ({ ...previous, [kind]: data.system }));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Site system generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const current = systems[active];

  return (
    <section className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.02] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-300/[.07] border border-emerald-300/[.08] text-emerald-100 text-[9px]">◎</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] uppercase tracking-[.18em] text-white/25">Site systems</span>
          <span className="block text-[8px] text-white/42 mt-0.5">Content · SEO/AEO · Growth</span>
        </span>
        <span className="text-white/20">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] p-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/10 border border-white/[.05] p-1">
            {([
              ["content", "Content"],
              ["seo", "SEO/AEO"],
              ["growth", "Growth"]
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActive(key)} className={active === key ? "rounded-lg bg-white/[.08] text-white/70 px-2 py-1.5 text-[7px]" : "rounded-lg text-white/25 px-2 py-1.5 text-[7px]"}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-2 rounded-2xl border border-white/[.05] bg-white/[.02] p-3">
            {!current ? (
              <div className="py-3 text-center">
                <div className="text-[8px] text-white/25">No {active} system saved yet.</div>
                <button onClick={() => void generate(active)} disabled={busy} className="mt-2 rounded-lg bg-white text-black px-3 py-2 text-[7px] disabled:opacity-30">
                  {busy ? "Generating…" : "Generate system"}
                </button>
              </div>
            ) : active === "content" ? (
              <div className="space-y-2">
                <div className="text-[8px] text-white/55">{current.collections?.length || 0} content collection{current.collections?.length === 1 ? "" : "s"}</div>
                {(current.collections || []).slice(0, 5).map((item: any) => (
                  <div key={item.id || item.name} className="rounded-xl border border-white/[.05] bg-black/10 p-2.5">
                    <div className="text-[8px] text-white/55">{item.name}</div>
                    <div className="text-[7px] text-white/22 mt-1">{item.purpose}</div>
                    <div className="flex flex-wrap gap-1 mt-2">{(item.fields || []).slice(0, 8).map((field: any) => <span key={field.name} className="px-2 py-1 rounded-full bg-white/[.04] text-[6px] text-white/30">{field.name} · {field.type}</span>)}</div>
                  </div>
                ))}
              </div>
            ) : active === "seo" ? (
              <div className="space-y-2">
                {[
                  ["Title pattern", current.site_title_pattern],
                  ["Descriptions", current.meta_description_strategy],
                  ["Canonical", current.canonical_strategy],
                  ["Sitemap", current.sitemap_strategy],
                  ["Robots", current.robots_strategy],
                  ["OG", current.og_strategy]
                ].map(([label, value]) => <div key={String(label)}><div className="text-[6px] uppercase tracking-wider text-white/20">{label}</div><div className="text-[8px] leading-4 text-white/36 mt-1">{String(value || "—")}</div></div>)}
                <div className="pt-1"><div className="text-[6px] uppercase tracking-wider text-white/20">Structured data</div>{(current.structured_data || []).map((item: any) => <div key={item.type} className="text-[7px] text-white/30 mt-1">{item.type} · {item.purpose}</div>)}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[6px] uppercase tracking-wider text-white/20">Funnel</div>
                {(current.funnel || []).map((item: any) => <div key={item.stage} className="rounded-lg border border-white/[.05] p-2"><div className="text-[8px] text-white/45">{item.stage}</div><div className="text-[7px] text-white/22 mt-1">{item.goal} · {item.event}</div></div>)}
                <div className="text-[6px] uppercase tracking-wider text-white/20 mt-3">Experiments</div>
                {(current.experiments || []).map((item: any, index: number) => <div key={index} className="text-[7px] text-white/30 mt-1">{item.hypothesis}</div>)}
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={() => onAsk("Use the saved " + active + " website system as source-backed implementation context. Show affected files, dependencies and verification steps before changing anything.")} className="flex-1 rounded-xl bg-indigo-300/[.08] border border-indigo-300/[.1] px-3 py-2 text-[7px] text-indigo-100">Use in build</button>
            <button onClick={() => void generate(active)} disabled={busy} className="rounded-xl border border-white/[.06] px-3 py-2 text-[7px] text-white/35 disabled:opacity-30">{busy ? "…" : "Regenerate"}</button>
          </div>
          {error && <div className="mt-2 text-[7px] text-red-300/70">{error}</div>}
        </div>
      )}
    </section>
  );
}
