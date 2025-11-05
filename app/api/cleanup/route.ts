import { NextResponse } from "next/server";
import db from "@/lib/db";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";

export async function GET() {
  try {
    const now = Date.now();

    // Get expired files
    const expiredFiles = db.prepare(`
      SELECT id, key FROM files WHERE (created_at + expires_in) < ?
    `).all(now);

    if (expiredFiles.length === 0) {
      return NextResponse.json({ success: true, message: "No expired files." });
    }

    // Delete from R2
    for (const f of expiredFiles) {
      try {
        await r2.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: f.key,
        }));
      } catch (err) {
        console.error("Failed to delete from R2:", f.key, err);
      }
    }

    // Remove from DB
    db.prepare("DELETE FROM files WHERE id IN (" + expiredFiles.map(f => f.id).join(",") + ")").run();

    return NextResponse.json({
      success: true,
      deleted: expiredFiles.length,
      message: `Deleted ${expiredFiles.length} expired files.`,
    });
  } catch (err: any) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
