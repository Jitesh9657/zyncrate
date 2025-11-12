export const runtime = "edge";

import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";

export async function GET(req: Request, env: any) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // ✅ Fetch file record from D1 (Cloudflare SQLite)
    const { results } = await queryDB(
      env,
      `
      SELECT
        key, file_name, file_size, mime_type, created_at, expires_at,
        download_count, max_downloads, one_time, locked
      FROM files
      WHERE key = ? AND is_deleted = 0
      `,
      [key]
    );

    const file = results?.[0];
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ✅ Sanitize + normalize data for edge clients
    const safeFile = {
      key: file.key,
      file_name: file.file_name,
      file_size: Number(file.file_size) || 0,
      mime_type: file.mime_type || "application/octet-stream",
      created_at: file.created_at ? Number(file.created_at) : null,
      expires_at: file.expires_at ? Number(file.expires_at) : null,
      download_count: Number(file.download_count) || 0,
      max_downloads: file.max_downloads ? Number(file.max_downloads) : null,
      one_time: !!file.one_time,
      locked: !!file.locked,
    };

    return NextResponse.json({ success: true, file: safeFile });
  } catch (error: any) {
    console.error("⚠️ File info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch file info" },
      { status: 500 }
    );
  }
}
