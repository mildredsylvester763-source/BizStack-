"use client";

import { useMemo, useState } from "react";

type ElementItem = {
  label: string;
  prompt: string;
  count: number;
};

type DesignTab = "select" | "style" | "content" | "responsive";

export default function WebsiteDesignMode({
  route,
  source,
  elements,
  onAsk,
  liveElement,
  onEnableLive,
}: {
  route: string;
  source: string;
  elements: ElementItem[];
  onAsk: (prompt: string) => void;
  liveElement: {
    tag: string;
    text: string;
    selector: string;
    className: string;
    href: string;
    computed?: Record<string, string>;
  } | null;
  onEnableLive: () => void;
}) {
  const [tab, setTab] = useState<DesignTab>("select");
  const [selected, setSelected] = useState<ElementItem | null>(null);
  const [fontSize, setFontSize] = useState("current");
  const [weight, setWeight] = useState("current");
  const [radius, setRadius] = useState("current");
  const [shadow, setShadow] = useState("current");
  const [spacing, setSpacing] = useState("current");
  const [text, setText] = useState("");

  const target = selected || elements[0] || null;

  const tabs = useMemo(() => [
    ["select", "Select"],
    ["style", "Style"],
    ["content", "Content"],
    ["responsive", "Responsive"],
  ] as const, []);

  function applyStyle() {
    if (!target) return;
    onAsk(
      "Enter source-backed Design Mode for the " +
      target.prompt +
      " on " + route +
      ". Modify only the affected component/source. " +
      "Typography: " + fontSize + ", weight: " + weight +
      ". Radius: " + radius + ". Shadow: " + shadow +
      ". Spacing: " + spacing +
      ". Show the affected files and plan before applying the change, then verify the build."
    );
  }

  function applyContent() {
    if (!target || !text.trim()) return;
    onAsk(
      "Change the content of the " +
      target.prompt +
      " on " + route +
      " to exactly: " + text.trim() +
      ". Preserve the current component structure, responsive behavior, accessibility and data bindings. Show the affected source before applying."
    );
    setText("");
  }

  return (
    <section className="rounded-2xl border border-indigo-300/[.12] bg-gradient-to-br from-indigo-300/[.06] via-white/[.02] to-cyan-300/[.035] overflow-hidden">
      <div className="px-3.5 py-3 border-b border-white/[.07] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-300/[.1] border border-indigo-300/[.1] grid place-items-center text-indigo-100 text-[10px]">✦</div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[.18em] text-indigo-100/55">Design Mode</div>
          <div className="text-[8px] text-white/22 truncate mt-0.5">{route} · {source || "source-backed page"}</div>
        </div>
        <span className="text-[7px] px-2 py-1 rounded-full bg-white/[.045] border border-white/[.06] text-white/28">source-aware</span>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/10 border border-white/[.05] p-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? "rounded-lg bg-white/[.08] text-white/70 px-2 py-1.5 text-[7px]" : "rounded-lg text-white/25 px-2 py-1.5 text-[7px]"}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "select" && (
          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl border border-cyan-300/[.1] bg-cyan-300/[.035] p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-300/[.08] text-cyan-100 text-[9px]">⌁</span>
              <div className="min-w-0 flex-1">
                <div className="text-[7px] uppercase tracking-[.16em] text-cyan-100/45">Live canvas selection</div>
                <div className="text-[8px] text-white/28 mt-0.5 truncate">{liveElement ? liveElement.selector : "Enable preview selection to click the actual rendered element."}</div>
              </div>
              {!liveElement && <button onClick={onEnableLive} className="shrink-0 rounded-lg bg-cyan-300/[.1] border border-cyan-300/[.12] px-2 py-1.5 text-[7px] text-cyan-100">Enable</button>}
            </div>
            {liveElement && <div className="mt-2 rounded-lg bg-black/10 border border-white/[.05] p-2">
              <div className="text-[7px] text-white/25">Selected element</div>
              <div className="text-[9px] text-white/58 mt-1">{liveElement.tag.toUpperCase()} · {liveElement.text || "No text content"}</div>
              <div className="text-[7px] text-white/18 mt-1 break-all">{liveElement.className || "no class metadata"}</div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(["width","height","fontSize","fontWeight","lineHeight","borderRadius","padding","margin"] as const).map((key) => (
                  <div key={key} className="rounded-md border border-white/[.05] bg-white/[.02] px-2 py-1.5">
                    <div className="text-[6px] uppercase tracking-wider text-white/15">{key}</div>
                    <div className="text-[7px] text-white/35 mt-0.5 truncate">{liveElement.computed?.[key] || "—"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => onAsk("Use Design Mode to plan typography changes on the live-selected " + liveElement.tag + " element. Source: " + source + ". Selector: " + liveElement.selector + ". Current rendered properties: " + JSON.stringify(liveElement.computed || {}) + ". Preserve behavior and accessibility.")} className="flex-1 rounded-lg border border-white/[.06] bg-white/[.03] px-2 py-2 text-[7px] text-white/55">Typography</button>
                <button onClick={() => onAsk("Use Design Mode to plan spacing and visual surface changes on the live-selected " + liveElement.tag + " element. Source: " + source + ". Selector: " + liveElement.selector + ". Current rendered properties: " + JSON.stringify(liveElement.computed || {}) + ". Preserve behavior and responsiveness.")} className="flex-1 rounded-lg border border-white/[.06] bg-white/[.03] px-2 py-2 text-[7px] text-white/55">Spacing</button>
              </div>
              <button onClick={() => onAsk("Use Design Mode on the live-selected " + liveElement.tag + " element. Source: " + source + ". Selector: " + liveElement.selector + ". Current rendered properties: " + JSON.stringify(liveElement.computed || {}) + ". Preserve behavior and ask for approval before applying source changes.")} className="mt-2 w-full rounded-lg bg-white text-black px-2 py-2 text-[7px]">Plan source change</button>
            </div>}
            </div>

            <div className="space-y-1.5">
              <div className="text-[7px] uppercase tracking-[.16em] text-white/20 px-1">Page elements</div>
            {!elements.length && <div className="rounded-xl border border-white/[.05] p-3 text-[8px] leading-4 text-white/22">No source element descriptors are available yet. Use Builder to inspect the page source.</div>}
              {elements.map(item => (
              <button
                key={item.label}
                onClick={() => { setSelected(item); setTab("style"); }}
                className={"w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left " + (selected?.label === item.label ? "border-indigo-300/[.18] bg-indigo-300/[.07]" : "border-white/[.06] bg-white/[.02] hover:bg-white/[.035]")}
              >
                <span className="text-[9px] text-white/55">{item.label}</span>
                <span className="ml-auto text-[7px] text-indigo-200/60">{item.count}</span>
                <span className="text-white/15">›</span>
              </button>
              ))}
            </div>
          </div>
        )}

        {tab === "style" && (
          <div className="mt-3 space-y-3">
            <div className="text-[8px] text-white/35">Editing <span className="text-indigo-100/65">{target?.label || "selected element"}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Font size", fontSize, setFontSize, ["current", "smaller", "larger", "responsive"]],
                ["Weight", weight, setWeight, ["current", "regular", "medium", "semibold", "bold"]],
                ["Radius", radius, setRadius, ["current", "square", "subtle", "rounded", "pill"]],
                ["Shadow", shadow, setShadow, ["current", "none", "soft", "medium", "strong"]],
                ["Spacing", spacing, setSpacing, ["current", "tighter", "comfortable", "spacious", "dramatic"]],
              ].map(([label, value, setter, options]) => (
                <label key={String(label)} className="rounded-xl border border-white/[.06] bg-white/[.02] p-2.5">
                  <span className="block text-[7px] uppercase tracking-wider text-white/20">{String(label)}</span>
                  <select value={String(value)} onChange={e => (setter as (value: string) => void)(e.target.value)} className="mt-1.5 w-full bg-transparent text-[8px] text-white/55 outline-none">
                    {(options as string[]).map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button onClick={applyStyle} disabled={!target} className="w-full rounded-xl bg-white text-black px-3 py-2.5 text-[8px] font-medium disabled:opacity-25">
              Plan visual change in source
            </button>
          </div>
        )}

        {tab === "content" && (
          <div className="mt-3 space-y-2.5">
            <div className="text-[8px] text-white/35">Replace content for <span className="text-indigo-100/65">{target?.label || "selected element"}</span></div>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Write the exact new text or content instruction…" className="w-full resize-none rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-[9px] leading-4 text-white/65 placeholder:text-white/18 outline-none" />
            <button onClick={applyContent} disabled={!target || !text.trim()} className="w-full rounded-xl bg-indigo-300/[.12] border border-indigo-300/[.13] text-indigo-100 px-3 py-2.5 text-[8px] disabled:opacity-25">
              Prepare content change
            </button>
          </div>
        )}

        {tab === "responsive" && (
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {["mobile", "tablet", "desktop"].map(device => (
                <button key={device} onClick={() => onAsk("Inspect " + target?.prompt + " on " + device + " for " + route + ". Identify source-backed responsive problems and propose the smallest robust fix.")} className="rounded-xl border border-white/[.06] bg-white/[.02] px-2 py-2.5 text-[8px] text-white/45 capitalize">
                  {device}
                </button>
              ))}
            </div>
            <button onClick={() => onAsk("Run a full responsive design audit for " + route + " across mobile, tablet, desktop and wide viewports. Use the real project source and runtime, report concrete issues and affected components, then propose a verified change plan.")} className="w-full rounded-xl border border-cyan-300/[.1] bg-cyan-300/[.04] text-cyan-100 px-3 py-2.5 text-[8px]">
              Audit every viewport
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
