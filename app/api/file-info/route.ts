// app/api/file-info/route.ts
import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Required for Cloudflare Pages

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

    // ✅ Return file info as-is
    return NextResponse.json(file);
  } catch (error: any) {
    console.error("File info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get file info" },
      { status: 500 }
    );
  }
}
