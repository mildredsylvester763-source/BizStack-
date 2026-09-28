import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

async function vercel(path: string) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured on the server.");
  const response = await fetch("https://api.vercel.com" + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error?.code || "Vercel API request failed.");
  }
  return body;
}

function mapStatus(readyState: string | null | undefined) {
  switch (readyState) {
    case "READY": return "ready";
    case "ERROR": return "failed";
    case "CANCELED": return "canceled";
    case "QUEUED": return "queued";
    default: return "building";
  }
}

function eventText(events: unknown[]) {
  return events
    .map((event: any) => String(event?.text || event?.message || event?.payload?.text || ""))
    .filter(Boolean)
    .join("\n")
    .slice(-30000);
}

function classifyFailure(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("typescript") || lower.includes("type error")) return "typescript";
  if (lower.includes("module not found") || lower.includes("cannot find module") || lower.includes("npm err")) return "dependency";
  if (lower.includes("environment variable") || (lower.includes("env") && lower.includes("missing"))) return "environment";
  if (lower.includes("eslint") || lower.includes("lint")) return "lint";
  return "build";
}

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deploymentId = request.nextUrl.searchParams.get("deploymentId") || "";
    if (!deploymentId) return NextResponse.json({ error: "deploymentId is required." }, { status: 400 });

    const { data: deployment, error: deploymentError } = await supabase
      .from("ai_deployments")
      .select("*")
      .eq("id", deploymentId)
      .eq("project_id", (await context.params).projectId)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json({ error: "Deployment record not found." }, { status: 404 });
    }
    if (!deployment.provider_deployment_id) {
      return NextResponse.json({ error: "Deployment has no provider deployment id." }, { status: 409 });
    }
    if (deployment.provider !== "vercel") {
      return NextResponse.json({ error: "Unsupported deployment provider." }, { status: 400 });
    }

    const [providerDeployment, rawEvents] = await Promise.all([
      vercel("/v13/deployments/" + encodeURIComponent(deployment.provider_deployment_id)),
      vercel("/v3/deployments/" + encodeURIComponent(deployment.provider_deployment_id) + "/events?limit=100")
    ]);

    const events = Array.isArray(rawEvents) ? rawEvents : Array.isArray(rawEvents?.events) ? rawEvents.events : [];
    const logs = eventText(events);
    const status = mapStatus(providerDeployment?.readyState);
    const now = new Date().toISOString();
    const url = providerDeployment?.url ? "https://" + String(providerDeployment.url).replace(/^https?:\/\//, "") : deployment.deployment_url;
    const commitSha = providerDeployment?.meta?.githubCommitSha || providerDeployment?.meta?.githubCommitSha1 || deployment.git_commit_sha || null;

    await supabase.from("ai_deployments").update({
      status,
      deployment_url: url,
      git_commit_sha: commitSha,
      build_logs: { provider: "vercel", deployment: providerDeployment, events: events.slice(-100), log_excerpt: logs },
      error_summary: status === "failed" ? (logs.slice(-2000) || "Vercel deployment failed.") : null,
      started_at: deployment.started_at || (status !== "queued" ? now : null),
      finished_at: ["ready", "failed", "canceled"].includes(status) ? (deployment.finished_at || now) : null,
      updated_at: now
    }).eq("id", deployment.id);

    let repair = null;
    if (status === "failed") {
      const { data: existing } = await supabase
        .from("ai_repair_runs")
        .select("id,status,failure_class,attempt_no,created_at")
        .eq("deployment_id", deployment.id)
        .in("status", ["queued", "diagnosing", "planned", "awaiting_approval", "applying", "testing", "redeploying"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        repair = existing;
      } else {
        const failureClass = classifyFailure(logs);
        const { data: created } = await supabase.from("ai_repair_runs").insert({
          project_id: (await context.params).projectId,
          deployment_id: deployment.id,
          status: "planned",
          failure_class: failureClass,
          diagnosis: {
            provider: "vercel",
            deployment_id: deployment.provider_deployment_id,
            ready_state: providerDeployment?.readyState || null,
            events: events.slice(-100),
            log_excerpt: logs,
            diagnosed_at: now
          },
          repair_plan: {
            strategy: "preserve all product functionality; inspect the exact provider failure; snapshot; apply the smallest safe source change; run verification; redeploy only after verification.",
            automatic_deploy: false
          },
          created_by: user.id
        }).select("id,status,failure_class,attempt_no,created_at").single();
        repair = created || null;
      }
    }

    return NextResponse.json({
      deployment: {
        id: deployment.id,
        providerDeploymentId: deployment.provider_deployment_id,
        status,
        url,
        gitCommitSha: commitSha,
        errorSummary: status === "failed" ? logs.slice(-2000) : null
      },
      repair,
      polledAt: now
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not poll deployment status."
    }, { status: 502 });
  }
}
