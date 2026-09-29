"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  identity: {
    appName: string;
    shortName: string;
    description: string;
    primaryColor: string;
    accentColor: string;
    iconUrl: string;
    splashUrl: string;
    socialImageUrl: string;
  };
  platform: {
    target: "web" | "android" | "ios" | "android-ios" | "server";
    shell: "website" | "web-app" | "mobile-app" | "full-stack" | "api";
    defaultRoute: string;
    language: string;
    timezone: string;
    offlineMode: "none" | "cache" | "offline-first";
    orientation: "responsive" | "portrait" | "landscape" | "both";
  };
  responsive: {
    defaultViewport: "wide" | "desktop" | "tablet" | "mobile";
    strategy: "fluid" | "breakpoints" | "adaptive";
    mobileNavigation: "bottom" | "drawer" | "top";
    safeAreas: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrastFocus: boolean;
    keyboardNavigation: boolean;
    screenReaderLabels: boolean;
    textScaling: boolean;
  };
  seo: {
    enabled: boolean;
    indexing: "index" | "noindex";
    titleTemplate: string;
    canonicalBase: string;
    defaultDescription: string;
    sitemap: boolean;
    robots: boolean;
  };
  app: {
    statusBar: "system" | "light" | "dark";
    theme: "system" | "light" | "dark";
    splashDurationMs: number;
    installPrompt: boolean;
    pwa: boolean;
    deepLinks: boolean;
    notifications: boolean;
  };
  data: {
    persistence: "none" | "local" | "remote" | "hybrid";
    cachePolicy: "standard" | "aggressive" | "network-first";
    realtime: boolean;
    uploads: boolean;
  };
  publishing: {
    customDomain: string;
    previewProtection: boolean;
    releaseChannel: "development" | "preview" | "production";
    versionLabel: string;
  };
};

const DEFAULTS: Settings = {
  identity: {
    appName: "",
    shortName: "",
    description: "",
    primaryColor: "#6d5dfc",
    accentColor: "#19c6b8",
    iconUrl: "",
    splashUrl: "",
    socialImageUrl: ""
  },
  platform: {
    target: "web",
    shell: "web-app",
    defaultRoute: "/",
    language: "en",
    timezone: "UTC",
    offlineMode: "none",
    orientation: "responsive"
  },
  responsive: {
    defaultViewport: "desktop",
    strategy: "fluid",
    mobileNavigation: "drawer",
    safeAreas: true
  },
  accessibility: {
    reducedMotion: true,
    highContrastFocus: true,
    keyboardNavigation: true,
    screenReaderLabels: true,
    textScaling: true
  },
  seo: {
    enabled: true,
    indexing: "index",
    titleTemplate: "%s",
    canonicalBase: "",
    defaultDescription: "",
    sitemap: true,
    robots: true
  },
  app: {
    statusBar: "system",
    theme: "system",
    splashDurationMs: 800,
    installPrompt: false,
    pwa: false,
    deepLinks: false,
    notifications: false
  },
  data: {
    persistence: "remote",
    cachePolicy: "standard",
    realtime: false,
    uploads: false
  },
  publishing: {
    customDomain: "",
    previewProtection: false,
    releaseChannel: "development",
    versionLabel: "0.1.0"
  }
};

const TYPE_META: Record<string, { label: string; shell: Settings["platform"]["shell"]; target: Settings["platform"]["target"] }> = {
  website: { label: "Website", shell: "website", target: "web" },
  web: { label: "Web App", shell: "web-app", target: "web" },
  app: { label: "App", shell: "web-app", target: "web" },
  mobile: { label: "Mobile App", shell: "mobile-app", target: "android-ios" },
  "full-stack": { label: "Full-stack", shell: "full-stack", target: "web" },
  api: { label: "API / Service", shell: "api", target: "server" },
  platform: { label: "Platform", shell: "full-stack", target: "web" }
};

function mergeSettings(value: any, project: Project): Settings {
  const saved = value && typeof value === "object" ? value : {};
  const meta = TYPE_META[project.project_type] || TYPE_META.app;
  const merge = (key: keyof Settings) => ({ ...DEFAULTS[key], ...(saved[key] || {}) });
  return {
    identity: { ...merge("identity"), appName: saved.identity?.appName || project.name, shortName: saved.identity?.shortName || project.name.slice(0, 12) },
    platform: { ...merge("platform"), shell: saved.platform?.shell || meta.shell, target: saved.platform?.target || meta.target },
    responsive: merge("responsive"),
    accessibility: merge("accessibility"),
    seo: merge("seo"),
    app: merge("app"),
    data: merge("data"),
    publishing: merge("publishing")
  } as Settings;
}

function typeMeta(projectType: string) {
  return TYPE_META[projectType] || { label: projectType || "Project", shell: "web-app" as const, target: "web" as const };
}

export default function WebsiteProjectSettings({ project, onAsk }: { project: Project; onAsk: (prompt: string) => void }) {
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(project.metadata?.settings, project));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState("general");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const meta = useMemo(() => typeMeta(project.project_type), [project.project_type]);
  const isWebsite = settings.platform.shell === "website";
  const isMobile = settings.platform.shell === "mobile-app";
  const isApi = settings.platform.shell === "api";
  const isWeb = !isApi;

  useEffect(() => {
    setSettings(mergeSettings(project.metadata?.settings, project));
  }, [project.id, project.metadata, project.project_type]);

  async function save() {
    setBusy(true); setSaved(false); setError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Project settings could not be saved.");
      setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project settings could not be saved.");
    } finally { setBusy(false); }
  }

  function patch(path: string, value: any) {
    const [group, key] = path.split(".");
    setSettings(current => ({ ...current, [group]: { ...(current as any)[group], [key]: value } }));
  }

  const sections = [
    ["general", "General", "Identity, platform & project type"],
    ["appearance", "Appearance", "Theme, colors & visual identity"],
    ...(isWeb ? [["responsive", "Responsive", "Viewport, navigation & safe areas"]] : []),
    ...(isMobile ? [["mobile", "Mobile app", "Device shell, install & native behavior"]] : []),
    ["accessibility", "Accessibility", "Keyboard, motion & assistive tech"],
    ...(isWeb && !isApi ? [["seo", "SEO & discovery", "Search, metadata & indexing"]] : []),
    ...(isWeb || !isWebsite ? [["data", "Data & behavior", "Persistence, cache & realtime"]] : []),
    ["publishing", "Publishing", "Release channel & domain"],
  ];

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full mt-3 rounded-2xl border border-white/[.07] bg-gradient-to-br from-white/[.045] to-white/[.015] p-3 text-left hover:bg-white/[.06]">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-indigo-300/[.12] border border-indigo-300/[.1] grid place-items-center text-[8px] text-indigo-100">⚙</span>
          <div className="min-w-0 flex-1">
            <div className="text-[8px] uppercase tracking-[.16em] text-white/25">App / project settings</div>
            <div className="text-[9px] text-white/60 mt-1 truncate">{meta.label} · {project.framework || "runtime managed by project"}</div>
          </div>
          <span className="text-white/20">›</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-[4px] p-2 sm:p-4 lg:p-8">
          <div className="h-full max-w-[1220px] mx-auto overflow-hidden rounded-[26px] border border-white/[.1] bg-[#090b0f] shadow-[0_35px_130px_rgba(0,0,0,.6)] flex flex-col">
            <header className="h-16 shrink-0 px-5 border-b border-white/[.07] flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/[.05] border border-white/[.08] grid place-items-center text-sm">⚙</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.18em] text-white/25">App / project settings</div>
                <div className="text-sm text-white/75 mt-0.5 truncate">{project.name}</div>
                <div className="text-[7px] text-white/20 mt-0.5">{meta.label} · {project.runtime || "runtime not specified"} · {project.framework || "framework not specified"}</div>
              </div>
              <button onClick={() => onAsk("Inspect this project's complete settings against its project type, platform target, framework and runtime. Identify configuration gaps and propose concrete production-safe fixes without pretending unavailable providers are connected.")} className="hidden sm:block px-3 py-2 rounded-xl border border-white/[.07] text-[8px] text-white/45">Ask Builder to inspect</button>
              <button onClick={() => setOpen(false)} aria-label="Close settings" className="h-9 w-9 rounded-xl border border-white/[.08] text-white/40 hover:text-white">×</button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
              <nav className="lg:w-[225px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[.07] p-2 lg:p-3 flex lg:flex-col gap-1 overflow-x-auto">
                {sections.map(([key, label, detail]) => (
                  <button key={key} onClick={() => setSection(key)} className={"min-w-[165px] lg:min-w-0 text-left rounded-xl px-3 py-2.5 " + (section === key ? "bg-indigo-300/[.1] border border-indigo-300/[.1]" : "border border-transparent hover:bg-white/[.035]")}>
                    <div className="text-[9px] text-white/65">{label}</div>
                    <div className="text-[7px] text-white/20 mt-1">{detail}</div>
                  </button>
                ))}
              </nav>

              <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
                {section === "general" && <div className="max-w-2xl space-y-4">
                  <Header title="General" text="These settings describe what BizStack is building. The controls are type-aware: a website, web app, mobile app, API and full-stack project do not share the same runtime behavior." />
                  <Badge label={meta.label + " project"} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Application / site name"><input value={settings.identity.appName} onChange={e => patch("identity.appName", e.target.value)} /></Field>
                    <Field label="Short name"><input value={settings.identity.shortName} onChange={e => patch("identity.shortName", e.target.value)} maxLength={20} /></Field>
                  </div>
                  <Field label="Description"><textarea value={settings.identity.description} onChange={e => patch("identity.description", e.target.value)} rows={4} /></Field>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Product shell"><select value={settings.platform.shell} onChange={e => patch("platform.shell", e.target.value)}><option value="website">Website</option><option value="web-app">Web app</option><option value="mobile-app">Mobile app</option><option value="full-stack">Full-stack</option><option value="api">API / service</option></select></Field>
                    <Field label="Primary target"><select value={settings.platform.target} onChange={e => patch("platform.target", e.target.value)}><option value="web">Web</option><option value="android">Android</option><option value="ios">iOS</option><option value="android-ios">Android + iOS</option><option value="server">Server</option></select></Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Default route"><input value={settings.platform.defaultRoute} onChange={e => patch("platform.defaultRoute", e.target.value)} placeholder="/" /></Field>
                    <Field label="Language"><input value={settings.platform.language} onChange={e => patch("platform.language", e.target.value)} placeholder="en" /></Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Timezone"><input value={settings.platform.timezone} onChange={e => patch("platform.timezone", e.target.value)} placeholder="UTC" /></Field>
                    <Field label="Offline behavior"><select value={settings.platform.offlineMode} onChange={e => patch("platform.offlineMode", e.target.value)}><option value="none">Online only</option><option value="cache">Cached where possible</option><option value="offline-first">Offline-first</option></select></Field>
                  </div>
                  {isMobile && <Field label="Device orientation"><select value={settings.platform.orientation} onChange={e => patch("platform.orientation", e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="both">Portrait + landscape</option></select></Field>}
                  {isApi && <Info text="API/service projects use these values as service configuration. Website-only controls such as SEO and visual viewport settings are intentionally hidden." />}
                </div>}

                {section === "appearance" && <div className="max-w-2xl space-y-4">
                  <Header title="Appearance" text="A shared visual identity, with app-specific controls where they make sense." />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Primary color"><input type="color" value={settings.identity.primaryColor} onChange={e => patch("identity.primaryColor", e.target.value)} className="h-11 p-1" /></Field>
                    <Field label="Accent color"><input type="color" value={settings.identity.accentColor} onChange={e => patch("identity.accentColor", e.target.value)} className="h-11 p-1" /></Field>
                  </div>
                  <Field label="Icon / favicon URL"><input value={settings.identity.iconUrl} onChange={e => patch("identity.iconUrl", e.target.value)} placeholder="https://…" /></Field>
                  {isMobile && <Field label="Mobile splash image URL"><input value={settings.identity.splashUrl} onChange={e => patch("identity.splashUrl", e.target.value)} placeholder="https://…" /></Field>}
                  {isWeb && <Field label="Social preview image URL"><input value={settings.identity.socialImageUrl} onChange={e => patch("identity.socialImageUrl", e.target.value)} placeholder="https://…" /></Field>}
                  {isMobile && <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="App theme"><select value={settings.app.theme} onChange={e => patch("app.theme", e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></Field>
                    <Field label="Status bar"><select value={settings.app.statusBar} onChange={e => patch("app.statusBar", e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></Field>
                  </div>}
                </div>}

                {section === "responsive" && <div className="max-w-2xl space-y-4">
                  <Header title="Responsive behavior" text="Web layouts can be fluid, breakpoint-driven or adaptive. Mobile navigation and safe-area behavior are separate from the visual preview." />
                  <Field label="Default preview viewport"><select value={settings.responsive.defaultViewport} onChange={e => patch("responsive.defaultViewport", e.target.value)}><option value="wide">Wide</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></Field>
                  <Field label="Responsive strategy"><select value={settings.responsive.strategy} onChange={e => patch("responsive.strategy", e.target.value)}><option value="fluid">Fluid-first</option><option value="breakpoints">Breakpoint-driven</option><option value="adaptive">Adaptive layouts</option></select></Field>
                  <Field label="Mobile navigation"><select value={settings.responsive.mobileNavigation} onChange={e => patch("responsive.mobileNavigation", e.target.value)}><option value="drawer">Drawer / menu</option><option value="bottom">Bottom navigation</option><option value="top">Top navigation</option></select></Field>
                  <Toggle label="Respect device safe areas" value={settings.responsive.safeAreas} onChange={v => patch("responsive.safeAreas", v)} />
                </div>}

                {section === "mobile" && <div className="max-w-2xl space-y-4">
                  <Header title="Mobile app" text="These controls describe native-style behavior. They do not claim that an Android/iOS build, signing identity, store account or native provider is connected." />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Target"><select value={settings.platform.target} onChange={e => patch("platform.target", e.target.value)}><option value="android">Android</option><option value="ios">iOS</option><option value="android-ios">Android + iOS</option></select></Field>
                    <Field label="Orientation"><select value={settings.platform.orientation} onChange={e => patch("platform.orientation", e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="both">Both</option></select></Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Splash duration (ms)"><input type="number" min={0} max={5000} value={settings.app.splashDurationMs} onChange={e => patch("app.splashDurationMs", Number(e.target.value) || 0)} /></Field>
                    <Field label="Theme"><select value={settings.app.theme} onChange={e => patch("app.theme", e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></Field>
                  </div>
                  <Toggle label="Enable install / add-to-device prompt" value={settings.app.installPrompt} onChange={v => patch("app.installPrompt", v)} />
                  <Toggle label="Enable PWA behavior where the web runtime supports it" value={settings.app.pwa} onChange={v => patch("app.pwa", v)} />
                  <Toggle label="Enable deep-link configuration" value={settings.app.deepLinks} onChange={v => patch("app.deepLinks", v)} />
                  <Toggle label="Enable notification capability configuration" value={settings.app.notifications} onChange={v => patch("app.notifications", v)} />
                </div>}

                {section === "accessibility" && <div className="max-w-2xl space-y-3">
                  <Header title="Accessibility" text="These are project defaults, not a substitute for testing the generated interface with real assistive technology." />
                  <Toggle label="Respect reduced-motion preferences" value={settings.accessibility.reducedMotion} onChange={v => patch("accessibility.reducedMotion", v)} />
                  <Toggle label="Strong keyboard focus indicators" value={settings.accessibility.highContrastFocus} onChange={v => patch("accessibility.highContrastFocus", v)} />
                  <Toggle label="Keyboard navigation as a first-class interaction" value={settings.accessibility.keyboardNavigation} onChange={v => patch("accessibility.keyboardNavigation", v)} />
                  <Toggle label="Require meaningful screen-reader labels" value={settings.accessibility.screenReaderLabels} onChange={v => patch("accessibility.screenReaderLabels", v)} />
                  <Toggle label="Respect user text-size / scaling preferences" value={settings.accessibility.textScaling} onChange={v => patch("accessibility.textScaling", v)} />
                </div>}

                {section === "seo" && <div className="max-w-2xl space-y-4">
                  <Header title="SEO & discovery" text="Website and web-app metadata configuration. Saving these values does not claim that a search engine has indexed the project." />
                  <Toggle label="Enable SEO controls" value={settings.seo.enabled} onChange={v => patch("seo.enabled", v)} />
                  <Field label="Indexing policy"><select value={settings.seo.indexing} onChange={e => patch("seo.indexing", e.target.value)}><option value="index">Allow indexing</option><option value="noindex">Discourage indexing</option></select></Field>
                  <Field label="Title template"><input value={settings.seo.titleTemplate} onChange={e => patch("seo.titleTemplate", e.target.value)} placeholder="%s · Brand" /></Field>
                  <Field label="Canonical base URL"><input value={settings.seo.canonicalBase} onChange={e => patch("seo.canonicalBase", e.target.value)} placeholder="https://example.com" /></Field>
                  <Field label="Default description"><textarea value={settings.seo.defaultDescription} onChange={e => patch("seo.defaultDescription", e.target.value)} rows={4} /></Field>
                  <div className="grid sm:grid-cols-2 gap-3"><Toggle label="Generate sitemap configuration" value={settings.seo.sitemap} onChange={v => patch("seo.sitemap", v)} /><Toggle label="Generate robots configuration" value={settings.seo.robots} onChange={v => patch("seo.robots", v)} /></div>
                </div>}

                {section === "data" && <div className="max-w-2xl space-y-4">
                  <Header title="Data & behavior" text="Runtime behavior for state, caching, uploads and realtime data. Provider credentials and actual database connections remain separate integration concerns." />
                  <Field label="Persistence model"><select value={settings.data.persistence} onChange={e => patch("data.persistence", e.target.value)}><option value="none">No persistence</option><option value="local">Local / device</option><option value="remote">Remote backend</option><option value="hybrid">Hybrid local + remote</option></select></Field>
                  <Field label="Cache policy"><select value={settings.data.cachePolicy} onChange={e => patch("data.cachePolicy", e.target.value)}><option value="standard">Standard</option><option value="aggressive">Aggressive</option><option value="network-first">Network first</option></select></Field>
                  <Toggle label="Realtime data surfaces" value={settings.data.realtime} onChange={v => patch("data.realtime", v)} />
                  <Toggle label="User file / media uploads" value={settings.data.uploads} onChange={v => patch("data.uploads", v)} />
                  {isApi && <Info text="For an API project, persistence/realtime/uploads describe intended capabilities only. Actual services must be configured through the project's backend integrations." />}
                </div>}

                {section === "publishing" && <div className="max-w-2xl space-y-4">
                  <Header title="Publishing" text="Release configuration is separate from deployment, DNS verification, app signing and store submission." />
                  <Field label="Release channel"><select value={settings.publishing.releaseChannel} onChange={e => patch("publishing.releaseChannel", e.target.value)}><option value="development">Development</option><option value="preview">Preview</option><option value="production">Production</option></select></Field>
                  <Field label="Version label"><input value={settings.publishing.versionLabel} onChange={e => patch("publishing.versionLabel", e.target.value)} placeholder="0.1.0" /></Field>
                  {isWeb && <Field label="Custom domain"><input value={settings.publishing.customDomain} onChange={e => patch("publishing.customDomain", e.target.value)} placeholder="www.example.com" /></Field>}
                  <Toggle label="Protect preview environment" value={settings.publishing.previewProtection} onChange={v => patch("publishing.previewProtection", v)} />
                  <Info text="BizStack records these settings as project configuration. It does not pretend a domain is verified, a mobile package is signed, a store listing exists, or a deployment succeeded until the corresponding provider workflow actually confirms it." />
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

function Header({ title, text }: { title: string; text: string }) {
  return <div><h3 className="text-lg">{title}</h3><p className="text-[9px] text-white/25 mt-1 leading-4">{text}</p></div>;
}

function Badge({ label }: { label: string }) {
  return <div className="inline-flex rounded-full border border-indigo-300/[.12] bg-indigo-300/[.06] px-3 py-1.5 text-[8px] text-indigo-100/70">{label}</div>;
}

function Info({ text }: { text: string }) {
  return <div className="rounded-2xl border border-amber-200/[.08] bg-amber-200/[.025] p-3 text-[8px] leading-4 text-amber-100/45">{text}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="text-[8px] text-white/35 block mb-1">{label}</span>{children}</label>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!value)} className="w-full min-h-11 flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.02] p-3 text-left"><span className={"h-6 w-10 shrink-0 rounded-full p-1 transition " + (value ? "bg-indigo-300/50" : "bg-white/[.08]")}><span className={"block h-4 w-4 rounded-full bg-white transition " + (value ? "translate-x-4" : "")} /></span><span className="text-[9px] text-white/60">{label}</span></button>;
}
