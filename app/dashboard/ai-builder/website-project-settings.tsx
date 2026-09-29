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

type Settings = Record<string, Record<string, any>>;

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
  navigation: {
    notFoundRoute: "/404",
    scrollRestoration: "auto",
    breadcrumbs: true,
    externalLinks: "new-tab",
    preserveQuery: true
  },
  appearance: {
    theme: "system",
    fontFamily: "system",
    radius: "comfortable",
    density: "comfortable",
    motion: "standard"
  },
  responsive: {
    defaultViewport: "desktop",
    strategy: "fluid",
    mobileNavigation: "drawer",
    safeAreas: true,
    breakpoints: "sm,md,lg,xl"
  },
  accessibility: {
    reducedMotion: true,
    highContrastFocus: true,
    keyboardNavigation: true,
    screenReaderLabels: true,
    textScaling: true,
    minimumContrast: "AA"
  },
  localization: {
    locale: "en-NG",
    language: "English",
    timezone: "Africa/Lagos",
    direction: "ltr",
    currency: "NGN",
    dateFormat: "locale"
  },
  seo: {
    enabled: true,
    indexing: "index",
    titleTemplate: "%s",
    canonicalBase: "",
    defaultDescription: "",
    sitemap: true,
    robots: true,
    structuredData: true,
    aeo: true
  },
  analytics: {
    enabled: false,
    provider: "none",
    cookieConsent: true,
    productEvents: true,
    errorTracking: true,
    performanceTracking: true,
    anonymize: true
  },
  runtime: {
    mode: "managed",
    nodeVersion: "22",
    packageManager: "npm",
    buildCommand: "npm run build",
    devCommand: "npm run dev",
    startCommand: "npm run start",
    serverMode: "standard",
    concurrency: "auto",
    cacheStrategy: "standard"
  },
  data: {
    persistence: "remote",
    cachePolicy: "standard",
    realtime: false,
    uploads: false,
    maxUploadMb: 25,
    retentionDays: 90
  },
  auth: {
    mode: "project-managed",
    methods: "email",
    emailVerification: true,
    mfa: false,
    sessionDuration: "7d",
    passwordPolicy: "standard"
  },
  security: {
    contentSecurityPolicy: "managed",
    csrf: true,
    rateLimit: "standard",
    allowedOrigins: "",
    auditLogging: true,
    redactPii: true,
    secretPolicy: "environment-only"
  },
  api: {
    enabled: true,
    versioning: "url",
    basePath: "/api",
    cors: "same-origin",
    rateLimit: "standard",
    webhooks: false,
    webhookSigning: "hmac"
  },
  integrations: {
    credentialsMode: "connected-accounts",
    externalWrites: "approval-required",
    webhookVerification: true,
    syncMode: "manual-or-agent",
    failureMode: "surface-and-stop"
  },
  automation: {
    aiMode: "assisted",
    autonomousWrites: false,
    approvalPolicy: "changes-require-review",
    toolPolicy: "project-scoped",
    budgetMode: "standard",
    backgroundJobs: false,
    scheduledJobs: false
  },
  environment: {
    stage: "development",
    region: "auto",
    secretsSource: "managed-environment",
    timezone: "UTC",
    logLevel: "info",
    sourceMaps: true
  },
  domains: {
    primaryDomain: "",
    wwwBehavior: "preserve",
    httpsOnly: true,
    customDomainStatus: "not-configured",
    redirectTrailingSlash: "preserve"
  },
  publishing: {
    releaseChannel: "development",
    versionLabel: "0.1.0",
    previewProtection: false,
    deploymentMode: "manual",
    healthGate: "required",
    buildArtifact: "managed"
  },
  releases: {
    branchPolicy: "feature-branch",
    requireVerifiedBuild: true,
    requireVersionCheckpoint: true,
    rollbackMode: "previous-verified",
    changelog: "generated"
  },
  mobile: {
    packageId: "",
    iosBundleId: "",
    minAndroidSdk: "",
    targetAndroidSdk: "",
    minIosVersion: "",
    orientation: "both",
    installPrompt: false,
    pwa: false,
    deepLinks: false,
    notifications: false,
    statusBar: "system"
  },
  developer: {
    sourceRoot: "/",
    appDirectory: "app",
    envFilePolicy: "managed",
    typeChecking: "strict",
    linting: "required",
    formatting: "prettier",
    sourceMaps: true,
    generatedFiles: "separate",
    codeGeneration: "governed",
    packageScripts: "visible",
    buildOutput: ".next",
    artifactInspection: true
  }
};

const TYPE_META: Record<string, { label: string; shell: string; target: string }> = {
  website: { label: "Website", shell: "website", target: "web" },
  web: { label: "Web App", shell: "web-app", target: "web" },
  app: { label: "App", shell: "web-app", target: "web" },
  mobile: { label: "Mobile App", shell: "mobile-app", target: "android-ios" },
  "full-stack": { label: "Full-stack", shell: "full-stack", target: "web" },
  api: { label: "API / Service", shell: "api", target: "server" },
  platform: { label: "Platform", shell: "full-stack", target: "web" }
};

type Option = [string, string];
type FieldDef = {
  key: string;
  label: string;
  detail?: string;
  kind?: "text" | "textarea" | "select" | "toggle" | "number" | "color";
  placeholder?: string;
  options?: Option[];
  min?: number;
  max?: number;
};

type SectionDef = {
  key: string;
  label: string;
  detail: string;
  group: string;
  icon: string;
  visible: boolean;
  fields: FieldDef[];
  note?: string;
};

const webShells = ["website", "web-app", "full-stack"];
const mobileShells = ["mobile-app"];

function mergeSettings(value: any, project: Project): Settings {
  const saved = value && typeof value === "object" ? value : {};
  const meta = TYPE_META[project.project_type] || TYPE_META.app;
  const merged: Settings = {};
  for (const key of Object.keys(DEFAULTS)) merged[key] = { ...DEFAULTS[key], ...(saved[key] || {}) };
  merged.identity.appName = merged.identity.appName || project.name;
  merged.identity.shortName = merged.identity.shortName || project.name.slice(0, 12);
  merged.platform.shell = merged.platform.shell || meta.shell;
  merged.platform.target = merged.platform.target || meta.target;
  if (project.project_type === "mobile") merged.platform.shell = "mobile-app";
  if (project.project_type === "api") merged.platform.shell = "api";
  return merged;
}

function typeMeta(projectType: string) {
  return TYPE_META[projectType] || { label: projectType || "Project", shell: "web-app", target: "web" };
}

function sectionDefs(project: Project, settings: Settings): SectionDef[] {
  const shell = settings.platform?.shell;
  const isWeb = webShells.includes(shell);
  const isMobile = mobileShells.includes(shell);
  const isApi = shell === "api";
  const browser = isWeb || isMobile;
  const commonFields: Record<string, FieldDef[]> = {
    identity: [
      { key: "appName", label: "Application / site name", detail: "The user-facing product name." },
      { key: "shortName", label: "Short name", detail: "Compact name used where space is limited.", placeholder: "Up to 20 characters" },
      { key: "description", label: "Description", kind: "textarea", detail: "Default description for the product and generated metadata." }
    ],
    platform: [
      { key: "shell", label: "Product shell", kind: "select", options: [["website", "Website"], ["web-app", "Web app"], ["mobile-app", "Mobile app"], ["full-stack", "Full-stack"], ["api", "API / service"]] },
      { key: "target", label: "Primary target", kind: "select", options: [["web", "Web"], ["android", "Android"], ["ios", "iOS"], ["android-ios", "Android + iOS"], ["server", "Server"]] },
      { key: "defaultRoute", label: "Default route", detail: "Entry route used when no route is supplied.", placeholder: "/" },
      { key: "offlineMode", label: "Offline behavior", kind: "select", options: [["none", "Online only"], ["cache", "Cache where possible"], ["offline-first", "Offline-first"]] }
    ],
    navigation: [
      { key: "notFoundRoute", label: "Not-found route", placeholder: "/404" },
      { key: "scrollRestoration", label: "Scroll restoration", kind: "select", options: [["auto", "Browser / framework default"], ["top", "Always start at top"], ["preserve", "Preserve where possible"]] },
      { key: "breadcrumbs", label: "Breadcrumbs", kind: "toggle" },
      { key: "externalLinks", label: "External link behavior", kind: "select", options: [["same-tab", "Same tab"], ["new-tab", "New tab"], ["prompt", "Ask first"]] },
      { key: "preserveQuery", label: "Preserve query parameters during navigation", kind: "toggle" }
    ],
    appearance: [
      { key: "theme", label: "Theme", kind: "select", options: [["system", "System"], ["light", "Light"], ["dark", "Dark"]] },
      { key: "fontFamily", label: "Default font strategy", kind: "select", options: [["system", "System stack"], ["project", "Project font"], ["custom", "Custom loaded font"]] },
      { key: "radius", label: "Corner language", kind: "select", options: [["compact", "Compact"], ["comfortable", "Comfortable"], ["rounded", "Rounded"]] },
      { key: "density", label: "Interface density", kind: "select", options: [["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]] },
      { key: "motion", label: "Motion level", kind: "select", options: [["reduced", "Reduced"], ["standard", "Standard"], ["expressive", "Expressive"]] },
    ],
    responsive: [
      { key: "defaultViewport", label: "Default preview viewport", kind: "select", options: [["wide", "Wide"], ["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]] },
      { key: "strategy", label: "Responsive strategy", kind: "select", options: [["fluid", "Fluid-first"], ["breakpoints", "Breakpoint-driven"], ["adaptive", "Adaptive"]] },
      { key: "mobileNavigation", label: "Mobile navigation", kind: "select", options: [["drawer", "Drawer / menu"], ["bottom", "Bottom navigation"], ["top", "Top navigation"]] },
      { key: "breakpoints", label: "Breakpoint tokens", detail: "Comma-separated tokens used by the design system.", placeholder: "sm,md,lg,xl" },
      { key: "safeAreas", label: "Respect device safe areas", kind: "toggle" }
    ],
    accessibility: [
      { key: "reducedMotion", label: "Respect reduced-motion preferences", kind: "toggle" },
      { key: "highContrastFocus", label: "Strong keyboard focus indicators", kind: "toggle" },
      { key: "keyboardNavigation", label: "Keyboard navigation as a first-class interaction", kind: "toggle" },
      { key: "screenReaderLabels", label: "Require meaningful screen-reader labels", kind: "toggle" },
      { key: "textScaling", label: "Respect user text-size / scaling preferences", kind: "toggle" },
      { key: "minimumContrast", label: "Minimum contrast target", kind: "select", options: [["AA", "WCAG AA"], ["AAA", "WCAG AAA"], ["custom", "Project-specific"]] }
    ],
    localization: [
      { key: "language", label: "Default language" },
      { key: "locale", label: "Default locale", placeholder: "en-NG" },
      { key: "timezone", label: "Default timezone", placeholder: "Africa/Lagos" },
      { key: "direction", label: "Text direction", kind: "select", options: [["ltr", "Left to right"], ["rtl", "Right to left"], ["auto", "Locale-driven"]] },
      { key: "currency", label: "Default currency", placeholder: "NGN" },
      { key: "dateFormat", label: "Date / number formatting", kind: "select", options: [["locale", "Locale-driven"], ["iso", "ISO-oriented"], ["custom", "Project-defined"]] }
    ],
    seo: [
      { key: "enabled", label: "Enable SEO controls", kind: "toggle" },
      { key: "indexing", label: "Indexing policy", kind: "select", options: [["index", "Allow indexing"], ["noindex", "Do not index"]] },
      { key: "titleTemplate", label: "Title template", placeholder: "%s · Brand" },
      { key: "canonicalBase", label: "Canonical base URL", placeholder: "https://example.com" },
      { key: "defaultDescription", label: "Default description", kind: "textarea" },
      { key: "sitemap", label: "Sitemap configuration", kind: "toggle" },
      { key: "robots", label: "Robots configuration", kind: "toggle" },
      { key: "structuredData", label: "Structured data defaults", kind: "toggle" },
      { key: "aeo", label: "Answer-engine / AEO guidance", kind: "toggle" }
    ],
    analytics: [
      { key: "enabled", label: "Enable analytics", kind: "toggle" },
      { key: "provider", label: "Analytics provider", kind: "select", options: [["none", "Not configured"], ["internal", "BizStack / project analytics"], ["custom", "Custom provider"]] },
      { key: "cookieConsent", label: "Require consent where applicable", kind: "toggle" },
      { key: "productEvents", label: "Product event instrumentation", kind: "toggle" },
      { key: "errorTracking", label: "Error tracking", kind: "toggle" },
      { key: "performanceTracking", label: "Performance tracking", kind: "toggle" },
      { key: "anonymize", label: "Anonymize analytics identifiers", kind: "toggle" }
    ],
    runtime: [
      { key: "mode", label: "Runtime mode", kind: "select", options: [["managed", "BizStack-managed"], ["custom", "Custom runtime"], ["external", "Externally hosted"]] },
      { key: "nodeVersion", label: "Node version", placeholder: "22" },
      { key: "packageManager", label: "Package manager", kind: "select", options: [["npm", "npm"], ["pnpm", "pnpm"], ["yarn", "Yarn"], ["bun", "Bun"]] },
      { key: "buildCommand", label: "Build command", placeholder: "npm run build" },
      { key: "devCommand", label: "Development command", placeholder: "npm run dev" },
      { key: "startCommand", label: "Start command", placeholder: "npm run start" },
      { key: "serverMode", label: "Server mode", kind: "select", options: [["standard", "Standard"], ["edge", "Edge where supported"], ["static", "Static output"]] },
      { key: "concurrency", label: "Concurrency", kind: "select", options: [["auto", "Automatic"], ["low", "Conservative"], ["high", "Higher throughput"]] },
      { key: "cacheStrategy", label: "Build/runtime cache", kind: "select", options: [["standard", "Standard"], ["aggressive", "Aggressive"], ["disabled", "Disabled"]] }
    ],
    data: [
      { key: "persistence", label: "Persistence model", kind: "select", options: [["none", "No persistence"], ["local", "Local / device"], ["remote", "Remote backend"], ["hybrid", "Hybrid local + remote"]] },
      { key: "cachePolicy", label: "Cache policy", kind: "select", options: [["standard", "Standard"], ["aggressive", "Aggressive"], ["network-first", "Network first"]] },
      { key: "realtime", label: "Realtime data surfaces", kind: "toggle" },
      { key: "uploads", label: "User file / media uploads", kind: "toggle" },
      { key: "maxUploadMb", label: "Maximum upload size (MB)", kind: "number", min: 1, max: 2048 },
      { key: "retentionDays", label: "Default retention window (days)", kind: "number", min: 0, max: 3650 }
    ],
    auth: [
      { key: "mode", label: "Authentication mode", kind: "select", options: [["project-managed", "Project-managed auth"], ["external", "External identity provider"], ["none", "No authentication"]] },
      { key: "methods", label: "Allowed sign-in methods", placeholder: "email,google,apple" },
      { key: "emailVerification", label: "Require email verification", kind: "toggle" },
      { key: "mfa", label: "Multi-factor authentication", kind: "toggle" },
      { key: "sessionDuration", label: "Default session duration", kind: "select", options: [["1d", "1 day"], ["7d", "7 days"], ["30d", "30 days"], ["session", "Session only"]] },
      { key: "passwordPolicy", label: "Password policy", kind: "select", options: [["standard", "Standard"], ["strong", "Strong"], ["custom", "Project-defined"]] }
    ],
    security: [
      { key: "contentSecurityPolicy", label: "Content Security Policy", kind: "select", options: [["managed", "Managed"], ["strict", "Strict"], ["custom", "Custom policy"]] },
      { key: "csrf", label: "CSRF protection", kind: "toggle" },
      { key: "rateLimit", label: "Default rate limiting", kind: "select", options: [["standard", "Standard"], ["strict", "Strict"], ["custom", "Custom"]] },
      { key: "allowedOrigins", label: "Allowed origins", kind: "textarea", placeholder: "https://example.com" },
      { key: "auditLogging", label: "Security / audit logging", kind: "toggle" },
      { key: "redactPii", label: "Redact sensitive values from logs", kind: "toggle" },
      { key: "secretPolicy", label: "Secret storage policy", kind: "select", options: [["environment-only", "Environment / secret manager only"], ["project", "Project secret store"], ["external", "External secret manager"]] }
    ],
    api: [
      { key: "enabled", label: "Expose project API surface", kind: "toggle" },
      { key: "versioning", label: "API versioning", kind: "select", options: [["url", "URL versioning"], ["header", "Header versioning"], ["none", "No versioning"]] },
      { key: "basePath", label: "Base API path", placeholder: "/api" },
      { key: "cors", label: "CORS policy", kind: "select", options: [["same-origin", "Same origin"], ["allowlist", "Allowlist"], ["custom", "Custom"]] },
      { key: "rateLimit", label: "API rate limit", kind: "select", options: [["standard", "Standard"], ["strict", "Strict"], ["custom", "Custom"]] },
      { key: "webhooks", label: "Webhooks", kind: "toggle" },
      { key: "webhookSigning", label: "Webhook signature scheme", kind: "select", options: [["hmac", "HMAC"], ["provider", "Provider-managed"], ["none", "Unsigned (not recommended)"]] }
    ],
    integrations: [
      { key: "credentialsMode", label: "Credentials model", kind: "select", options: [["connected-accounts", "Connected accounts"], ["project-secrets", "Project secrets"], ["external", "External credential manager"]] },
      { key: "externalWrites", label: "External write policy", kind: "select", options: [["approval-required", "Approval required"], ["allowed", "Allowed by project policy"], ["blocked", "Blocked"]] },
      { key: "webhookVerification", label: "Verify incoming integration webhooks", kind: "toggle" },
      { key: "syncMode", label: "Sync behavior", kind: "select", options: [["manual", "Manual"], ["manual-or-agent", "Manual or AI-assisted"], ["scheduled", "Scheduled where supported"], ["realtime", "Realtime where supported"]] },
      { key: "failureMode", label: "Provider failure behavior", kind: "select", options: [["surface-and-stop", "Surface error and stop"], ["fallback", "Use configured fallback"], ["queue", "Queue for retry"]] }
    ],
    automation: [
      { key: "aiMode", label: "AI operating mode", kind: "select", options: [["assisted", "Assisted"], ["agentic", "Agentic"], ["restricted", "Restricted"]] },
      { key: "autonomousWrites", label: "Allow autonomous source writes", kind: "toggle" },
      { key: "approvalPolicy", label: "Change approval policy", kind: "select", options: [["changes-require-review", "Review source changes"], ["high-risk-only", "Review high-risk changes"], ["automatic", "Automatic within policy"]] },
      { key: "toolPolicy", label: "Tool access boundary", kind: "select", options: [["project-scoped", "Project-scoped"], ["business-scoped", "Business-scoped"], ["restricted", "Restricted"]] },
      { key: "budgetMode", label: "AI / automation budget", kind: "select", options: [["economy", "Economy"], ["standard", "Standard"], ["power", "Power"]] },
      { key: "backgroundJobs", label: "Background agent jobs", kind: "toggle" },
      { key: "scheduledJobs", label: "Scheduled jobs", kind: "toggle" }
    ],
    environment: [
      { key: "stage", label: "Environment", kind: "select", options: [["development", "Development"], ["preview", "Preview"], ["production", "Production"]] },
      { key: "region", label: "Compute region", kind: "select", options: [["auto", "Automatic"], ["closest", "Closest available"], ["custom", "Custom / provider-defined"]] },
      { key: "secretsSource", label: "Secrets source", kind: "select", options: [["managed-environment", "Managed environment"], ["project-store", "Project secret store"], ["external", "External secret manager"]] },
      { key: "timezone", label: "Execution timezone", placeholder: "UTC" },
      { key: "logLevel", label: "Log level", kind: "select", options: [["error", "Errors only"], ["warn", "Warnings + errors"], ["info", "Informational"], ["debug", "Debug"]] },
      { key: "sourceMaps", label: "Generate source maps", kind: "toggle" }
    ],
    domains: [
      { key: "primaryDomain", label: "Primary domain", placeholder: "example.com" },
      { key: "wwwBehavior", label: "www behavior", kind: "select", options: [["preserve", "Preserve"], ["redirect-apex", "Redirect to apex"], ["redirect-www", "Redirect to www"]] },
      { key: "httpsOnly", label: "Require HTTPS", kind: "toggle" },
      { key: "customDomainStatus", label: "Domain status", kind: "select", options: [["not-configured", "Not configured"], ["pending", "Verification pending"], ["verified", "Verified by provider"]] },
      { key: "redirectTrailingSlash", label: "Trailing slash behavior", kind: "select", options: [["preserve", "Preserve"], ["add", "Add slash"], ["remove", "Remove slash"]] }
    ],
    publishing: [
      { key: "releaseChannel", label: "Release channel", kind: "select", options: [["development", "Development"], ["preview", "Preview"], ["production", "Production"]] },
      { key: "versionLabel", label: "Version label", placeholder: "0.1.0" },
      { key: "previewProtection", label: "Protect preview environment", kind: "toggle" },
      { key: "deploymentMode", label: "Deployment mode", kind: "select", options: [["manual", "Manual"], ["verified-auto", "Automatic after verification"], ["external", "External deployment"]] },
      { key: "healthGate", label: "Release health gate", kind: "select", options: [["required", "Required"], ["recommended", "Recommended"], ["off", "Disabled"]] },
      { key: "buildArtifact", label: "Build artifact ownership", kind: "select", options: [["managed", "Managed by platform"], ["project", "Project-owned"], ["external", "External artifact"]] }
    ],
    releases: [
      { key: "branchPolicy", label: "Branch policy", kind: "select", options: [["feature-branch", "Feature branches"], ["trunk", "Trunk / main"], ["custom", "Custom workflow"]] },
      { key: "requireVerifiedBuild", label: "Require verified build before release", kind: "toggle" },
      { key: "requireVersionCheckpoint", label: "Checkpoint source before release", kind: "toggle" },
      { key: "rollbackMode", label: "Rollback source", kind: "select", options: [["previous-verified", "Previous verified version"], ["manual", "Manual version selection"], ["external", "External rollback system"]] },
      { key: "changelog", label: "Changelog strategy", kind: "select", options: [["generated", "Generated from changes"], ["manual", "Manual"], ["none", "None"]] }
    ],
    mobile: [
      { key: "packageId", label: "Android package ID", placeholder: "com.example.app" },
      { key: "iosBundleId", label: "iOS bundle identifier", placeholder: "com.example.app" },
      { key: "minAndroidSdk", label: "Minimum Android SDK" },
      { key: "targetAndroidSdk", label: "Target Android SDK" },
      { key: "minIosVersion", label: "Minimum iOS version" },
      { key: "orientation", label: "Orientation", kind: "select", options: [["portrait", "Portrait"], ["landscape", "Landscape"], ["both", "Portrait + landscape"]] },
      { key: "installPrompt", label: "Enable install / add-to-device prompt", kind: "toggle" },
      { key: "pwa", label: "Enable PWA behavior for web runtime", kind: "toggle" },
      { key: "deepLinks", label: "Enable deep-link configuration", kind: "toggle" },
      { key: "notifications", label: "Enable notification capability configuration", kind: "toggle" },
      { key: "statusBar", label: "Status bar appearance", kind: "select", options: [["system", "System"], ["light", "Light"], ["dark", "Dark"]] }
    ],
    developer: [
      { key: "sourceRoot", label: "Source root", detail: "Where the project source is rooted.", placeholder: "/" },
      { key: "appDirectory", label: "Application directory", detail: "Primary application source folder.", placeholder: "app" },
      { key: "envFilePolicy", label: "Environment file policy", kind: "select", options: [["managed", "Managed environment only"], ["local", "Local files allowed"], ["strict", "Strict / no checked-in env files"]] },
      { key: "typeChecking", label: "Type checking", kind: "select", options: [["strict", "Strict"], ["standard", "Standard"], ["off", "Disabled"]] },
      { key: "linting", label: "Linting policy", kind: "select", options: [["required", "Required"], ["recommended", "Recommended"], ["off", "Disabled"]] },
      { key: "formatting", label: "Formatter", kind: "select", options: [["prettier", "Prettier"], ["biome", "Biome"], ["project", "Project-defined"], ["none", "None"]] },
      { key: "sourceMaps", label: "Generate source maps", kind: "toggle" },
      { key: "generatedFiles", label: "Generated-file policy", kind: "select", options: [["separate", "Keep generated files separate"], ["inline", "Allow inline generation"], ["protected", "Protected / agent-managed"]] },
      { key: "codeGeneration", label: "Code-generation policy", kind: "select", options: [["governed", "Governed changes"], ["review", "Review every generated file"], ["automatic", "Automatic within project policy"]] },
      { key: "packageScripts", label: "Expose package scripts to Builder", kind: "toggle" },
      { key: "buildOutput", label: "Build output directory", placeholder: ".next" },
      { key: "artifactInspection", label: "Inspect build artifacts after verification", kind: "toggle" }
    ]
  };

  const defs: SectionDef[] = [
    { key: "general", label: "General", detail: "Identity, shell and project target", group: "Project", icon: "●", visible: true, fields: [...commonFields.identity, ...commonFields.platform] },
    { key: "navigation", label: "Navigation", detail: "Routes, links and movement", group: "Project", icon: "↗", visible: browser, fields: commonFields.navigation },
    { key: "appearance", label: "Appearance", detail: "Theme, typography and density", group: "Project", icon: "◈", visible: browser, fields: commonFields.appearance },
    { key: "responsive", label: "Responsive", detail: "Viewports, breakpoints and mobile behavior", group: "Project", icon: "□", visible: isWeb, fields: commonFields.responsive },
    { key: "accessibility", label: "Accessibility", detail: "Assistive technology and interaction defaults", group: "Experience", icon: "◉", visible: browser, fields: commonFields.accessibility },
    { key: "localization", label: "Localization", detail: "Language, locale, time and currency", group: "Experience", icon: "文", visible: browser, fields: commonFields.localization },
    { key: "seo", label: "SEO & discovery", detail: "Search, metadata, sitemap and AEO", group: "Experience", icon: "⌕", visible: isWeb, fields: commonFields.seo },
    { key: "analytics", label: "Analytics", detail: "Product events, errors and performance", group: "Experience", icon: "⌁", visible: isWeb, fields: commonFields.analytics },
    { key: "runtime", label: "Build & runtime", detail: "Commands, runtime and caching", group: "Engineering", icon: "▣", visible: true, fields: commonFields.runtime, note: "These values describe the project's engineering contract. BizStack must verify actual commands and runtime availability before treating them as executable." },
    { key: "data", label: "Data & storage", detail: "Persistence, files, cache and retention", group: "Engineering", icon: "▤", visible: !isApi || shell === "api", fields: commonFields.data },
    { key: "auth", label: "Authentication", detail: "Identity, sessions and sign-in policy", group: "Engineering", icon: "⌁", visible: !isApi, fields: commonFields.auth, note: "These controls define intended auth behavior. A real provider, credential set and user store must still be connected and verified." },
    { key: "security", label: "Security", detail: "CSP, origins, rate limits and secrets", group: "Engineering", icon: "◆", visible: true, fields: commonFields.security },
    { key: "api", label: "API & webhooks", detail: "Endpoints, CORS, versions and signatures", group: "Engineering", icon: "</>", visible: !webShells.includes(shell) || shell === "full-stack" || shell === "api", fields: commonFields.api },
    { key: "integrations", label: "Integrations", detail: "External accounts and write behavior", group: "Connections", icon: "⊕", visible: true, fields: commonFields.integrations },
    { key: "automation", label: "AI & automation", detail: "Agent behavior, approvals and jobs", group: "Connections", icon: "✦", visible: true, fields: commonFields.automation },
    { key: "environment", label: "Environment", detail: "Stage, region, logs and secrets", group: "Delivery", icon: "◇", visible: true, fields: commonFields.environment },
    { key: "domains", label: "Domains", detail: "Primary domain, HTTPS and redirects", group: "Delivery", icon: "◎", visible: isWeb, fields: commonFields.domains },
    { key: "publishing", label: "Publishing", detail: "Deployment mode and release channel", group: "Delivery", icon: "↑", visible: true, fields: commonFields.publishing },
    { key: "releases", label: "Versions & releases", detail: "Branches, checkpoints and rollback", group: "Delivery", icon: "↻", visible: true, fields: commonFields.releases },
    { key: "mobile", label: "Mobile app", detail: "Android/iOS identifiers and device behavior", group: "Native", icon: "▯", visible: isMobile || settings.platform?.target === "android" || settings.platform?.target === "ios" || settings.platform?.target === "android-ios", fields: commonFields.mobile, note: "Native distribution requires real signing identities, build services, store accounts and provider confirmation. These settings do not create those resources by themselves." },
    { key: "developer", label: "Developer & source", detail: "Directories, checks, generated code and scripts", group: "Developer", icon: "{ }", visible: true, fields: commonFields.developer, note: "This is the useful engineering layer: source paths, commands and code-quality policies. It intentionally avoids exposing meaningless framework internals unless they affect the project." }
  ];

  return defs.filter((item) => item.visible);
}

export default function WebsiteProjectSettings({ project, onAsk }: { project: Project; onAsk: (prompt: string) => void }) {
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(project.metadata?.settings, project));
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState("general");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Project: true, Experience: true, Engineering: true, Connections: true, Delivery: true, Native: true, Developer: true });

  const meta = useMemo(() => typeMeta(project.project_type), [project.project_type]);
  const defs = useMemo(() => sectionDefs(project, settings), [project, settings]);
  const current = defs.find((item) => item.key === section) || defs[0];
  const initial = useMemo(() => JSON.stringify(mergeSettings(project.metadata?.settings, project)), [project.id, project.metadata?.settings, project.project_type]);

  useEffect(() => {
    const next = mergeSettings(project.metadata?.settings, project);
    setSettings(next);
    setDirty(false);
    if (!defs.some((item) => item.key === section)) setSection(defs[0]?.key || "general");
  }, [project.id, project.project_type, project.metadata?.settings]);

  useEffect(() => {
    setDirty(JSON.stringify(settings) !== initial);
  }, [settings, initial]);

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
      setSaved(true);
      setDirty(false);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project settings could not be saved.");
    } finally { setBusy(false); }
  }

  function patch(path: string, value: any) {
    const [group, key] = path.split(".");
    setSettings((currentSettings) => ({
      ...currentSettings,
      [group]: { ...(currentSettings[group] || {}), [key]: value }
    }));
  }

  function resetSection() {
    if (!current) return;
    if (current.key === "general") {
      setSettings((value) => ({
        ...value,
        identity: {
          ...DEFAULTS.identity,
          appName: project.name,
          shortName: project.name.slice(0, 12)
        },
        platform: {
          ...DEFAULTS.platform,
          shell: TYPE_META[project.project_type]?.shell || "web-app",
          target: TYPE_META[project.project_type]?.target || "web"
        }
      }));
      return;
    }
    setSettings((value) => ({
      ...value,
      [current.key]: { ...(DEFAULTS[current.key] || {}) }
    }));
  }

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? defs.filter((item) => (item.label + " " + item.detail + " " + item.group + " " + item.fields.map((field) => field.label + " " + (field.detail || "")).join(" ")).toLowerCase().includes(q))
      : defs;
    const grouped: Record<string, SectionDef[]> = {};
    for (const item of matched) (grouped[item.group] ||= []).push(item);
    return grouped;
  }, [defs, query]);

  const updateFromSearch = (item: SectionDef) => {
    setSection(item.key);
    const q = query.trim().toLowerCase();
    if (q) {
      setExpandedGroups((groups) => ({ ...groups, [item.group]: true }));
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full mt-3 rounded-2xl border border-white/[.07] bg-gradient-to-br from-white/[.045] to-white/[.015] p-3 text-left hover:bg-white/[.06]">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-indigo-300/[.12] border border-indigo-300/[.1] grid place-items-center text-[9px] text-indigo-100">⚙</span>
          <div className="min-w-0 flex-1">
            <div className="text-[8px] uppercase tracking-[.16em] text-white/25">Project settings</div>
            <div className="text-[9px] text-white/60 mt-1 truncate">{meta.label} · {project.framework || "framework managed by project"}</div>
          </div>
          <span className="text-white/20">›</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-[5px] p-1.5 sm:p-4 lg:p-7">
          <div className="h-full max-w-[1420px] mx-auto overflow-hidden rounded-[28px] border border-white/[.1] bg-[#080a0e] shadow-[0_35px_140px_rgba(0,0,0,.62)] flex flex-col">
            <header className="min-h-16 shrink-0 px-3 sm:px-5 border-b border-white/[.07] flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/[.05] border border-white/[.08] grid place-items-center text-sm">⚙</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.18em] text-white/25">Project settings</div>
                <div className="text-sm text-white/75 mt-0.5 truncate">{project.name}</div>
                <div className="text-[7px] text-white/20 mt-0.5">{meta.label} · {project.runtime || "runtime managed"} · {project.framework || "framework managed"}</div>
              </div>
              {dirty && <span className="hidden sm:inline-flex rounded-full border border-amber-200/[.15] bg-amber-200/[.05] px-2 py-1 text-[7px] text-amber-100/65">Unsaved changes</span>}
              <button onClick={() => onAsk("Inspect this project's complete settings hierarchy against its project type, platform target, framework and runtime. Identify settings that are unsupported by the actual project, configuration gaps, risky choices and concrete production-safe fixes. Never claim a provider, domain, native build, deployment or integration exists unless it is actually connected and verified.")} className="hidden md:block px-3 py-2 rounded-xl border border-white/[.07] text-[8px] text-white/45 hover:text-white/70">Ask Builder to inspect</button>
              <button onClick={() => setOpen(false)} aria-label="Close settings" className="h-9 w-9 rounded-xl border border-white/[.08] text-white/40 hover:text-white">×</button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
              <nav className="lg:w-[286px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[.07] bg-[#0a0d12] flex flex-col">
                <div className="p-3 border-b border-white/[.06]">
                  <div className="relative">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings…" className="!pl-9" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-white/20">⌕</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge label={meta.label} />
                    <Badge label={String(defs.length) + " sections"} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {Object.entries(filteredGroups).map(([group, items]) => (
                    <div key={group} className="mb-2">
                      <button onClick={() => setExpandedGroups((value) => ({ ...value, [group]: !value[group] }))} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:bg-white/[.03]">
                        <span className="text-[7px] text-white/20">{expandedGroups[group] ? "▾" : "▸"}</span>
                        <span className="text-[7px] uppercase tracking-[.18em] text-white/22">{group}</span>
                        <span className="ml-auto text-[6px] text-white/15">{items.length}</span>
                      </button>
                      {expandedGroups[group] && (
                        <div className="space-y-0.5">
                          {items.map((item) => (
                            <button key={item.key} onClick={() => updateFromSearch(item)} className={"w-full flex items-start gap-2.5 text-left rounded-xl px-3 py-2.5 border " + (section === item.key ? "bg-indigo-300/[.09] border-indigo-300/[.12]" : "border-transparent hover:bg-white/[.035]")}>
                              <span className={"mt-0.5 text-[8px] " + (section === item.key ? "text-indigo-100" : "text-white/20")}>{item.icon}</span>
                              <span className="min-w-0">
                                <span className={"block text-[8px] " + (section === item.key ? "text-white/80" : "text-white/55")}>{item.label}</span>
                                <span className="block text-[6.5px] text-white/18 mt-1 leading-3">{item.detail}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!Object.keys(filteredGroups).length && <div className="p-3 text-[8px] leading-4 text-white/25">No settings matched that search.</div>}
                </div>
              </nav>

              <main className="flex-1 min-w-0 overflow-y-auto">
                {current ? (
                  <div className="max-w-[920px] p-4 sm:p-6 lg:p-8">
                    <div className="flex items-start gap-3 mb-6">
                      <div className="h-10 w-10 shrink-0 rounded-xl border border-indigo-300/[.11] bg-indigo-300/[.06] grid place-items-center text-xs text-indigo-100">{current.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[7px] uppercase tracking-[.2em] text-indigo-100/45">{current.group}</div>
                        <h2 className="text-xl text-white/85 mt-1">{current.label}</h2>
                        <p className="text-[9px] text-white/27 mt-1 leading-4">{current.detail}</p>
                      </div>
                      <button onClick={resetSection} className="hidden sm:block px-3 py-2 rounded-xl border border-white/[.07] text-[7px] text-white/35 hover:text-white/65">Reset section</button>
                    </div>

                    {current.note && <Info text={current.note} />}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {current.fields.map((field) => (
                        <div key={field.key} className={(field.kind === "textarea" ? "sm:col-span-2 " : "") + "rounded-2xl border border-white/[.07] bg-white/[.018] p-3.5"}>
                          <Field label={field.label} detail={field.detail}>
                            {renderField(field, current.key, settings[current.key]?.[field.key], (value) => patch(current.key + "." + field.key, value))}
                          </Field>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/[.06] bg-white/[.015] p-3.5">
                      <div className="text-[7px] uppercase tracking-[.18em] text-white/20">Configuration boundary</div>
                      <div className="text-[8px] leading-4 text-white/25 mt-2">
                        BizStack stores these values as project configuration. A value becomes an operational reality only when the corresponding source, provider, runtime, credential, build, DNS, store or deployment workflow has actually been configured and verified.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-white/30 text-sm">Choose a settings section.</div>
                )}
              </main>
            </div>

            <footer className="shrink-0 border-t border-white/[.07] px-3 sm:px-5 py-3 flex items-center gap-3 bg-[#090b0f]">
              <div className="flex-1 min-w-0">
                {error ? <div className="text-[8px] text-red-300/75 truncate">{error}</div> : saved ? <div className="text-[8px] text-emerald-200/70">Saved to project configuration.</div> : dirty ? <div className="text-[8px] text-amber-100/55">Changes are local until you save.</div> : <div className="text-[8px] text-white/20">All settings are currently saved.</div>}
              </div>
              <button onClick={() => void save()} disabled={busy || !dirty} className="px-4 py-2.5 rounded-xl bg-white text-black text-[8px] disabled:opacity-35">{busy ? "Saving…" : "Save settings"}</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function renderField(field: FieldDef, group: string, value: any, onChange: (value: any) => void) {
  if (field.kind === "toggle") {
    return <Toggle label={value ? "Enabled" : "Disabled"} value={Boolean(value)} onChange={onChange} />;
  }
  if (field.kind === "select") {
    return <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>{field.options?.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
  }
  if (field.kind === "textarea") {
    return <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={field.placeholder} />;
  }
  if (field.kind === "number") {
    return <input type="number" min={field.min} max={field.max} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />;
  }
  if (field.kind === "color") {
    return <input type="color" value={String(value || "#000000")} onChange={(e) => onChange(e.target.value)} className="h-11 p-1" />;
  }
  return <input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
}

function Badge({ label }: { label: string }) {
  return <div className="inline-flex rounded-full border border-indigo-300/[.12] bg-indigo-300/[.06] px-2.5 py-1 text-[7px] text-indigo-100/65">{label}</div>;
}

function Info({ text }: { text: string }) {
  return <div className="rounded-2xl border border-amber-200/[.08] bg-amber-200/[.025] p-3 text-[8px] leading-4 text-amber-100/50">{text}</div>;
}

function Field({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return <label className="block"><span className="text-[8px] text-white/55 block mb-1">{label}</span>{detail && <span className="text-[6.5px] text-white/18 block mb-2 leading-3">{detail}</span>}{children}</label>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="w-full min-h-11 flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-2.5 text-left hover:bg-white/[.04]">
      <span className={"h-6 w-10 shrink-0 rounded-full p-1 transition " + (value ? "bg-indigo-300/50" : "bg-white/[.08]")}>
        <span className={"block h-4 w-4 rounded-full bg-white transition " + (value ? "translate-x-4" : "")} />
      </span>
      <span className="text-[8px] text-white/55">{label}</span>
    </button>
  );
}
"