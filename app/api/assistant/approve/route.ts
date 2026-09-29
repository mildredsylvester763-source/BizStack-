import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { approveOperatorRun } from "@/lib/assistant/runtime";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const runId = typeof body?.runId === "string" ? body.runId : "";
    if (!runId) return NextResponse.json({ error: "runId is required." }, { status: 400 });

    const result = await approveOperatorRun({ userId: user.id, runId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status: 400 });
  }
}