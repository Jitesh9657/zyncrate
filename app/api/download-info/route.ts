import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const file = db.prepare("SELECT * FROM files WHERE key = ?").get(key);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({
      file_name: file.file_name,
      size: file.size,
      created_at: file.created_at,
      expires_in: file.expires_in,
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
