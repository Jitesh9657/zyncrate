// app/api/download/route.ts
import { NextResponse } from "next/server";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const infoOnly = url.searchParams.get("info");
    const providedLockKey = url.searchParams.get("lock_key") || null;

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const file = db.prepare("SELECT * FROM files WHERE key = ? AND is_deleted = 0").get(key);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check expiry by timestamp
    if (file.expires_at && Date.now() > Number(file.expires_at)) {
      // delete R2 object if exists, then delete DB record
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: file.path || file.key }));
      } catch (e) {
        console.warn("Failed to delete expired object from R2:", e);
      }
      db.prepare("UPDATE files SET is_deleted = 1 WHERE key = ?").run(key);
      return NextResponse.json({ error: "File expired" }, { status: 410 });
    }

    // If only info requested (for preview page)
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

    // If locked, check provided key
    if (file.locked) {
      if (!providedLockKey || providedLockKey !== file.lock_key) {
        return NextResponse.json({ error: "File is locked. Invalid or missing key." }, { status: 403 });
      }
    }

    // Check download limit
    if (file.max_downloads && file.download_count >= file.max_downloads) {
      return NextResponse.json({ error: "Download limit reached" }, { status: 403 });
    }

    // Fetch the object from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: file.path || file.key,
    });

    const result = await r2.send(command);

    // increment download_count
    db.prepare("UPDATE files SET download_count = download_count + 1 WHERE key = ?").run(key);

    // log analytics
    try {
      db.prepare(`INSERT INTO analytics (file_id, file_key, user_id, guest_session_id, action, timestamp, ip_address, user_agent)
                  VALUES ((SELECT id FROM files WHERE key = ?), ?, ?, ?, ?, ?, ?, ?)`).run(
        key,
        key,
        null,
        null,
        "download",
        Date.now(),
        req.headers.get("x-forwarded-for") || null,
        req.headers.get("user-agent") || null
      );
    } catch (e) {
      console.warn("Analytics download insert failed:", e);
    }

    // If one_time or reached max downloads after increment -> cleanup
    const fileAfter = db.prepare("SELECT * FROM files WHERE key = ?").get(key);
    const needsDelete = (fileAfter.one_time && fileAfter.download_count >= 1) ||
                        (fileAfter.max_downloads && fileAfter.download_count >= fileAfter.max_downloads);

    if (needsDelete) {
      // delete from R2 and mark deleted in DB
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: file.path || file.key }));
      } catch (e) {
        console.warn("Failed to delete object from R2 after download:", e);
      }
      db.prepare("UPDATE files SET is_deleted = 1 WHERE key = ?").run(key);
    }

    // Build response with headers
    const contentLength = result.ContentLength?.toString() || (file.file_size ? String(file.file_size) : undefined);
    const headers: Record<string, string> = {
      "Content-Type": (result.ContentType || file.mime_type || "application/octet-stream"),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.file_name)}"`,
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new Response(result.Body as ReadableStream, { headers });
  } catch (error: any) {
    console.error("Download error:", error);
    return NextResponse.json({ error: error.message || "Failed to download file" }, { status: 500 });
  }
}
