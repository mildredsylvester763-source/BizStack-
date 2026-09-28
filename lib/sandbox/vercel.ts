import { Sandbox } from "@vercel/sandbox";

export type SandboxFile = { path: string; content: string };

type SandboxConfig = {
  teamId?: string;
  projectId?: string;
  token?: string;
};

function config(): SandboxConfig {
  return {
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID || process.env.BIZSTACK_VERCEL_PROJECT_ID,
    token: process.env.VERCEL_TOKEN
  };
}

export function sandboxConfigured() {
  const c = config();
  return Boolean(c.teamId && c.projectId && c.token);
}

function safeName(projectId: string) {
  return "bizstack-" + projectId.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40);
}

function createOptions(projectId: string, ports?: number[]) {
  const c = config();
  if (!c.teamId || !c.projectId || !c.token) {
    throw new Error("Vercel Sandbox is not configured. Set VERCEL_TEAM_ID, VERCEL_PROJECT_ID and VERCEL_TOKEN on the server.");
  }
  return {
    teamId: c.teamId,
    projectId: c.projectId,
    token: c.token,
    name: safeName(projectId),
    timeout: 5 * 60 * 1000,
    ...(ports?.length ? { ports } : {})
  };
}

export async function getOrCreateSandbox(projectId: string, ports: number[] = [3000]) {
  const name = safeName(projectId);
  try {
    const existing = await Sandbox.get({ name });
    return existing;
  } catch {
    return Sandbox.create(createOptions(projectId, ports));
  }
}

export async function syncFiles(projectId: string, files: SandboxFile[]) {
  const sandbox = await getOrCreateSandbox(projectId);
  if (files.length) {
    await sandbox.writeFiles(
      files.slice(0, 500).map(file => ({
        path: "/workspace/" + file.path.replace(/^\/+/, ""),
        content: Buffer.from(file.content, "utf8")
      }))
    );
  }
  return sandbox;
}

export async function runSandboxCommand(
  projectId: string,
  cmd: string,
  args: string[] = [],
  cwd = "/workspace",
  detached = false
) {
  const sandbox = await getOrCreateSandbox(projectId, detached ? [3000] : []);
  const result = await sandbox.runCommand({
    cmd,
    args,
    cwd,
    detached,
  });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  return {
    sandbox,
    exitCode: result.exitCode,
    stdout,
    stderr,
  };
}

export async function readSandboxFile(projectId: string, path: string) {
  const sandbox = await getOrCreateSandbox(projectId);
  const buffer = await sandbox.readFileToBuffer({ path: "/workspace/" + path.replace(/^\/+/, "") });
  return buffer?.toString("utf8") ?? null;
}

export async function stopSandbox(projectId: string) {
  const sandbox = await getOrCreateSandbox(projectId);
  await sandbox.stop();
}

export function sandboxPreviewDomain(sandbox: any, port = 3000) {
  return sandbox.domain(port);
}
