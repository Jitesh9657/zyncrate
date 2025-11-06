// app/api/download-info/route.ts
import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Required for Cloudflare Pages (Edge Runtime)

export async function GET(req: Request, env: any) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // ✅ Fetch file metadata from D1
    const { results } = await queryDB(
      env,
      "SELECT file_name, file_size, created_at, expires_at, download_count, max_downloads FROM files WHERE key = ? AND is_deleted = 0",
      [key]
    );

    const file = results?.[0];
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ✅ Return concise, clean response
    return NextResponse.json({
      success: true,
      key,
      file_name: file.file_name,
      file_size: file.file_size,
      created_at: file.created_at,
      expires_at: file.expires_at,
      download_count: file.download_count || 0,
      max_downloads: file.max_downloads || null,
    });
  } catch (error: any) {
    console.error("⚠️ Download info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch file info" },
      { status: 500 }
    );
  }
}
