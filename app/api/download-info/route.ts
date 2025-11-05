// app/api/download-info/route.ts
import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Needed for Cloudflare Pages

export async function GET(req: Request, env: any) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // ✅ Query Cloudflare D1
    const { results } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [key]);
    const file = results?.[0];

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({
      file_name: file.file_name,
      file_size: file.file_size,
      created_at: file.created_at,
      expires_at: file.expires_at,
      download_count: file.download_count || 0,
      max_downloads: file.max_downloads || null,
    });
  } catch (error: any) {
    console.error("Download info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get file info" },
      { status: 500 }
    );
  }
}
