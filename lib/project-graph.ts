import type { RouteEntry } from "./project-graph-types";

export type ProjectGraphNode = {
  id: string;
  kind: "route" | "component" | "api" | "style" | "asset" | "config" | "data" | "integration" | "unknown";
  label: string;
  path: string;
  route?: string;
  evidence: string[];
};

export type ProjectGraphElement = {
  id: string;
  route: string;
  source: string;
  tag: string;
  label: string;
  line: number;
  text: string;
  className: string;
  selectorHint: string;
  evidence: string[];
};

export type ProjectGraph = {
  projectId: string;
  generatedAt: string;
  routes: RouteEntry[];
  nodes: ProjectGraphNode[];
  elements: ProjectGraphElement[];
  edges: Array<{ from: string; to: string; reason: string }>;
  summary: {
    files: number;
    routes: number;
    components: number;
    elements: number;
    apiSurfaces: number;
    styles: number;
    assets: number;
    dataSurfaces: number;
    integrations: number;
  };
};

export type GraphFile = {
  path: string;
  content?: string | null;
  language?: string | null;
};

function routeFromFile(path: string): RouteEntry | null {
  if (path.startsWith("app/") && /(?:^|\/)page\.(tsx|ts|jsx|js|mdx)$/.test(path)) {
    const relative = path.slice(4).replace(/\\/g, "/").replace(/\/page\.(tsx|ts|jsx|js|mdx)$/, "");
    const segments = relative.split("/").filter(Boolean).filter((s) => !/^\(.+\)$/.test(s)).map((s) => {
      if (/^\[\[\.\.\..+\]\]$/.test(s) || /^\[\.\.\..+\]$/.test(s)) return ":catchall";
      if (/^\[.+\]$/.test(s)) return ":" + s.slice(1, -1);
      return s;
    });
    return { path: "/" + segments.join("/"), source: path, label: segments.length ? segments.join(" / ") : "Home", dynamic: segments.some((s) => s.startsWith(":")) };
  }
  if (path.startsWith("pages/") && /\.(tsx|ts|jsx|js|mdx)$/.test(path)) {
    const relative = path.slice(6).replace(/\.(tsx|ts|jsx|js|mdx)$/, "").replace(/\/index$/, "");
    const route = relative ? "/" + relative : "/";
    return { path: route, source: path, label: relative || "Home", dynamic: route.split("/").some((s) => /^\[/.test(s)) };
  }
  return null;
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function extractElements(route: RouteEntry, source: string): ProjectGraphElement[] {
  const lines = source.split("\n");
  const pattern = /<([A-Za-z][A-Za-z0-9_.-]*)\b([^>]*)>/g;
  const counts = new Map<string, number>();
  const elements: ProjectGraphElement[] = [];

  for (const match of source.matchAll(pattern)) {
    const tag = String(match[1]);
    if (/^(Fragment|React\.Fragment)$/.test(tag)) continue;
    const index = match.index ?? 0;
    const line = source.slice(0, index).split("\n").length;
    const lower = tag.toLowerCase();
    const occurrence = (counts.get(lower) || 0) + 1;
    counts.set(lower, occurrence);
    const attributes = String(match[2] || "");
    const className = (attributes.match(/className\s*=\s*["'\{]([^"'\}\n]+)["'\}]/)?.[1] || "").trim().slice(0, 240);
    const nearby = cleanInlineText((lines[line - 1] || "")).replace(/<[^>]+>/g, "").trim();
    const label = tag.length <= 3 ? tag.toUpperCase() + " " + occurrence : tag + " " + occurrence;
    elements.push({
      id: "element:" + route.path + ":" + line + ":" + occurrence,
      route: route.path,
      source: route.source,
      tag,
      label,
      line,
      text: nearby,
      className,
      selectorHint: tag.toLowerCase() + "[source=\"" + route.source + "#L" + line + "\"]",
      evidence: ["source-backed JSX opening tag at line " + line]
    });
    if (elements.length >= 160) break;
  }

  return elements;
}

export function buildProjectGraph(projectId: string, files: GraphFile[]): ProjectGraph {
  const nodes: ProjectGraphNode[] = [];
  const elements: ProjectGraphElement[] = [];
  const edges: ProjectGraph["edges"] = [];
  const routes: RouteEntry[] = [];
  const seenRoutes = new Set<string>();

  for (const file of files) {
    const path = file.path.replace(/\\/g, "/");
    const text = file.content || "";
    const route = routeFromFile(path);

    if (route && !seenRoutes.has(route.path)) {
      seenRoutes.add(route.path);
      routes.push(route);
      nodes.push({ id: "route:" + route.path, kind: "route", label: route.label, path, route: route.path, evidence: ["file-backed route: " + path] });
      for (const element of extractElements(route, text)) {
        elements.push(element);
        edges.push({ from: "route:" + route.path, to: element.id, reason: "route contains source-backed element" });
      }
    }

    const component = /(?:^|\/)components\//.test(path) || /\.(tsx|jsx)$/.test(path) && /export\s+(?:default\s+)?function\s+[A-Z]|const\s+[A-Z][A-Za-z0-9_]*\s*=/.test(text);
    if (component) nodes.push({ id: "component:" + path, kind: "component", label: path.split("/").pop() || path, path, evidence: ["component/source syntax detected"] });

    if (/(?:^|\/)api\//.test(path) || /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\b/.test(text)) {
      nodes.push({ id: "api:" + path, kind: "api", label: path.split("/").slice(-2).join("/"), path, evidence: ["API route surface detected"] });
    }

    if (/\.(css|scss|sass|less)$/.test(path) || /tailwind\.config|postcss\.config/.test(path)) {
      nodes.push({ id: "style:" + path, kind: "style", label: path.split("/").pop() || path, path, evidence: ["style/config source detected"] });
    }

    if (/\.(png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf)$/.test(path)) {
      nodes.push({ id: "asset:" + path, kind: "asset", label: path.split("/").pop() || path, path, evidence: ["static asset detected"] });
    }

    if (hasAny(path + "\n" + text, [/supabase/i, /from\(["'](?:products|customers|orders|inventory|businesses|websites|website_pages)["']\)/i, /prisma/i, /drizzle/i])) {
      nodes.push({ id: "data:" + path, kind: "data", label: path.split("/").pop() || path, path, evidence: ["database/data access evidence detected"] });
    }

    if (hasAny(path + "\n" + text, [/stripe/i, /paystack/i, /flutterwave/i, /shopify/i, /googleapis/i, /google\s+calendar/i, /whatsapp/i, /resend/i, /sendgrid/i, /slack/i])) {
      nodes.push({ id: "integration:" + path, kind: "integration", label: path.split("/").pop() || path, path, evidence: ["integration/provider reference detected"] });
    }

    if (/next\.config|vercel\.json|package\.json|tsconfig\.json|\.env/.test(path)) {
      nodes.push({ id: "config:" + path, kind: "config", label: path.split("/").pop() || path, path, evidence: ["project configuration detected"] });
    }

    if (route) {
      const imports = Array.from(text.matchAll(/from\s+["']([^"']+)["']/g)).map((m) => m[1]);
      for (const imported of imports) {
        if (imported.startsWith("@/components/")) {
          edges.push({ from: "route:" + route.path, to: "component:" + imported.replace("@/", ""), reason: "route imports component" });
        }
        if (imported.startsWith("@/lib/")) {
          edges.push({ from: "route:" + route.path, to: "unknown:" + imported, reason: "route imports project library" });
        }
      }
    }
  }

  const counts = (kind: ProjectGraphNode["kind"]) => nodes.filter((n) => n.kind === kind).length;
  return {
    projectId,
    generatedAt: new Date().toISOString(),
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    nodes,
    elements,
    edges,
    summary: {
      files: files.length,
      routes: routes.length,
      components: counts("component"),
      elements: elements.length,
      apiSurfaces: counts("api"),
      styles: counts("style"),
      assets: counts("asset"),
      dataSurfaces: counts("data"),
      integrations: counts("integration")
    }
  };
}
