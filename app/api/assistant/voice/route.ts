import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Voice note is too large. Maximum size is 15 MB." }, { status: 400 });

  const url = process.env.BIZSTACK_TRANSCRIPTION_API_URL;
  const key = process.env.BIZSTACK_TRANSCRIPTION_API_KEY;
  if (!url || !key) {
    return NextResponse.json({
      error: "Server transcription is not configured. The browser voice-input mode can still be used on supported devices."
    }, { status: 503 });
  }

  const body = new FormData();
  body.append("file", file, file.name || "voice-note.webm");
  body.append("model", process.env.BIZSTACK_TRANSCRIPTION_MODEL || "whisper-1");

  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: "Bearer " + key },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: "Transcription provider returned HTTP " + response.status + ": " + error.slice(0, 400) }, { status: 502 });
  }

  const result = await response.json().catch(() => ({}));
  const transcript = typeof result?.text === "string"
    ? result.text.trim()
    : typeof result?.transcript === "string"
      ? result.transcript.trim()
      : "";

  if (!transcript) return NextResponse.json({ error: "The transcription provider returned no text." }, { status: 502 });
  return NextResponse.json({ transcript });
}