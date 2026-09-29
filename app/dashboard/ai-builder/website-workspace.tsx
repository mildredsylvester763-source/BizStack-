"use client";

import { useEffect, useMemo, useState } from "react";
import WebsiteMobileToolbar from "./website-mobile-toolbar";
import WebsiteDesignMode from "./website-design-mode";
import WebsiteBlueprint from "./website-blueprint";
import WebsiteDesignSystem from "./website-design-system";
import WebsiteDesignVariants from "./website-design-variants";
import WebsiteSiteSystems from "./website-site-systems";
import WebsiteReferenceStudio from "./website-reference-studio";
import WebsiteComponentLibrary from "./website-component-library";
import WebsiteProjectSettings from "./website-project-settings";

type Project = {
  id: string;
  name: string;
  slug: string;
  project_type: string;
  status: string;
  default_branch: string;
  framework: string | null;
  runtime: string | null;
  repository_name: string | null;
  preview_url: string | null;
  production_url: string | null;
  updated_at: string;
};

type ProjectFile = {
  id: string;
  path: string;
  content: string | null;
  content_sha: string | null;
  language: string | null;
  size_bytes: number;
  is_binary: boolean;
  version_no: number;
  updated_at: string;
};

type RouteEntry = {
  path: string;
  source: string;
  label: string;
  dynamic: boolean;
};

type DeviceKey = "wide" | "desktop" | "tablet" | "mobile";

const DEVICES: Record<DeviceKey, { label: string; width: number }> = {
  wide: { label: "Wide", width: 1440 },
  desktop: { label: "Desktop", width: 1200 },
  tablet: { label: "Tablet", width: 768 },
  mobile: { label: "Mobile", width: 390 }
};

function normalizeRouteSegment(segment: string) {
  if (/^\(.+\)$/.test(segment)) return "";
  if (/^\[\[\.\.\..+\]\]$/.test(segment)) return ":catchall";
  if (/^\[\.\.\..+\]$/.test(segment)) return ":catchall";
  if (/^\[.+\]$/.test(segment)) return ":" + segment.slice(1, -1);
  return segment;
}

function humanizeRoute(path: string) {
  if (path === "/") return "Home";
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/^:/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(" / ");
}

function routeFromFile(path: string): RouteEntry | null {
  const appIndex = path.indexOf("app/");
  if (appIndex === 0) {
    const relative = path
      .slice(4)
      .replace(/\\/g, "/")
      .replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "");
    const segments = relative
      .split("/")
      .map(normalizeRouteSegment)
      .filter(Boolean);
    const route = "/" + segments.join("/");
    return {
      path: route === "/" ? "/" : route.replace(/\/+/g, "/"),
      source: path,
      label: humanizeRoute(route === "" ? "/" : route),
      dynamic: segments.some((segment) => segment.startsWith(":"))
    };
  }

  if (path.startsWith("pages/")) {
    const relative = path
      .slice(6)
      .replace(/\\/g, "/")
      .replace(/\.(tsx|ts|jsx|js|mdx)$/, "")
      .replace(/\/index$/, "");
    const route = relative ? "/" + relative : "/";
    return {
      path: route,
      source: path,
      label: humanizeRoute(route),
      dynamic: route.split("/").some((segment) => segment.startsWith("["))
    };
  }

  return null;
}

function inferElementMap(content: string | null) {
  const text = content || "";
  const pattern = /<(h[1-6]|button|Button|a|Link|img|Image|form|section|header|footer|nav|main)\b[^>]*>/g;
  const counts = new Map<string, number>();
  const lines = text.split("\n");
  const items: Array<{
    id: string;
    label: string;
    prompt: string;
    count: number;
    line: number;
    excerpt: string;
  }> = [];

  for (const match of text.matchAll(pattern)) {
    const tag = String(match[1]);
    const index = match.index ?? 0;
    const line = text.slice(0, index).split("\n").length;
    const occurrence = (counts.get(tag.toLowerCase()) || 0) + 1;
    counts.set(tag.toLowerCase(), occurrence);
    const normalized = tag.toLowerCase();
    const labelTag = normalized === "link" ? "Link" : normalized === "button" ? "Button" : tag[0].toUpperCase() + tag.slice(1);
    const excerpt = (lines[line - 1] || "").trim().slice(0, 150);
    items.push({
      id: normalized + "-" + occurrence + "-" + line,
      label: labelTag + " " + occurrence,
      prompt: "the " + labelTag.toLowerCase() + " element near source line " + line,
      count: 1,
      line,
      excerpt
    });
    if (items.length >= 80) break;
  }

  return items;
}

export default function WebsiteWorkspace({
  project,
  files,
  initialPreviewUrl,
  onPreviewUrlChange,
  onAskAI,
  onCreateProject
}: {
  project: Project | null;
  files: ProjectFile[];
  initialPreviewUrl: string;
  onPreviewUrlChange: (url: string) => void;
  onAskAI: (prompt: string) => void;
  onCreateProject: () => void;
}) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [route, setRoute] = useState("/");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [focusMode, setFocusMode] = useState<"page" | "elements">("page");
  const [designModeOpen, setDesignModeOpen] = useState(false);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [liveElement, setLiveElement] = useState<{
    tag: string;
    text: string;
    selector: string;
    className: string;
    href: string;
    computed?: Record<string, string>;
  } | null>(null);
  const [sourceGraph, setSourceGraph] = useState<{
    summary: { files: number; routes: number; components: number; elements: number; apiSurfaces: number; styles: number; assets: number; dataSurfaces: number; integrations: number };
    nodes: Array<{ id: string; kind: string; label: string; path: string; route?: string; evidence: string[] }>;
    elements: Array<{ id: string; route: string; source: string; tag: string; label: string; line: number; text: string; className: string; selectorHint: string; evidence: string[] }>;
  } | null>(null);
  const [graphBusy, setGraphBusy] = useState(false);
  const [graphError, setGraphError] = useState("");

  useEffect(() => {
    if (!project?.id) {
      setSourceGraph(null);
      return;
    }
    let cancelled = false;
    setGraphBusy(true);
    setGraphError("");
    fetch("/api/projects/" + encodeURIComponent(project.id) + "/graph", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Project graph could not be loaded.");
        if (!cancelled) setSourceGraph(payload.graph || null);
      })
      .catch((error) => {
        if (!cancelled) setGraphError(error instanceof Error ? error.message : "Project graph could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setGraphBusy(false);
      });
    return () => { cancelled = true; };
  }, [project?.id]);

  const routes = useMemo(() => {
    const byRoute = new Map<string, RouteEntry>();
    for (const file of files) {
      const entry = routeFromFile(file.path);
      if (entry && !byRoute.has(entry.path)) byRoute.set(entry.path, entry);
    }
    const list = Array.from(byRoute.values());
    if (!list.some((item) => item.path === "/")) {
      list.unshift({ path: "/", source: "Project root", label: "Home", dynamic: false });
    }
    return list.sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)));
  }, [files]);

  const selectedRoute = routes.find((item) => item.path === route) || routes[0] || null;
  const selectedFile = selectedRoute ? files.find((file) => file.path === selectedRoute.source) : null;
  const elementMap = useMemo(() => {
    const graphElements = sourceGraph?.elements
      ?.filter((item) => item.route === (selectedRoute?.path || "/") && item.source === (selectedRoute?.source || ""))
      .map((item) => ({
        id: item.id,
        label: item.label,
        prompt: "the " + item.label.toLowerCase() + " in the source-backed element graph",
        count: 1,
        line: item.line,
        excerpt: item.text || item.className || item.tag
      })) || [];
    return graphElements.length ? graphElements : inferElementMap(selectedFile?.content ?? null);
  }, [sourceGraph, selectedFile, selectedRoute?.path, selectedRoute?.source]);
  const basePreviewUrl = initialPreviewUrl || project?.preview_url || "";

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== "bizstack-design-bridge") return;
      if (event.data.type !== "bizstack-design-select") return;
      if (!basePreviewUrl) return;
      try {
        const allowedOrigin = new URL(basePreviewUrl).origin;
        if (event.origin !== allowedOrigin) return;
      } catch {
        return;
      }
      const element = event.data.element;
      if (!element || typeof element !== "object") return;
      setLiveElement({
        tag: String(element.tag || "element"),
        text: String(element.text || ""),
        selector: String(element.selector || ""),
        className: String(element.className || ""),
        href: String(element.href || ""),
        computed: element.computed && typeof element.computed === "object"
          ? Object.fromEntries(Object.entries(element.computed).map(([key, value]) => [key, String(value ?? "")]))
          : undefined
      });
      setDesignModeOpen(true);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [basePreviewUrl]);

  const deviceSpec = DEVICES[device];

  function buildRouteUrl(base: string, routePath: string, designMode = false) {
    if (!base) return "";
    try {
      const url = new URL(base);
      url.pathname = routePath || "/";
      url.search = "";
      if (designMode) url.searchParams.set("bizstackDesignMode", "1");
      url.hash = "";
      return url.toString();
    } catch {
      return base;
    }
  }

  async function startPreview() {
    if (!project || previewBusy) return;
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/preview", {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Preview could not be started.");
      const url = String(payload.url || "");
      if (!url) throw new Error("Preview started without a URL.");
      onPreviewUrlChange(url);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Preview could not be started.");
    } finally {
      setPreviewBusy(false);
    }
  }

  function askPage(action: string) {
    const routeLabel = selectedRoute?.path || "/";
    const source = selectedRoute?.source ? " Source: " + selectedRoute.source + "." : "";
    onAskAI(action + " on the " + routeLabel + " page." + source);
  }

  if (!project) {
    return (
      <div className="min-h-[680px] grid place-items-center bg-[#090b0f]">
        <div className="max-w-lg px-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl border border-white/[.08] bg-white/[.025] grid place-items-center text-[8px] text-white/20">WEB</div>
          <h2 className="text-2xl tracking-tight mt-5">Website Creator workspace</h2>
          <p className="text-[10px] text-white/30 leading-5 mt-3">
            Attach a real website project to get its routes, source-backed page graph, responsive preview, and AI controls in one place.
          </p>
          <button onClick={onCreateProject} className="mt-5 px-4 py-2.5 rounded-xl bg-white text-black text-[9px]">
            Create website project
          </button>
        </div>
      </div>
    );
  }

  const previewUrl = buildRouteUrl(basePreviewUrl, selectedRoute?.path || "/", designModeOpen);

  return (
    <div className="min-h-[680px] flex flex-col lg:flex-row bg-[#090b0f] text-white">
      <WebsiteMobileToolbar route={selectedRoute?.path || "/"} routes={routes.map(item => ({path:item.path,label:item.label}))} device={device} onRoute={setRoute} onDevice={setDevice} onAsk={onAskAI} onBlueprint={() => setBlueprintOpen(true)} onDesignMode={() => setDesignModeOpen(true)} />
      <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-white/[.06] bg-[#0d0f13] flex-col">
        <div className="px-3 py-3 border-b border-white/[.06]">
          <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Website Creator</div>
          <div className="text-[10px] text-white/60 mt-1 truncate">{project.name}</div>
          <div className="text-[7px] text-white/20 mt-1">{routes.length} mapped route{routes.length === 1 ? "" : "s"} · {files.length} source files</div>
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[.035] border border-white/[.05]">
            <button
              onClick={() => setFocusMode("page")}
              className={"flex-1 px-2 py-1.5 rounded-lg text-[8px] " + (focusMode === "page" ? "bg-white/[.08] text-white/70" : "text-white/25")}
            >
              Pages
            </button>
            <button
              onClick={() => setFocusMode("elements")}
              className={"flex-1 px-2 py-1.5 rounded-lg text-[8px] " + (focusMode === "elements" ? "bg-white/[.08] text-white/70" : "text-white/25")}
            >
              Elements
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {focusMode === "page" ? (
            <div className="space-y-1">
              {routes.map((item) => (
                <button
                  key={item.path}
                  onClick={() => setRoute(item.path)}
                  className={"w-full text-left rounded-xl px-3 py-2.5 border " + (selectedRoute?.path === item.path ? "bg-indigo-300/[.08] border-indigo-300/[.1] text-white" : "border-transparent text-white/35 hover:bg-white/[.035]")}
                >
                  <div className="text-[9px] truncate">{item.label}</div>
                  <div className="text-[7px] text-white/20 mt-1 truncate">{item.path}</div>
                  {item.dynamic && <div className="text-[7px] text-amber-200/60 mt-1">dynamic route</div>}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {!elementMap.length && (
                <div className="px-3 py-4 text-[8px] leading-4 text-white/20">
                  No recognizable JSX elements were found in the selected page source yet.
                </div>
              )}
              {elementMap.map((item) => (
                <button
                  key={item.id}
                  onClick={() => askPage("Update the " + item.prompt + ". Source line: " + item.line + ". Source excerpt: " + item.excerpt)}
                  className="w-full text-left rounded-xl border border-white/[.05] bg-white/[.02] hover:bg-white/[.045] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/55">{item.label}</span>
                    <span className="ml-auto text-[7px] text-indigo-200/60">{item.count}</span>
                  </div>
                  <div className="text-[7px] text-white/20 mt-1">Line {item.line} · {item.excerpt || "source element"}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[.06] space-y-2">
          <button onClick={() => askPage("Plan a premium redesign")} className="w-full px-3 py-2 rounded-lg bg-white/[.06] text-[8px] text-white/55">
            Plan page redesign
          </button>
          <button onClick={() => askPage("Explain this page structure, data, navigation and integration dependencies")} className="w-full px-3 py-2 rounded-lg border border-white/[.06] text-[8px] text-white/35">
            Explain page
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 flex flex-col">
        <div className="h-12 px-3 border-b border-white/[.06] flex items-center gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-white/55 truncate">{selectedRoute?.label || "Home"}</div>
            <div className="text-[7px] text-white/20 truncate">{selectedRoute?.source || "Project source"}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setBlueprintOpen(true)} className={blueprintOpen ? "px-2.5 py-1.5 rounded-lg bg-indigo-300/[.09] border border-indigo-300/[.1] text-[7px] text-indigo-100" : "px-2.5 py-1.5 rounded-lg border border-white/[.06] text-[7px] text-white/35"}>Blueprint</button>
            {(Object.entries(DEVICES) as [DeviceKey, { label: string; width: number }][]).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setDevice(key)}
                className={"px-2.5 py-1.5 rounded-lg text-[7px] border " + (device === key ? "bg-white/[.09] border-white/[.11] text-white/65" : "border-transparent text-white/20 hover:text-white/45")}
              >
                {value.label}
              </button>
            ))}
            <button onClick={() => void startPreview()} disabled={previewBusy || !project} className="ml-1 px-3 py-1.5 rounded-lg bg-white text-black text-[8px] disabled:opacity-30">
              {previewBusy ? "Starting…" : basePreviewUrl ? "Refresh preview" : "Start preview"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-[#06080b]">
          {!basePreviewUrl ? (
            <div className="h-full min-h-[560px] grid place-items-center">
              <div className="max-w-md text-center">
                <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Live site preview</div>
                <h3 className="text-xl mt-2">Open the real website runtime.</h3>
                <p className="text-[9px] leading-5 text-white/25 mt-3">
                  This preview is tied to the project runtime, not a screenshot or generated mockup. Start it above to load the selected route.
                </p>
                {previewError && <div className="mt-3 text-[8px] text-red-300/80">{previewError}</div>}
                <button onClick={() => void startPreview()} disabled={previewBusy} className="mt-4 px-4 py-2 rounded-xl bg-indigo-300/[.12] border border-indigo-300/[.12] text-[9px] text-indigo-100 disabled:opacity-30">
                  {previewBusy ? "Starting preview…" : "Start website preview"}
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-[560px]">
              <div className="mx-auto transition-all duration-300" style={{ width: "min(100%, " + deviceSpec.width + "px)" }}>
                <div className="rounded-[18px] overflow-hidden border border-white/[.08] bg-white shadow-[0_20px_70px_rgba(0,0,0,.35)]">
                  <div className="h-8 px-3 flex items-center gap-2 border-b border-black/10 bg-[#f6f7f8]">
                    <span className="w-2 h-2 rounded-full bg-black/10" />
                    <span className="w-2 h-2 rounded-full bg-black/10" />
                    <span className="w-2 h-2 rounded-full bg-black/10" />
                    <span className="ml-2 flex-1 text-[7px] text-black/35 truncate">{previewUrl}</span>
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[7px] text-black/45">Open</a>
                  </div>
                  {selectedRoute?.dynamic ? (
                    <div className="min-h-[560px] grid place-items-center text-center p-8">
                      <div className="max-w-sm">
                        <div className="text-[8px] uppercase tracking-[.18em] text-black/30">Dynamic route</div>
                        <p className="text-[11px] text-black/55 leading-5 mt-2">
                          {selectedRoute.path} needs a real route parameter before it can be previewed. Ask Builder to provide a safe preview value or select a static page.
                        </p>
                        <button
                          onClick={() => askPage("Create a safe preview state for this dynamic route")}
                          className="mt-4 px-3 py-2 rounded-lg bg-black text-white text-[8px]"
                        >
                          Ask Builder
                        </button>
                      </div>
                    </div>
                  ) : (
                    <iframe title={"Website preview " + (selectedRoute?.path || "/")} src={previewUrl} className="w-full min-h-[560px] border-0 bg-white" />
                  )}
                </div>
              </div>
              <div className="max-w-[1440px] mx-auto mt-3 flex flex-wrap gap-2 items-center justify-between">
                <div className="text-[7px] text-white/20">
                  {deviceSpec.label} · {deviceSpec.width}px target viewport · route {selectedRoute?.path || "/"}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => askPage("Make this page feel more premium without changing its existing information architecture")} className="px-2.5 py-1.5 rounded-lg border border-white/[.06] text-[7px] text-white/35">Premium</button>
                  <button onClick={() => askPage("Fix the responsive layout for this page at the current " + deviceSpec.label.toLowerCase() + " viewport")} className="px-2.5 py-1.5 rounded-lg border border-white/[.06] text-[7px] text-white/35">Fix responsive</button>
                  <button onClick={() => askPage("Improve accessibility on this page without changing the visual identity")} className="px-2.5 py-1.5 rounded-lg border border-white/[.06] text-[7px] text-white/35">Accessibility</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="hidden lg:block w-[250px] shrink-0 border-l border-white/[.06] bg-[#0d0f13] p-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="text-[8px] uppercase tracking-[.18em] text-white/20">Page context</div>
          <button onClick={() => setDesignModeOpen(v => !v)} className={designModeOpen ? "px-2 py-1 rounded-lg bg-indigo-300/[.1] border border-indigo-300/[.12] text-[7px] text-indigo-100" : "px-2 py-1 rounded-lg border border-white/[.06] text-[7px] text-white/35"}>{designModeOpen ? "Close Design Mode" : "Design Mode"}</button>
        </div>
        {designModeOpen && (
          <div className="mt-3">
            <WebsiteDesignMode route={selectedRoute?.path || "/"} source={selectedRoute?.source || ""} elements={elementMap} liveElement={liveElement} onEnableLive={() => onAskAI("Enable live selection for this website preview. Install the BizStack Design Mode bridge into the real project source, preserve the existing application behavior, checkpoint before changes, and verify the project build after installation.")} onAsk={onAskAI} />
          </div>
        )}
        <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3 mt-2">
          <div className="text-[8px] text-white/25">Route</div>
          <div className="text-[10px] text-white/65 mt-1 break-all">{selectedRoute?.path || "/"}</div>
          <div className="text-[8px] text-white/20 mt-2">Source</div>
          <div className="text-[8px] text-indigo-200/60 mt-1 break-all">{selectedRoute?.source || "Project root"}</div>
        </div>

        <div className="mt-3 rounded-2xl border border-indigo-300/[.08] bg-indigo-300/[.025] p-3">
          <div className="flex items-center justify-between"><div className="text-[8px] text-indigo-100/70">Source intelligence</div>{graphBusy && <div className="text-[6px] text-white/20">scanning…</div>}</div>
          {graphError ? <div className="text-[7px] text-red-300/70 mt-2">{graphError}</div> : sourceGraph ? <>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {[
                ["Routes", sourceGraph.summary.routes],
                ["Elements", sourceGraph.summary.elements],
                ["Components", sourceGraph.summary.components],
                ["API", sourceGraph.summary.apiSurfaces],
                ["Data", sourceGraph.summary.dataSurfaces],
                ["Integrations", sourceGraph.summary.integrations],
                ["Assets", sourceGraph.summary.assets]
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-white/[.05] bg-white/[.02] px-2 py-1.5"><div className="text-[6px] uppercase tracking-wider text-white/20">{label}</div><div className="text-[10px] text-white/60 mt-0.5">{String(value)}</div></div>)}
            </div>
            <div className="text-[7px] text-white/20 leading-4 mt-2">Computed from persisted project files. The agent can use this source-backed graph before making a change.</div>
          </> : <div className="text-[7px] text-white/20 mt-2">No source graph yet.</div>}
        </div>

        <div className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
          <div className="text-[8px] text-white/25">Website graph</div>
          <div className="text-[9px] text-white/55 mt-1">{routes.length} pages/routes mapped</div>
          <div className="text-[7px] text-white/20 mt-1">Derived from the real project source tree.</div>
          <div className="mt-3 space-y-1">
            {routes.slice(0, 8).map((item) => (
              <button key={item.path} onClick={() => setRoute(item.path)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/[.04]">
                <div className="text-[7px] text-white/40 truncate">{item.label}</div>
                <div className="text-[6px] text-white/15 truncate">{item.path}</div>
              </button>
            ))}
            {routes.length > 8 && <div className="text-[7px] text-white/15 px-2">+ {routes.length - 8} more</div>}
          </div>
        </div>

        {project && <WebsiteDesignSystem projectId={project.id} onAsk={onAskAI} />}
        {project && <WebsiteDesignVariants projectId={project.id} route={selectedRoute?.path || "/"} onAsk={onAskAI} />}
        {project && <WebsiteSiteSystems projectId={project.id} route={selectedRoute?.path || "/"} onAsk={onAskAI} />}
        {project && <WebsiteReferenceStudio projectId={project.id} onAsk={onAskAI} />}
        {project && <WebsiteComponentLibrary projectId={project.id} onAsk={onAskAI} />}
        {project && <WebsiteProjectSettings project={project} onAsk={onAskAI} />}

        <div className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
          <div className="text-[8px] text-white/25">Change contract</div>
          <div className="text-[8px] leading-4 text-white/30 mt-2">AI changes should target the actual source behind this page, preserve existing navigation and data, then verify the build before shipping.</div>
        </div>

        <div className="mt-3 space-y-2">
          <button onClick={() => askPage("Show me exactly which files and components would change before you modify this page")} className="w-full px-3 py-2 rounded-xl bg-indigo-300/[.08] border border-indigo-300/[.1] text-[8px] text-indigo-100">
            Show change plan
          </button>
          <button onClick={() => askPage("Inspect this page for visual, responsive, accessibility and performance issues without changing anything")} className="w-full px-3 py-2 rounded-xl border border-white/[.06] text-[8px] text-white/40">
            Inspect without edits
          </button>
        </div>
      </aside>
      {designModeOpen && (
        <div className="lg:hidden fixed inset-0 z-[75] bg-black/70 backdrop-blur-[3px]">
          <button aria-label="Close Design Mode" onClick={() => setDesignModeOpen(false)} className="absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[26px] border-t border-white/[.1] bg-[#0b0e13] shadow-[0_-30px_100px_rgba(0,0,0,.5)] p-3">
            <div className="flex items-center gap-2 px-1 pb-3">
              <div className="h-1 w-10 rounded-full bg-white/15 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <div className="min-w-0 flex-1 pt-2">
                <div className="text-[8px] uppercase tracking-[.18em] text-indigo-100/55">Design Mode</div>
                <div className="text-[7px] text-white/22 truncate mt-0.5">{selectedRoute?.path || "/"} · {selectedRoute?.source || "source-backed page"}</div>
              </div>
              <button onClick={() => setDesignModeOpen(false)} className="h-8 w-8 rounded-xl border border-white/[.08] bg-white/[.04] text-white/35">×</button>
            </div>
            <WebsiteDesignMode
              route={selectedRoute?.path || "/"}
              source={selectedRoute?.source || ""}
              elements={elementMap}
              liveElement={liveElement}
              onEnableLive={() => onAskAI("Enable live selection for this website preview. Install the BizStack Design Mode bridge into the real project source, preserve the existing application behavior, checkpoint before changes, and verify the project build after installation.")}
              onAsk={onAskAI}
            />
            {project && <WebsiteDesignSystem projectId={project.id} onAsk={onAskAI} />}
            {project && <WebsiteDesignVariants projectId={project.id} route={selectedRoute?.path || "/"} onAsk={onAskAI} />}
            {project && <WebsiteSiteSystems projectId={project.id} route={selectedRoute?.path || "/"} onAsk={onAskAI} />}
            {project && <WebsiteReferenceStudio projectId={project.id} onAsk={onAskAI} />}
            {project && <WebsiteComponentLibrary projectId={project.id} onAsk={onAskAI} />}
          </div>
        </div>
      )}
      {blueprintOpen && project && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[4px] p-2 sm:p-4 lg:p-7">
          <div className="relative h-full w-full max-w-[1500px] mx-auto overflow-hidden rounded-[24px] border border-white/[.1] bg-[#090b0e] shadow-[0_30px_120px_rgba(0,0,0,.55)]">
            <button onClick={() => setBlueprintOpen(false)} aria-label="Close Website Blueprint" className="absolute right-4 top-4 z-10 h-9 w-9 rounded-xl border border-white/[.08] bg-black/30 text-white/45 hover:text-white/75">×</button>
            <WebsiteBlueprint projectId={project.id} projectName={project.name} onAskAI={prompt => { setBlueprintOpen(false); onAskAI(prompt); }} />
          </div>
        </div>
      )}
    </div>
  );
}
