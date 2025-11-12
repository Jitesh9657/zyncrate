export const runtime = "edge";

import { NextResponse } from "next/server";
import { deleteFromR2 } from "@/lib/r2";
import { queryDB, execDB } from "@/lib/db"; // D1 helpers

export async function GET(req: Request, env: any) {
  try {
    const now = Date.now();

    // ✅ Find expired files in D1
    const { results: expiredFiles } = await queryDB(
      env,
      `SELECT id, key FROM files WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [now]
    );

    if (!expiredFiles || expiredFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired files found.",
      });
    }

    // ✅ Delete each expired file from R2
    for (const file of expiredFiles) {
      try {
        await deleteFromR2(env.R2_BUCKET_NAME!, file.key);
      } catch (err) {
        console.error("⚠️ Failed to delete R2 object:", file.key, err);
      }
    }

    // ✅ Remove file records from D1
    const ids = expiredFiles.map((f) => f.id);
    const placeholders = ids.map(() => "?").join(",");
    await execDB(env, `DELETE FROM files WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `🧹 Deleted ${ids.length} expired files.`,
    });
  } catch (err: any) {
    console.error("🔥 Cleanup error:", err);
    return NextResponse.json(
      { error: err.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}
