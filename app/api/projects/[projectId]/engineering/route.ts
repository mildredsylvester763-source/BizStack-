import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";

type EngineeringMode = "plan" | "review" | "architecture";

function clamp(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max) + "\n…[truncated]";
}

function buildProjectContext(files: any[], selectedPath?: string | null) {
  const paths = files.map((file) => String(file.path));
  const important = new Set<string>(["package.json", "README.md", "tsconfig.json", "next.config.js", "next.config.mjs", "vite.config.ts", "vite.config.js"]);
  if (selectedPath) important.add(selectedPath);
  const source = files
    .filter((file) => important.has(String(file.path)) && typeof file.content === "string" && !file.is_binary)
    .slice(0, 12)
    .map((file) => "===== " + file.path + " =====\n" + clamp(String(file.content), 5000))
    .join("\n\n");
  return "FILE TREE:\n" + paths.slice(0, 500).join("\n") + "\n\nKEY FILES:\n" + source;
}

function fallback(mode: EngineeringMode, files: any[], selectedPath?: string | null) {
  const paths = files.map((file) => String(file.path));
  const hasPackage = paths.includes("package.json");
  const testFiles = paths.filter((p) => /(^|\/)(test|tests|__tests__)(\/|\.)|\.(test|spec)\.[^.]+$/.test(p));
  const routeFiles = paths.filter((p) => /(^|\/)app\/api\/.+\/route\.(ts|tsx)$|(^|\/)pages\/api\//.test(p));

  if (mode === "architecture") {
    return {
      provider: "deterministic",
      model: null,
      mode,
      title: "Project architecture snapshot",
      summary: "The AI provider is not configured, so BizStack returned a source-derived architecture snapshot instead of inventing an AI analysis.",
      sections: [
        "Source files: " + paths.length,
        "API route files: " + routeFiles.length,
        "Test files detected: " + testFiles.length,
        "Package manifest present: " + (hasPackage ? "yes" : "no"),
        selectedPath ? "Selected focus file: " + selectedPath : "No single focus file selected"
      ],
      warnings: testFiles.length === 0 ? ["No obvious automated test files were detected in the project tree."] : []
    };
  }

  if (mode === "review") {
    return {
      provider: "deterministic",
      model: null,
      mode,
      title: "Static project review",
      summary: "The AI provider is not configured, so BizStack did not claim an AI code review. This is a conservative source-tree review only.",
      sections: [
        "Review scope: " + (selectedPath || "project structure"),
        "Source files: " + paths.length,
        "API routes detected: " + routeFiles.length
      ],
      warnings: [
        ...(testFiles.length === 0 ? ["No obvious automated test files were detected."] : []),
        ...(hasPackage ? [] : ["package.json was not found; dependency/build inspection is limited."])
      ]
    };
  }

  return {
    provider: "deterministic",
    model: null,
    mode,
    title: "Engineering plan",
    summary: "The AI provider is not configured, so this is a conservative plan derived from the current project structure.",
    steps: [
      "Inspect the current source tree and project manifest.",
      "Identify the smallest set of files that need to change.",
      "Apply changes without deleting existing product functionality.",
      "Run dependency installation/build verification and inspect real errors.",
      "Create a version snapshot after verification passes."
    ],
    warnings: []
  };
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const mode: EngineeringMode = ["plan", "review", "architecture"].includes(body.mode) ? body.mode : "plan";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 12000) : "";
    const selectedPath = typeof body.selectedPath === "string" ? body.selectedPath : null;

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,name,slug,business_id,status,framework,runtime,repository_name,default_branch,preview_url,production_url")
      .eq("id", context.params.projectId)
      .single();

    if (projectError || !project || project.status === "deleted") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { data: canRead } = await supabase.rpc("user_can_business", {
      p_business_id: project.business_id,
      p_user_id: user.id,
      p_permission: "read_projects"
    });
    if (!canRead) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });

    const { data: files, error: filesError } = await supabase
      .from("ai_project_files")
      .select("path,content,is_binary,language,version_no")
      .eq("project_id", project.id)
      .order("path", { ascending: true });
    if (filesError) throw filesError;

    const projectContext = buildProjectContext(files ?? [], selectedPath);
    const fallbackResult = fallback(mode, files ?? [], selectedPath);

    try {
      const system = [
        "You are BizStack Engineering Intelligence.",
        "Work as a senior software engineer inside a persistent project workspace.",
        "Never recommend deleting working product functionality merely to make a build pass.",
        "Prefer minimal, reversible changes, preserve existing routes/features, and require real verification after modifications.",
        mode === "plan"
          ? "Produce an implementation plan with ordered steps, affected files, risks, verification commands, and a rollback/checkpoint point. Do not claim changes were made."
          : mode === "review"
            ? "Perform a focused code review. Look for correctness, security, data handling, runtime/build issues, missing tests, and regressions. Distinguish confirmed issues from hypotheses."
            : "Explain the project's current architecture, major layers, data flow, risky boundaries, and the safest places to extend it.",
        "Return concise Markdown with headings: Summary, Findings, Recommended Actions, Verification."
      ].join("\n");

      const userMessage = [
        "Project: " + project.name + " (" + (project.framework || "framework unknown") + ", " + (project.runtime || "runtime unknown") + ")",
        "Requested mode: " + mode,
        prompt ? "User request: " + prompt : "User did not provide additional instructions.",
        selectedPath ? "Focused file: " + selectedPath : "",
        projectContext
      ].filter(Boolean).join("\n\n");

      const messages: BizStackModelMessage[] = [
        { role: "system", content: system },
        { role: "user", content: userMessage }
      ];
      const result = await runBizStackModel(messages, []);
      return NextResponse.json({
        provider: result.provider,
        model: result.model,
        task: result.task ?? null,
        mode,
        project: { id: project.id, name: project.name },
        analysis: result.message?.content ?? "The model returned no analysis content."
      });
    } catch (error) {
      return NextResponse.json({
        ...fallbackResult,
        project: { id: project.id, name: project.name },
        providerError: error instanceof Error ? error.message : "AI provider unavailable."
      });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Engineering analysis failed." }, { status: 400 });
  }
}
