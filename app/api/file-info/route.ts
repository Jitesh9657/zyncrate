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

    return NextResponse.json(file);
  } catch (error: any) {
    console.error("File info error:", error);
    return NextResponse.json({ error: "Failed to get file info" }, { status: 500 });
  }
}
