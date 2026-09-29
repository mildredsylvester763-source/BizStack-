"use client";

import { useEffect, useState } from "react";

type ComponentItem = {
  id: string;
  name: string;
  path: string;
  route?: string | null;
  role: string;
  reuse_prompt: string;
};

type Library = {
  version: number;
  generated_at: string;
  source: string;
  components: ComponentItem[];
};

export default function WebsiteComponentLibrary({
  projectId,
  onAsk,
}: {
  projectId: string;
  onAsk: (prompt: string) => void;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/component-library", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Component library could not be loaded.");
      setLibrary(data.library || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Component library could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function scan() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/component-library", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Component scan failed.");
      setLibrary(data.library || null);
      setOpen(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Component scan failed.");
    } finally {
      setBusy(false);
    }
  }

  const shown = (library?.components || []).filter(item =>
    (item.name + " " + item.path + " " + item.role).toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <section className="mt-3 rounded-2xl border border-fuchsia-300/[.08] bg-fuchsia-300/[.018] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-fuchsia-300/[.07] border border-fuchsia-300/[.08] text-fuchsia-100 text-[9px]">▤</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] uppercase tracking-[.18em] text-white/25">Component library</span>
          <span className="block text-[8px] text-white/42 mt-0.5">{library?.components?.length || 0} source-backed reusable components</span>
        </span>
        <span className="text-white/20">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[.06] p-3">
          <div className="flex gap-2">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search components…" className="min-w-0 flex-1 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2 text-[8px] text-white/55 placeholder:text-white/18 outline-none" />
            <button onClick={() => void scan()} disabled={busy} className="rounded-xl border border-white/[.06] px-3 py-2 text-[7px] text-white/35 disabled:opacity-30">{busy ? "…" : "Rescan"}</button>
          </div>

          {!library ? (
            <div className="mt-3 rounded-xl border border-dashed border-white/[.07] p-4 text-center">
              <div className="text-[8px] text-white/25">No component catalogue has been generated yet.</div>
              <button onClick={() => void scan()} disabled={busy} className="mt-2 rounded-lg bg-white text-black px-3 py-2 text-[7px] disabled:opacity-30">Scan source tree</button>
            </div>
          ) : (
            <div className="mt-3 space-y-1.5 max-h-[380px] overflow-y-auto">
              {shown.map(item => (
                <article key={item.id} className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] text-white/55 truncate">{item.name}</div>
                      <div className="text-[6px] text-fuchsia-100/40 mt-1 truncate">{item.path}</div>
                    </div>
                    <button onClick={() => onAsk(item.reuse_prompt + " Then show the affected files and source-backed change plan before applying.")} className="rounded-lg bg-fuchsia-300/[.08] border border-fuchsia-300/[.1] px-2 py-1.5 text-[6.5px] text-fuchsia-100">
                      Reuse
                    </button>
                  </div>
                  <div className="text-[7px] leading-3.5 text-white/24 mt-2">{item.role}</div>
                </article>
              ))}
              {!shown.length && <div className="text-[8px] text-white/20 py-5 text-center">No matching components.</div>}
            </div>
          )}

          {error && <div className="mt-2 text-[7px] text-red-300/70">{error}</div>}
        </div>
      )}
    </section>
  );
}
