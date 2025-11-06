// app/api/file-info/route.ts
import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Required for Cloudflare Pages / Edge Functions

export async function GET(req: Request, env: any) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // ✅ Fetch single file record from Cloudflare D1
    const { results } = await queryDB(
      env,
      `SELECT 
         id, key, file_name, file_size, mime_type, path, 
         created_at, expires_at, download_count, max_downloads, 
         one_time, is_deleted, locked, lock_key, user_id, guest_session_id
       FROM files 
       WHERE key = ? AND is_deleted = 0`,
      [key]
    );

    const file = results?.[0];
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ✅ Clean output: remove sensitive or internal fields if needed
    const safeData = {
      key: file.key,
      file_name: file.file_name,
      file_size: file.file_size,
      mime_type: file.mime_type,
      created_at: file.created_at,
      expires_at: file.expires_at,
      download_count: file.download_count,
      max_downloads: file.max_downloads,
      one_time: file.one_time ? 1 : 0,
      locked: file.locked ? 1 : 0,
    };

    return NextResponse.json({ success: true, file: safeData });
  } catch (error: any) {
    console.error("⚠️ File info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch file info" },
      { status: 500 }
    );
  }
}
