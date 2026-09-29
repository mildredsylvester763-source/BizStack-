"use client";

import { useState } from "react";

export default function WebsiteMobileToolbar({
  route,
  routes,
  device,
  onRoute,
  onDevice,
  onAsk,
}: {
  route: string;
  routes: Array<{ path: string; label: string }>;
  device: "wide" | "desktop" | "tablet" | "mobile";
  onRoute: (path: string) => void;
  onDevice: (device: "wide" | "desktop" | "tablet" | "mobile") => void;
  onAsk: (prompt: string) => void;
  onBlueprint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const devices = [
    ["wide", "Wide"],
    ["desktop", "Desktop"],
    ["tablet", "Tablet"],
    ["mobile", "Mobile"],
  ] as const;

  return (
    <div className="lg:hidden border-b border-white/[.07] bg-[#0c0f14]">
      <div className="h-12 px-3 flex items-center gap-2">
        <button
          aria-label="Open Website Creator controls"
          onClick={() => setOpen(v => !v)}
          className="h-9 w-9 shrink-0 rounded-xl border border-white/[.08] bg-white/[.035] flex flex-col items-center justify-center gap-[3px]"
        >
          <span className="w-4 h-[1.5px] bg-white/55 rounded-full" />
          <span className="w-4 h-[1.5px] bg-white/55 rounded-full" />
          <span className="w-4 h-[1.5px] bg-white/55 rounded-full" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-white/60 truncate">Website Creator</div>
          <div className="text-[7px] text-white/20 truncate">{route}</div>
        </div>
        <select
          value={device}
          onChange={e => onDevice(e.target.value as typeof device)}
          className="max-w-[92px] rounded-xl border border-white/[.07] bg-white/[.04] px-2 py-2 text-[8px] text-white/50 outline-none"
        >
          {devices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {open && (
        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => { onBlueprint(); setOpen(false); }} className="rounded-xl bg-indigo-300/[.08] border border-indigo-300/[.1] px-3 py-2.5 text-left text-[8px] text-indigo-100">Blueprint</button>
              <button onClick={() => onAsk("Enter Design Mode for this website. Inspect the selected page and prepare source-backed visual controls before making changes.")} className="rounded-xl bg-cyan-300/[.06] border border-cyan-300/[.08] px-3 py-2.5 text-left text-[8px] text-cyan-100">Design Mode</button>
              <button onClick={() => onAsk("Inspect this website's responsive behavior across phone, tablet and desktop and identify concrete source-backed fixes.")} className="rounded-xl border border-white/[.07] px-3 py-2.5 text-left text-[8px] text-white/55">Responsive audit</button>
              <button onClick={() => onAsk("Explain this website's routes, components, data, integrations, SEO and deployment dependencies from its real source graph.")} className="rounded-xl border border-white/[.07] px-3 py-2.5 text-left text-[8px] text-white/55">Explain site</button>
            </div>

            <div className="mt-3 border-t border-white/[.06] pt-3">
              <div className="text-[7px] uppercase tracking-[.18em] text-white/20 px-1 mb-1.5">Pages</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {routes.map(item => (
                  <button
                    key={item.path}
                    onClick={() => { onRoute(item.path); setOpen(false); }}
                    className={"w-full rounded-xl px-3 py-2 text-left border " + (item.path === route ? "bg-white/[.07] border-white/[.08]" : "border-transparent hover:bg-white/[.03]")}
                  >
                    <div className="text-[8px] text-white/55 truncate">{item.label}</div>
                    <div className="text-[7px] text-white/20 truncate mt-0.5">{item.path}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
