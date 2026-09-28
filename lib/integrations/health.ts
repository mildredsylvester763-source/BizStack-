// @ts-nocheck
import { loadIntegrationCredential, markIntegrationVerified } from "@/lib/integrations/runtime";

type HealthResult = {
  ok: boolean;
  provider: string;
  status: number | null;
  account?: Record<string, unknown> | null;
  error?: string;
};

const ENDPOINTS: Record<
  string,
  (token: string, cfg: any) => {
    url: string;
    headers: Record<string, string>;
    method?: string;
    body?: string;
  }
> = {
  github: (t) => ({
    url: "https://api.github.com/user",
    headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" }
  }),
  "google-drive": (t) => ({
    url: "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",
    headers: { Authorization: `Bearer ${t}` }
  }),
  gmail: (t) => ({
    url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    headers: { Authorization: `Bearer ${t}` }
  }),
  "google-calendar": (t) => ({
    url: "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
    headers: { Authorization: `Bearer ${t}` }
  }),
  slack: (t) => ({
    url: "https://slack.com/api/auth.test",
    headers: { Authorization: `Bearer ${t}` }
  }),
  notion: (t) => ({
    url: "https://api.notion.com/v1/users/me",
    headers: { Authorization: `Bearer ${t}`, "Notion-Version": "2022-06-28" }
  }),
  microsoft: (t) => ({
    url: "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName",
    headers: { Authorization: `Bearer ${t}` }
  }),
  "microsoft-365": (t) => ({
    url: "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName",
    headers: { Authorization: `Bearer ${t}` }
  }),
  dropbox: (t) => ({
    url: "https://api.dropboxapi.com/2/users/get_current_account",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    method: "POST",
    body: "null"
  }),
  box: (t) => ({
    url: "https://api.box.com/2.0/users/me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  asana: (t) => ({
    url: "https://app.asana.com/api/1.0/users/me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  linear: (t) => ({
    url: "https://api.linear.app/graphql",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ query: "query { viewer { id name email } }" })
  }),
  jira: (t) => ({
    url: "https://api.atlassian.com/me",
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }
  }),
  gitlab: (t) => ({
    url: "https://gitlab.com/api/v4/user",
    headers: { Authorization: `Bearer ${t}` }
  }),
  bitbucket: (t) => ({
    url: "https://api.bitbucket.org/2.0/user",
    headers: { Authorization: `Bearer ${t}` }
  }),
  discord: (t) => ({
    url: "https://discord.com/api/users/@me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  zoom: (t) => ({
    url: "https://api.zoom.us/v2/users/me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  calendly: (t) => ({
    url: "https://api.calendly.com/users/me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  quickbooks: (t) => ({
    url: "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
    headers: { Authorization: `Bearer ${t}` }
  }),
  xero: (t) => ({
    url: "https://identity.xero.com/connect/userinfo",
    headers: { Authorization: `Bearer ${t}` }
  }),
  figma: (t) => ({
    url: "https://api.figma.com/v1/me",
    headers: { Authorization: `Bearer ${t}` }
  }),
  hubspot: (t) => ({
    url: "https://api.hubapi.com/oauth/v1/access-tokens/" + encodeURIComponent(t),
    headers: {}
  }),
  salesforce: (t) => ({
    url: "https://login.salesforce.com/services/oauth2/userinfo",
    headers: { Authorization: `Bearer ${t}` }
  }),
  airtable: (t) => ({
    url: "https://api.airtable.com/v0/meta/whoami",
    headers: { Authorization: `Bearer ${t}` }
  }),
  stripe: (t) => ({
    url: "https://api.stripe.com/v1/account",
    headers: { Authorization: "Basic " + Buffer.from(t + ":").toString("base64") }
  }),
  shopify: (t, c) => ({
    url: `https://${String(c?.shop_domain || c?.shop || "").replace(/^https?:\\/\\//, "")}/admin/api/2025-10/shop.json`,
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }
  })
};

function normalizeProvider(provider: string) {
  return provider === "microsoft-365" ? "microsoft" : provider;
}

export async function verifyIntegrationHealth(
  supabase: any,
  integration: any,
  businessId: string
): Promise<HealthResult> {
  const provider = normalizeProvider(String(integration.provider || ""));
  const { credential } = await loadIntegrationCredential(integration.id, businessId);
  const token = String(
    credential.accessToken || credential.bearerToken || credential.apiKey || ""
  );

  if (!token) throw new Error("No usable credential is stored for this integration.");

  const cfg = integration.config || {};
  let request = ENDPOINTS[provider]?.(token, cfg);
  if (!request) throw new Error(`No health-check adapter is registered for ${provider} yet.`);

  if (provider === "shopify") {
    const domain = String(cfg.shop_domain || cfg.shop || "")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    if (!domain) throw new Error("Shopify shop domain is required.");

    request = {
      url: `https://${domain}/admin/api/2025-10/shop.json`,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    };
  }

  const response = await fetch(request.url, {
    method: request.method || "GET",
    headers: request.headers,
    body: request.body,
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(responseText);
  } catch {}

  const ok = response.ok && !(provider === "slack" && data?.ok === false);

  if (!ok) {
    const message =
      data?.error?.message ||
      data?.error_description ||
      data?.message ||
      data?.error ||
      `Provider health check failed with HTTP ${response.status}`;

    await supabase
      .from("integrations")
      .update({
        status: response.status === 401 || response.status === 403 ? "error" : "connected",
        error_message: String(message)
      })
      .eq("id", integration.id)
      .eq("business_id", businessId);

    return { ok: false, provider, status: response.status, error: String(message) };
  }

  await markIntegrationVerified(integration.id, businessId);
  return { ok: true, provider, status: response.status, account: data };
}
