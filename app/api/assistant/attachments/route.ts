import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  AI_ATTACHMENT_BUCKET,
  AI_ATTACHMENT_MAX_BYTES,
  attachmentKind,
  extractAttachmentText,
  publicAttachment,
  safeStorageFileName
} from "@/lib/ai/attachments";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, business: null };

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("owner_id", user.id)
    .single();

  return { supabase, user, business };
}

async function verifyScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  projectId: string | null,
  conversationId: string | null
) {
  if (projectId) {
    const { data: project } = await supabase
      .from("ai_projects")
      .select("id")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .neq("status", "deleted")
      .maybeSingle();
    if (!project) throw new Error("Project target was not found.");
  }

  if (conversationId) {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!conversation) throw new Error("Conversation target was not found.");
  }
}

export async function POST(request: Request) {
  const { supabase, user, business } = await getContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 400 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
    if (file.size <= 0) return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    if (file.size > AI_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json({ error: "Attachments are limited to 15 MB in this first production path." }, { status: 400 });
    }

    const projectId = String(form.get("projectId") || "").trim() || null;
    const conversationId = String(form.get("conversationId") || "").trim() || null;
    await verifyScope(supabase, business.id, projectId, conversationId);

    const id = crypto.randomUUID();
    const originalName = file.name || "attachment";
    const mimeType = (file.type || "application/octet-stream").toLowerCase();
    const kind = attachmentKind(mimeType, originalName);
    const storagePath = [
      business.id,
      projectId || "unassigned",
      new Date().toISOString().slice(0, 10),
      id + "-" + safeStorageFileName(originalName)
    ].join("/");

    const { data: row, error: insertError } = await supabase
      .from("ai_builder_attachments")
      .insert({
        id,
        business_id: business.id,
        conversation_id: conversationId,
        project_id: projectId,
        created_by: user.id,
        original_name: originalName.slice(0, 160),
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        kind,
        status: "processing",
        metadata: { upload_source: "ai_builder_composer" }
      })
      .select("*")
      .single();

    if (insertError || !row) throw new Error(insertError?.message || "Could not create the attachment record.");

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(AI_ATTACHMENT_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw new Error("Attachment storage failed: " + uploadError.message);

      const extracted = await extractAttachmentText(buffer, mimeType, originalName);
      const { data: ready, error: readyError } = await supabase
        .from("ai_builder_attachments")
        .update({
          status: "ready",
          extracted_text: extracted.text || null,
          metadata: {
            upload_source: "ai_builder_composer",
            ...extracted.metadata
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("business_id", business.id)
        .select("*")
        .single();

      if (readyError || !ready) throw new Error(readyError?.message || "Attachment processing could not be finalized.");

      const signed = await supabase.storage
        .from(AI_ATTACHMENT_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);

      return NextResponse.json({
        attachment: publicAttachment(ready, signed.data?.signedUrl || null)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attachment processing failed.";
      await supabase
        .from("ai_builder_attachments")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("business_id", business.id);
      throw new Error(message);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Attachment upload failed." },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const { supabase, user, business } = await getContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 400 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100);

  let query = supabase
    .from("ai_builder_attachments")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (conversationId) query = query.eq("conversation_id", conversationId);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const attachments = await Promise.all((data ?? []).map(async (row) => {
    if (row.kind !== "image") return publicAttachment(row, null);
    const signed = await supabase.storage
      .from(AI_ATTACHMENT_BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);
    return publicAttachment(row, signed.data?.signedUrl || null);
  }));

  return NextResponse.json({ attachments });
}
