export const runtime = "edge";

import { NextResponse } from "next/server";
import { getFromR2, deleteFromR2 } from "@/lib/r2";
import { queryDB, execDB } from "@/lib/db";

export async function GET(req: Request, env: any) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const infoOnly = url.searchParams.get("info");
    const providedLockKey = url.searchParams.get("lock_key") || null;

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // ✅ 1. Fetch file metadata
    const { results } = await queryDB(
      env,
      "SELECT * FROM files WHERE key = ? AND is_deleted = 0",
      [key]
    );
    const file = results?.[0];
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ✅ 2. Handle expiry
    if (file.expires_at && Date.now() > Number(file.expires_at)) {
      try {
        await deleteFromR2(env.R2_BUCKET_NAME!, file.path || file.key);
      } catch (e) {
        console.warn("Failed to delete expired file from R2:", e);
      }
      await execDB(env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [key]);
      return NextResponse.json({ error: "File expired" }, { status: 410 });
    }

    // ✅ 3. Info-only mode
    if (infoOnly === "true") {
      return NextResponse.json({
        key: file.key,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        created_at: file.created_at,
        expires_at: file.expires_at,
        download_count: file.download_count,
        max_downloads: file.max_downloads,
        one_time: file.one_time ? 1 : 0,
        locked: file.locked ? 1 : 0,
      });
    }

    // ✅ 4. Locked file check
    if (file.locked && (!providedLockKey || providedLockKey !== file.lock_key)) {
      return NextResponse.json(
        { error: "File is locked. Invalid or missing key." },
        { status: 403 }
      );
    }

    // ✅ 5. Download limit check
    if (file.max_downloads && file.download_count >= file.max_downloads) {
      return NextResponse.json(
        { error: "Download limit reached" },
        { status: 403 }
      );
    }

    // ✅ 6. Get file stream from R2
    const fileStream = await getFromR2(env.R2_BUCKET_NAME!, file.path || file.key);
    if (!fileStream) {
      return NextResponse.json({ error: "File missing in R2" }, { status: 404 });
    }

    // ✅ 7. Increment download count
    await execDB(env, "UPDATE files SET download_count = download_count + 1 WHERE key = ?", [key]);

    // ✅ 8. Insert analytics record
    try {
      await execDB(
        env,
        `INSERT INTO analytics (file_id, file_key, user_id, guest_session_id, action, timestamp, ip_address, user_agent)
         VALUES ((SELECT id FROM files WHERE key = ?), ?, ?, ?, ?, ?, ?, ?)`,
        [
          key,
          key,
          null,
          null,
          "download",
          Date.now(),
          req.headers.get("x-forwarded-for") || null,
          req.headers.get("user-agent") || null,
        ]
      );
    } catch (e) {
      console.warn("⚠️ Analytics insert failed:", e);
    }

    // ✅ 9. Check one-time or max downloads
    const { results: updatedFiles } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [key]);
    const fileAfter = updatedFiles?.[0];
    const needsDelete =
      (fileAfter.one_time && fileAfter.download_count >= 1) ||
      (fileAfter.max_downloads && fileAfter.download_count >= fileAfter.max_downloads);

    if (needsDelete) {
      try {
        await deleteFromR2(env.R2_BUCKET_NAME!, file.path || file.key);
      } catch (e) {
        console.warn("Failed to delete object after download:", e);
      }
      await execDB(env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [key]);
    }

    // ✅ 10. Return file to user
    const headers: Record<string, string> = {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.file_name)}"`,
    };

    if (file.file_size) headers["Content-Length"] = String(file.file_size);

    return new Response(fileStream as ReadableStream, { headers });
  } catch (error: any) {
    console.error("🔥 Download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download file" },
      { status: 500 }
    );
  }
}
