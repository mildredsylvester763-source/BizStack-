"use client";

import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  slug: string;
  project_type: string;
  framework: string | null;
  runtime: string | null;
  metadata?: Record<string, any>;
};

type Settings = {
  appName: string;
  shortName: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  faviconUrl: string;
  socialImageUrl: string;
  defaultViewport: "wide" | "desktop" | "tablet" | "mobile";
  responsiveStrategy: "fluid" | "breakpoints" | "adaptive";
  defaultRoute: string;
  language: string;
  timezone: string;
  accessibility: {
    reducedMotion: boolean;
    highContrastFocus: boolean;
    keyboardNavigation: boolean;
  };
  seo: {
    indexing: "index" | "noindex";
    titleTemplate: string;
    canonicalBase: string;
    defaultDescription: string;
  };
  publishing: {
    customDomain: string;
    previewProtection: boolean;
  };
};

const DEFAULTS: Settings = {
  appName: "",
  shortName: "",
  description: "",
  primaryColor: "#6d5dfc",
  accentColor: "#19c6b8",
  faviconUrl: "",
  socialImageUrl: "",
  defaultViewport: "desktop",
  responsiveStrategy: "fluid",
  defaultRoute: "/",
  language: "en",
  timezone: "UTC",
  accessibility: {
    reducedMotion: false,
    highContrastFocus: true,
    keyboardNavigation: true
  },
  seo: {
    indexing: "index",
    titleTemplate: "%s",
    canonicalBase: "",
    defaultDescription: ""
  },
  publishing: {
    customDomain: "",
    previewProtection: false
  }
};

function mergeSettings(value: any, project: Project): Settings {
  const saved = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULTS,
    ...saved,
    appName: saved.appName || project.name,
    shortName: saved.shortName || project.name.slice(0, 12),
    description: saved.description || "",
    accessibility: { ...DEFAULTS.accessibility, ...(saved.accessibility || {}) },
    seo: { ...DEFAULTS.seo, ...(saved.seo || {}) },
    publishing: { ...DEFAULTS.publishing, ...(saved.publishing || {}) }
  };
}

export default function WebsiteProjectSettings({ project, onAsk }: { project: Project; onAsk: (prompt: string) => void }) {
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(project.metadata?.settings, project));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"identity" | "responsive" | "accessibility" | "seo" | "publishing">("identity");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSettings(mergeSettings(project.metadata?.settings, project));
  }, [project.id, project.metadata]);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Project settings could not be saved.");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function patch(path: string, value: any) {
    if (path === "accessibility.reducedMotion") setSettings(s => ({ ...s, accessibility: { ...s.accessibility, reducedMotion: value } }));
    if (path === "accessibility.highContrastFocus") setSettings(s => ({ ...s, accessibility: { ...s.accessibility, highContrastFocus: value } }));
    if (path === "accessibility.keyboardNavigation") setSettings(s => ({ ...s, accessibility: { ...s.accessibility, keyboardNavigation: value } }));
    if (path === "seo.indexing") setSettings(s => ({ ...s, seo: { ...s.seo, indexing: value } }));
    if (path === "seo.titleTemplate") setSettings(s => ({ ...s, seo: { ...s.seo, titleTemplate: value } }));
    if (path === "seo.canonicalBase") setSettings(s => ({ ...s, seo: { ...s.seo, canonicalBase: value } }));
    if (path === "seo.defaultDescription") setSettings(s => ({ ...s, seo: { ...s.seo, defaultDescription: value } }));
    if (path === "publishing.customDomain") setSettings(s => ({ ...s, publishing: { ...s.publishing, customDomain: value } }));
    if (path === "publishing.previewProtection") setSettings(s => ({ ...s, publishing: { ...s.publishing, previewProtection: value } }));
    if (path === "appName") setSettings(s => ({ ...s, appName: value }));
    if (path === "shortName") setSettings(s => ({ ...s, shortName: value }));
    if (path === "description") setSettings(s => ({ ...s, description: value }));
    if (path === "primaryColor") setSettings(s => ({ ...s, primaryColor: value }));
    if (path === "accentColor") setSettings(s => ({ ...s, accentColor: value }));
    if (path === "faviconUrl") setSettings(s => ({ ...s, faviconUrl: value }));
    if (path === "socialImageUrl") setSettings(s => ({ ...s, socialImageUrl: value }));
    if (path === "defaultViewport") setSettings(s => ({ ...s, defaultViewport: value }));
    if (path === "responsiveStrategy") setSettings(s => ({ ...s, responsiveStrategy: value }));
    if (path === "defaultRoute") setSettings(s => ({ ...s, defaultRoute: value }));
    if (path === "language") setSettings(s => ({ ...s, language: value }));
    if (path === "timezone") setSettings(s => ({ ...s, timezone: value }));
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full mt-3 rounded-2xl border border-white/[.07] bg-gradient-to-br from-white/[.045] to-white/[.015] p-3 text-left hover:bg-white/[.06]">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-indigo-300/[.12] border border-indigo-300/[.1] grid place-items-center text-[8px] text-indigo-100">⚙</span>
          <div className="min-w-0 flex-1">
            <div className="text-[8px] uppercase tracking-[.16em] text-white/25">Project settings</div>
            <div className="text-[9px] text-white/60 mt-1 truncate">Identity, responsive behavior, accessibility, SEO & publishing</div>
          </div>
          <span className="text-white/20">›</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-[4px] p-2 sm:p-4 lg:p-8">
          <div className="h-full max-w-[1180px] mx-auto overflow-hidden rounded-[26px] border border-white/[.1] bg-[#090b0f] shadow-[0_35px_130px_rgba(0,0,0,.6)] flex flex-col">
            <header className="h-16 shrink-0 px-5 border-b border-white/[.07] flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/[.05] border border-white/[.08] grid place-items-center text-sm">⚙</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.18em] text-white/25">Project settings</div>
                <div className="text-sm text-white/75 mt-0.5 truncate">{project.name}</div>
              </div>
              <button onClick={() => onAsk("Inspect the current project settings for configuration gaps that could affect production, accessibility, SEO, responsive behavior or publishing.")} className="hidden sm:block px-3 py-2 rounded-xl border border-white/[.07] text-[8px] text-white/45">Ask Builder to inspect</button>
              <button onClick={() => setOpen(false)} aria-label="Close settings" className="h-9 w-9 rounded-xl border border-white/[.08] text-white/40 hover:text-white">×</button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
              <nav className="lg:w-[210px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[.07] p-2 lg:p-3 flex lg:flex-col gap-1 overflow-x-auto">
                {[
                  ["identity", "Identity & brand", "Name, colors, favicon"],
                  ["responsive", "Responsive", "Viewport & layout"],
                  ["accessibility", "Accessibility", "Motion, focus, keyboard"],
                  ["seo", "SEO & discovery", "Indexing & metadata"],
                  ["publishing", "Publishing", "Domain & preview"]
                ].map(([key, label, detail]) => (
                  <button key={key} onClick={() => setSection(key as any)} className={"min-w-[155px] lg:min-w-0 text-left rounded-xl px-3 py-2.5 " + (section === key ? "bg-indigo-300/[.1] border border-indigo-300/[.1]" : "border border-transparent hover:bg-white/[.035]")}>
                    <div className="text-[9px] text-white/65">{label}</div>
                    <div className="text-[7px] text-white/20 mt-1">{detail}</div>
                  </button>
                ))}
              </nav>

              <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
                {section === "identity" && <div className="max-w-2xl space-y-4">
                  <div><h3 className="text-lg">Identity & brand</h3><p className="text-[9px] text-white/25 mt-1">These values describe the application/site. Saving them does not silently rewrite source files.</p></div>
                  <Field label="Application / site name"><input value={settings.appName} onChange={e => patch("appName", e.target.value)} /></Field>
                  <Field label="Short name"><input value={settings.shortName} onChange={e => patch("shortName", e.target.value)} maxLength={20} /></Field>
                  <Field label="Description"><textarea value={settings.description} onChange={e => patch("description", e.target.value)} rows={4} /></Field>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Primary color"><input type="color" value={settings.primaryColor} onChange={e => patch("primaryColor", e.target.value)} className="h-11 p-1" /></Field>
                    <Field label="Accent color"><input type="color" value={settings.accentColor} onChange={e => patch("accentColor", e.target.value)} className="h-11 p-1" /></Field>
                  </div>
                  <Field label="Favicon / app icon URL"><input value={settings.faviconUrl} onChange={e => patch("faviconUrl", e.target.value)} placeholder="https://…" /></Field>
                  <Field label="Social preview image URL"><input value={settings.socialImageUrl} onChange={e => patch("socialImageUrl", e.target.value)} placeholder="https://…" /></Field>
                </div>}

                {section === "responsive" && <div className="max-w-2xl space-y-4">
                  <div><h3 className="text-lg">Responsive behavior</h3><p className="text-[9px] text-white/25 mt-1">Defaults for the builder and generated app/site experience.</p></div>
                  <Field label="Default preview viewport"><select value={settings.defaultViewport} onChange={e => patch("defaultViewport", e.target.value)}><option value="wide">Wide</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></Field>
                  <Field label="Responsive strategy"><select value={settings.responsiveStrategy} onChange={e => patch("responsiveStrategy", e.target.value)}><option value="fluid">Fluid-first</option><option value="breakpoints">Breakpoint-driven</option><option value="adaptive">Adaptive layouts</option></select></Field>
                  <Field label="Default route"><input value={settings.defaultRoute} onChange={e => patch("defaultRoute", e.target.value)} placeholder="/" /></Field>
                  <div className="grid sm:grid-cols-2 gap-3"><Field label="Language"><input value={settings.language} onChange={e => patch("language", e.target.value)} placeholder="en" /></Field><Field label="Timezone"><input value={settings.timezone} onChange={e => patch("timezone", e.target.value)} placeholder="UTC" /></Field></div>
                </div>}

                {section === "accessibility" && <div className="max-w-2xl space-y-3">
                  <div><h3 className="text-lg">Accessibility defaults</h3><p className="text-[9px] text-white/25 mt-1">Settings are explicit preferences; the builder should still inspect the actual generated source before release.</p></div>
                  <Toggle label="Respect reduced-motion preferences" value={settings.accessibility.reducedMotion} onChange={v => patch("accessibility.reducedMotion", v)} />
                  <Toggle label="Strong keyboard focus indicators" value={settings.accessibility.highContrastFocus} onChange={v => patch("accessibility.highContrastFocus", v)} />
                  <Toggle label="Keyboard navigation as a first-class interaction" value={settings.accessibility.keyboardNavigation} onChange={v => patch("accessibility.keyboardNavigation", v)} />
                </div>}

                {section === "seo" && <div className="max-w-2xl space-y-4">
                  <div><h3 className="text-lg">SEO & discovery</h3><p className="text-[9px] text-white/25 mt-1">Configuration only. It does not claim that search engines have indexed the site.</p></div>
                  <Field label="Indexing policy"><select value={settings.seo.indexing} onChange={e => patch("seo.indexing", e.target.value)}><option value="index">Allow indexing</option><option value="noindex">Discourage indexing</option></select></Field>
                  <Field label="Title template"><input value={settings.seo.titleTemplate} onChange={e => patch("seo.titleTemplate", e.target.value)} placeholder="%s · Brand" /></Field>
                  <Field label="Canonical base URL"><input value={settings.seo.canonicalBase} onChange={e => patch("seo.canonicalBase", e.target.value)} placeholder="https://example.com" /></Field>
                  <Field label="Default description"><textarea value={settings.seo.defaultDescription} onChange={e => patch("seo.defaultDescription", e.target.value)} rows={4} /></Field>
                </div>}

                {section === "publishing" && <div className="max-w-2xl space-y-4">
                  <div><h3 className="text-lg">Publishing</h3><p className="text-[9px] text-white/25 mt-1">Domain values are saved as project configuration. Connecting DNS or deploying still requires the relevant provider workflow.</p></div>
                  <Field label="Custom domain"><input value={settings.publishing.customDomain} onChange={e => patch("publishing.customDomain", e.target.value)} placeholder="www.example.com" /></Field>
                  <Toggle label="Protect preview environment" value={settings.publishing.previewProtection} onChange={v => patch("publishing.previewProtection", v)} />
                  <div className="rounded-2xl border border-amber-200/[.08] bg-amber-200/[.025] p-3 text-[8px] leading-4 text-amber-100/45">Saving a domain does not claim DNS verification. Domain verification and deployment remain separate operations.</div>
                </div>}
              </main>
            </div>

            <footer className="shrink-0 border-t border-white/[.07] px-4 sm:px-5 py-3 flex items-center gap-3">
              <div className="text-[8px] text-red-300/75 flex-1">{error}</div>
              {saved && <div className="text-[8px] text-emerald-200/70">Saved to project configuration.</div>}
              <button onClick={() => void save()} disabled={busy} className="px-4 py-2.5 rounded-xl bg-white text-black text-[8px] disabled:opacity-40">{busy ? "Saving…" : "Save settings"}</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[8px] text-white/35">{label}</span>{children}</label>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.02] p-3 text-left"><span className={"h-6 w-10 rounded-full p-1 transition " + (value ? "bg-indigo-300/50" : "bg-white/[.08]")}><span className={"block h-4 w-4 rounded-full bg-white transition " + (value ? "translate-x-4" : "")} /></span><span className="text-[9px] text-white/60">{label}</span></button>;
}
