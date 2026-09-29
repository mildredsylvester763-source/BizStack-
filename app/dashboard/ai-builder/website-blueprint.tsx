"use client";

import { useEffect, useState } from "react";

type Blueprint = {
  version: number;
  title: string;
  summary: string;
  audience?: string[];
  goals?: string[];
  pages: Array<{
    id: string;
    path: string;
    name: string;
    purpose: string;
    priority?: string;
    sections?: Array<{
      id: string;
      name: string;
      purpose: string;
      data?: string[];
      primary_action?: string;
    }>;
  }>;
  flows?: Array<{ id: string; name: string; steps?: string[]; outcome?: string }>;
  design_direction?: Record<string, any>;
  content_system?: Record<string, any>;
  engineering_notes?: Record<string, any>;
  generated_at: string;
};

export default function WebsiteBlueprint({
  projectId,
  projectName,
  onAskAI
}: {
  projectId: string;
  projectName: string;
  onAskAI: (prompt: string) => void;
}) {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/blueprint", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Blueprint could not be loaded.");
      setBlueprint(payload.blueprint || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Blueprint could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function generate() {
    if (!brief.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Blueprint generation failed.");
      setBlueprint(payload.blueprint || null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Blueprint generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="h-full min-h-[620px] overflow-y-auto bg-[#090b0e]">
      <div className="px-4 py-3 border-b border-white/[.06] flex items-center gap-3">
        <div>
          <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Website Blueprint</div>
          <div className="text-[9px] text-white/35 mt-1">{projectName}</div>
        </div>
        {blueprint && <div className="ml-auto text-[7px] text-emerald-200/60">persisted to project</div>}
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-indigo-300/[.1] bg-indigo-300/[.025] p-4">
          <div className="text-[8px] uppercase tracking-[.18em] text-indigo-100/60">Plan before code</div>
          <p className="text-[10px] leading-5 text-white/35 mt-2">
            Generate a source-aware sitemap, page structure, user flows, design direction and engineering dependencies. This becomes reusable context for later Website Creator work.
          </p>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={5}
            placeholder="Example: Create a premium Nigerian fashion brand site with Home, Collections, Product, About, Journal and Contact. Use real product data later, keep checkout separate, and make mobile the primary experience."
            className="mt-3 w-full rounded-xl border border-white/[.08] bg-black/20 px-3 py-3 text-[10px] leading-5 text-white/70 outline-none placeholder:text-white/15 resize-none"
          />
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => void generate()} disabled={generating || !brief.trim()} className="px-3 py-2 rounded-lg bg-white text-black text-[8px] disabled:opacity-25">
              {generating ? "Generating…" : blueprint ? "Regenerate blueprint" : "Generate blueprint"}
            </button>
            {error && <span className="text-[8px] text-red-300/80">{error}</span>}
          </div>
        </div>

        {loading && <div className="text-[9px] text-white/20">Loading saved blueprint…</div>}

        {!loading && !blueprint && !error && (
          <div className="rounded-2xl border border-dashed border-white/[.08] p-8 text-center">
            <div className="text-[8px] uppercase tracking-[.2em] text-white/20">No blueprint yet</div>
            <p className="text-[10px] leading-5 text-white/25 mt-2">Create the plan here first, then use it to drive actual website changes.</p>
          </div>
        )}

        {blueprint && (
          <>
            <div className="grid md:grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
                <div className="text-[7px] uppercase tracking-wider text-white/20">Pages</div>
                <div className="text-2xl mt-1">{blueprint.pages.length}</div>
              </div>
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
                <div className="text-[7px] uppercase tracking-wider text-white/20">Flows</div>
                <div className="text-2xl mt-1">{blueprint.flows?.length || 0}</div>
              </div>
              <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3">
                <div className="text-[7px] uppercase tracking-wider text-white/20">Generated</div>
                <div className="text-[8px] text-white/45 mt-2">{new Date(blueprint.generated_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
              <div className="flex items-start gap-3">
                <div>
                  <div className="text-[13px] text-white/75">{blueprint.title}</div>
                  <p className="text-[9px] leading-5 text-white/30 mt-1">{blueprint.summary}</p>
                </div>
                <button onClick={() => onAskAI("Use the saved website blueprint as the source of truth and turn the plan into the actual project implementation. Start by showing the affected files and dependencies, then implement the safest next step.")} className="ml-auto shrink-0 px-3 py-2 rounded-lg bg-indigo-400/[.1] border border-indigo-300/[.1] text-[8px] text-indigo-100">
                  Build from blueprint
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-2 mt-4">
                <div>
                  <div className="text-[7px] uppercase tracking-wider text-white/20">Audience</div>
                  <div className="flex flex-wrap gap-1 mt-2">{(blueprint.audience || []).map((item) => <span key={item} className="px-2 py-1 rounded-full bg-white/[.04] text-[7px] text-white/40">{item}</span>)}</div>
                </div>
                <div>
                  <div className="text-[7px] uppercase tracking-wider text-white/20">Goals</div>
                  <div className="space-y-1 mt-2">{(blueprint.goals || []).slice(0, 6).map((item) => <div key={item} className="text-[8px] text-white/35">• {item}</div>)}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Sitemap & sections</div>
              {blueprint.pages.map((page) => (
                <div key={page.id} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] text-white/60">{page.name}</div>
                    <span className="text-[7px] text-white/20">{page.path}</span>
                    <span className="ml-auto text-[6px] uppercase tracking-wider text-indigo-200/60">{page.priority || "secondary"}</span>
                  </div>
                  <div className="text-[8px] text-white/25 mt-1">{page.purpose}</div>
                  <div className="grid md:grid-cols-2 gap-1.5 mt-3">
                    {(page.sections || []).map((section) => (
                      <div key={section.id} className="rounded-xl border border-white/[.05] bg-black/10 p-2.5">
                        <div className="text-[8px] text-white/50">{section.name}</div>
                        <div className="text-[7px] leading-4 text-white/20 mt-1">{section.purpose}</div>
                        {section.primary_action && <div className="text-[7px] text-indigo-200/50 mt-1">CTA: {section.primary_action}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!!blueprint.flows?.length && (
              <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
                <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Core user flows</div>
                <div className="grid md:grid-cols-2 gap-2 mt-3">
                  {blueprint.flows.map((flow) => (
                    <div key={flow.id} className="rounded-xl border border-white/[.05] p-3">
                      <div className="text-[8px] text-white/55">{flow.name}</div>
                      <div className="space-y-1 mt-2">{(flow.steps || []).map((step) => <div key={step} className="text-[7px] text-white/25">{step}</div>)}</div>
                      {flow.outcome && <div className="text-[7px] text-emerald-200/50 mt-2">Outcome: {flow.outcome}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
              <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Design & engineering direction</div>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <div>
                  <div className="text-[7px] text-white/25">Style</div>
                  <div className="text-[9px] text-white/45 mt-1">{String(blueprint.design_direction?.style || "Not specified")}</div>
                  <div className="text-[7px] text-white/25 mt-3">Responsive</div>
                  <div className="text-[8px] text-white/35 mt-1">{String(blueprint.design_direction?.responsive_strategy || "Not specified")}</div>
                </div>
                <div>
                  <div className="text-[7px] text-white/25">Reusable components</div>
                  <div className="flex flex-wrap gap-1 mt-2">{(blueprint.content_system?.reusable_components || []).slice(0, 12).map((item: string) => <span key={item} className="px-2 py-1 rounded-full bg-white/[.04] text-[7px] text-white/35">{item}</span>)}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
