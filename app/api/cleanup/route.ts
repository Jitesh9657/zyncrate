// app/api/cleanup/route.ts
import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { queryDB } from "@/lib/db"; // ✅ new D1 query helper

export const runtime = "edge"; // ✅ Required for Cloudflare Pages

export async function GET(req: Request, env: any) {
  try {
    const now = Date.now();

    // ✅ Fetch expired files (use D1)
    const { results: expiredFiles } = await queryDB(
      env,
      `SELECT id, key FROM files WHERE expires_at < ?`,
      [now]
    );

    if (!expiredFiles || expiredFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired files found.",
      });
    }

    // ✅ Delete files from R2
    for (const f of expiredFiles) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: f.key,
          })
        );
      } catch (err) {
        console.error("⚠️ Failed to delete from R2:", f.key, err);
      }
    }

    // ✅ Remove records from DB
    const ids = expiredFiles.map((f) => f.id);
    const placeholders = ids.map(() => "?").join(",");
    await queryDB(env, `DELETE FROM files WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `🧹 Deleted ${ids.length} expired files.`,
    });
  } catch (err: any) {
    console.error("🔥 Cleanup error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
