import type { createClient } from "@/lib/supabase-server";

export const AI_ATTACHMENT_BUCKET = "bizstack-ai-attachments";
export const AI_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const AI_ATTACHMENT_MAX_EXTRACTED_CHARS = 120_000;

export type AttachmentKind = "image" | "document" | "spreadsheet" | "text" | "archive" | "other";

export type StoredAttachment = {
  id: string;
  business_id: string;
  conversation_id: string | null;
  project_id: string | null;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  kind: AttachmentKind;
  status: "processing" | "ready" | "failed";
  extracted_text: string | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AttachmentReference = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: AttachmentKind;
  status: StoredAttachment["status"];
  extracted_chars: number;
  project_id: string | null;
  conversation_id: string | null;
  preview_url?: string | null;
};

export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/xml",
  "application/json"
]);

function normalizeName(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 160) || "attachment";
}

export function attachmentKind(mimeType: string, fileName: string): AttachmentKind {
  const mime = mimeType.toLowerCase();
  const lower = fileName.toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || mime.includes("word") || lower.endsWith(".docx") || lower.endsWith(".doc")) return "document";
  if (mime.includes("spreadsheet") || mime.includes("excel") || /\\.(xlsx|xls|xlsm|ods|numbers)$/.test(lower)) return "spreadsheet";
  if (TEXT_MIME_TYPES.has(mime) || /\\.(txt|md|csv|json|html|xml|yaml|yml|ts|tsx|js|jsx|css|scss|sql)$/.test(lower)) return "text";
  if (mime.includes("zip") || mime.includes("archive") || /\\.(zip|tar|gz|7z|rar)$/.test(lower)) return "archive";
  return "other";
}

function truncateText(text: string) {
  const clean = text.replace(/\\u0000/g, "").replace(/[ \\t]+\\n/g, "\\n").trim();
  if (clean.length <= AI_ATTACHMENT_MAX_EXTRACTED_CHARS) return clean;
  return clean.slice(0, AI_ATTACHMENT_MAX_EXTRACTED_CHARS) + "\\n\\n[Attachment text truncated at " + AI_ATTACHMENT_MAX_EXTRACTED_CHARS + " characters.]";
}

export async function extractAttachmentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const kind = attachmentKind(mimeType, fileName);
  const lower = fileName.toLowerCase();

  if (kind === "image") {
    return { text: "", metadata: { vision_input: true } };
  }

  if (TEXT_MIME_TYPES.has(mimeType.toLowerCase()) || /\\.(txt|md|csv|json|html|xml|yaml|yml|ts|tsx|js|jsx|css|scss|sql)$/.test(lower)) {
    const text = buffer.toString("utf8");
    if (lower.endsWith(".json") || mimeType.toLowerCase() === "application/json") {
      try {
        return { text: truncateText(JSON.stringify(JSON.parse(text), null, 2)), metadata: { structured_text: true } };
      } catch {
        return { text: truncateText(text), metadata: { structured_text: false } };
      }
    }
    return { text: truncateText(text), metadata: { structured_text: false } };
  }

  if (kind === "document" && (mimeType.toLowerCase() === "application/pdf" || lower.endsWith(".pdf"))) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: truncateText(result.text || ""), metadata: { parser: "pdf-parse", pages: result.total ?? null } };
    } finally {
      await parser.destroy();
    }
  }

  if (kind === "document" && (mimeType.toLowerCase().includes("word") || lower.endsWith(".docx"))) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: truncateText(result.value || ""),
      metadata: {
        parser: "mammoth",
        warnings: Array.isArray(result.messages) ? result.messages.slice(0, 10) : []
      }
    };
  }

  if (kind === "spreadsheet") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sections: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 20)) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      sections.push("[Sheet: " + sheetName + "]\n" + csv);
      if (sections.join("\n\n").length >= AI_ATTACHMENT_MAX_EXTRACTED_CHARS) break;
    }
    return {
      text: truncateText(sections.join("\n\n")),
      metadata: {
        parser: "xlsx",
        sheets: workbook.SheetNames.length,
        sheet_names: workbook.SheetNames.slice(0, 20)
      }
    };
  }

  return {
    text: "",
    metadata: {
      extraction_supported: false,
      note: "The binary file is stored and can be referenced, but no server-side text extractor is enabled for this format yet."
    }
  };
}

async function loadAttachmentRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  attachmentIds: string[]
) {
  const ids = Array.from(new Set(attachmentIds.filter(Boolean))).slice(0, 12);
  if (!ids.length) return [] as StoredAttachment[];

  const { data, error } = await supabase
    .from("ai_builder_attachments")
    .select("*")
    .eq("business_id", businessId)
    .in("id", ids);

  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [String(row.id), row as StoredAttachment]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as StoredAttachment[];
}

export async function attachmentReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  attachmentIds: string[]
) {
  const rows = await loadAttachmentRows(supabase, businessId, attachmentIds);
  return rows.map((row) => ({
    id: row.id,
    name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    kind: row.kind,
    status: row.status,
    extracted_chars: row.extracted_text?.length || 0,
    project_id: row.project_id,
    conversation_id: row.conversation_id
  })) satisfies AttachmentReference[];
}

export async function hydrateAttachmentContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  attachmentIds: string[]
): Promise<{ references: AttachmentReference[]; parts: ModelContentPart[] }> {
  const rows = await loadAttachmentRows(supabase, businessId, attachmentIds);
  const parts: ModelContentPart[] = [];
  const references: AttachmentReference[] = [];

  for (const row of rows) {
    const reference: AttachmentReference = {
      id: row.id,
      name: row.original_name,
      mime_type: row.mime_type,
      size_bytes: Number(row.size_bytes),
      kind: row.kind,
      status: row.status,
      extracted_chars: row.extracted_text?.length || 0,
      project_id: row.project_id,
      conversation_id: row.conversation_id
    };
    references.push(reference);

    parts.push({
      type: "text",
      text:
        "Attached reference: " + row.original_name +
        " (" + row.mime_type + ", " + row.kind + ")."
    });

    if (row.extracted_text) {
      parts.push({
        type: "text",
        text: "Extracted content from " + row.original_name + ":\n" + row.extracted_text
      });
    }

    if (row.kind === "image" && row.status === "ready") {
      const { data, error } = await supabase.storage.from(AI_ATTACHMENT_BUCKET).download(row.storage_path);
      if (error || !data) continue;
      const bytes = Buffer.from(await data.arrayBuffer());
      parts.push({
        type: "image",
        mimeType: row.mime_type || "image/png",
        data: bytes.toString("base64")
      });
    }
  }

  return { references, parts };
}

export async function linkAttachmentsToConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  attachmentIds: string[],
  conversationId: string,
  projectId?: string | null
) {
  const ids = Array.from(new Set(attachmentIds.filter(Boolean))).slice(0, 12);
  if (!ids.length) return;
  await supabase
    .from("ai_builder_attachments")
    .update({
      conversation_id: conversationId,
      project_id: projectId || null,
      updated_at: new Date().toISOString()
    })
    .eq("business_id", businessId)
    .in("id", ids);
}

export function publicAttachment(
  row: StoredAttachment,
  previewUrl?: string | null
): AttachmentReference {
  return {
    id: row.id,
    name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    kind: row.kind,
    status: row.status,
    extracted_chars: row.extracted_text?.length || 0,
    project_id: row.project_id,
    conversation_id: row.conversation_id,
    preview_url: previewUrl || null
  };
}

export function safeStorageFileName(name: string) {
  return normalizeName(name);
}
