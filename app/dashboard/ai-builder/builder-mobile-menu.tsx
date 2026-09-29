"use client";

import { useState } from "react";

type MenuItem = {
  label: string;
  detail: string;
  icon: string;
  action: () => void;
};

export default function BuilderMobileMenu({
  businessName,
  projectName,
  onNewChat,
  onOpenHistory,
  onOpenApps,
  onOpenProject,
  onOpenWebsite,
}: {
  businessName: string;
  projectName?: string | null;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenApps: () => void;
  onOpenProject: () => void;
  onOpenWebsite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const close = () => setOpen(false);

  const items: MenuItem[] = [
    { label: "AI Builder", detail: "Build, edit, inspect and ship", icon: "✦", action: onNewChat },
    { label: "Website Creator", detail: "Design, pages, source and preview", icon: "◇", action: onOpenWebsite },
    { label: "Projects", detail: projectName || "Choose a software project", icon: "▦", action: onOpenProject },
    { label: "Customer profiles", detail: "Customers, records and activity", icon: "◎", action: () => { window.location.href = "/dashboard/customers"; } },
    { label: "Connections", detail: "Accounts, APIs and services", icon: "⌁", action: onOpenApps },
    { label: "Chats & history", detail: "Persistent Builder conversations", icon: "◌", action: onOpenHistory },
    { label: "Settings", detail: "Business and workspace controls", icon: "⚙", action: () => { window.location.href = "/dashboard/settings"; } },
  ];

  return (
    <>
      <button
        aria-label="Open Builder menu"
        onClick={() => setOpen(true)}
        className="xl:hidden inline-flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[3px] rounded-xl border border-white/[.08] bg-white/[.035] text-white/65 active:scale-95"
      >
        <span className="h-[1.5px] w-4 rounded-full bg-current" />
        <span className="h-[1.5px] w-4 rounded-full bg-current" />
        <span className="h-[1.5px] w-4 rounded-full bg-current" />
      </button>

      <button
        aria-label="Open business profile"
        onClick={() => { setProfileOpen(true); setOpen(true); }}
        className="xl:hidden ml-auto h-9 w-9 shrink-0 rounded-full border border-indigo-200/15 bg-gradient-to-br from-indigo-300/20 via-white/[.06] to-cyan-300/10 text-[9px] font-semibold text-white/75"
      >
        {(businessName.trim()[0] || "B").toUpperCase()}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] xl:hidden">
          <button aria-label="Close Builder menu" onClick={close} className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,360px)] overflow-y-auto border-r border-white/[.1] bg-[#0d1015] shadow-[24px_0_80px_rgba(0,0,0,.45)]">
            <div className="sticky top-0 z-10 border-b border-white/[.07] bg-[#0d1015]/95 px-4 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button onClick={close} className="h-9 w-9 rounded-xl border border-white/[.08] bg-white/[.035] text-white/45">×</button>
                <div className="min-w-0 flex-1">
                  <div className="text-[8px] uppercase tracking-[.2em] text-indigo-200/45">BizStack</div>
                  <div className="mt-1 truncate text-[13px] font-semibold tracking-tight text-white/85">AI Builder</div>
                </div>
                <button onClick={() => setProfileOpen(v => !v)} className="h-9 w-9 rounded-full border border-white/[.08] bg-white/[.05] text-[9px] font-semibold text-white/65">
                  {(businessName.trim()[0] || "B").toUpperCase()}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-white/[.07] bg-gradient-to-br from-indigo-400/[.09] via-white/[.025] to-cyan-300/[.05] p-3">
                <div className="text-[7px] uppercase tracking-[.18em] text-white/25">Current workspace</div>
                <div className="mt-1 text-[10px] font-medium text-white/70 truncate">{projectName || "No project selected"}</div>
                <div className="mt-1 text-[8px] leading-4 text-white/25">The menu keeps navigation out of the working canvas.</div>
              </div>
            </div>

            <div className="p-3">
              <div className="space-y-1">
                {items.map(item => (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); close(); }}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-white/[.07] hover:bg-white/[.035] active:bg-white/[.05]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.035] text-[11px] text-white/50 group-hover:text-indigo-200/80">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-white/68">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[8px] text-white/22">{item.detail}</span>
                    </span>
                    <span className="text-white/15">›</span>
                  </button>
                ))}
              </div>

              <div className="my-4 h-px bg-white/[.06]" />

              <div className="text-[7px] uppercase tracking-[.2em] text-white/20 px-2 mb-2">Business profile</div>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3 text-left"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-300/20 to-cyan-300/10 text-[12px] font-semibold text-white/75">
                  {(businessName.trim()[0] || "B").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-medium text-white/70">{businessName}</span>
                  <span className="block mt-1 text-[8px] text-white/22">Business identity and Builder context</span>
                </span>
                <span className="text-white/20">{profileOpen ? "⌃" : "⌄"}</span>
              </button>

              {profileOpen && (
                <div className="mt-2 rounded-2xl border border-indigo-300/[.1] bg-indigo-300/[.035] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Identity", "Business name"],
                      ["AI context", "Workspace memory"],
                      ["Access", "Authorized accounts"],
                      ["Preferences", "Builder behavior"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-2.5">
                        <div className="text-[7px] uppercase tracking-wider text-white/20">{label}</div>
                        <div className="mt-1 text-[8px] text-white/48">{value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[8px] leading-4 text-white/25">
                    Profile information is kept separate from the working canvas so the Builder can stay focused while your business context remains available.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
                <div className="text-[7px] uppercase tracking-[.18em] text-white/20">Design principle</div>
                <p className="mt-1.5 text-[8px] leading-4 text-white/25">
                  Navigation lives behind one compact menu on phone. The workspace gets the screen; tools appear when needed.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
