// app/api/cleanup/route.ts
import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { queryDB, execDB } from "@/lib/db"; // ✅ use execDB for mutations

export const runtime = "edge"; // ✅ ensures Cloudflare compatibility

export async function GET(req: Request, env: any) {
  try {
    const now = Date.now();

    // ✅ Initialize R2 client (runtime-safe)
    const r2 = getR2Client(env);

    // ✅ Get expired files using D1
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

    // ✅ Delete from R2
    for (const file of expiredFiles) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: env.R2_Bucket, // Cloudflare binding
            Key: file.key,
          })
        );
      } catch (err) {
        console.error("⚠️ Failed to delete R2 object:", file.key, err);
      }
    }

    // ✅ Delete from D1
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
