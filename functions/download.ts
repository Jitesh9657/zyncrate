// zyncrate/functions/download.ts
import { getFromR2, deleteFromR2 } from "../lib/r2";
import { queryDB, execDB } from "../lib/db";

/**
 * Download handler.
 * - GET ?id=FILEKEY  -> returns metadata JSON { requiresKey, expired, allowed }
 * - POST body { id, key? } -> attempts to return file stream if allowed
 *
 * Note: We stream file content via the Worker (so no presigned URLs required).
 */
export async function onRequest(context: any) {
  try {
    if (context.request.method === "GET") {
      const url = new URL(context.request.url);
      const id = url.searchParams.get("id");
      if (!id) return new Response("Missing id", { status: 400 });

      const { results } = await queryDB(context.env, "SELECT * FROM files WHERE key = ?", [id]);
      const row = results?.[0];
      if (!row) return new Response("Not found", { status: 404 });

      const now = Date.now();
      const expired = row.expires_at && now > row.expires_at;
      const requiresKey = !!row.lock_key;
      const downloadsExceeded = row.max_downloads > 0 && row.download_count >= row.max_downloads;

      return new Response(
        JSON.stringify({
          id,
          fileName: row.file_name,
          size: row.file_size,
          mimeType: row.mime_type,
          requiresKey,
          expired,
          downloadsExceeded,
          one_time: row.one_time === 1,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // POST -> attempt download (accept JSON body)
    if (context.request.method === "POST") {
      const body = await context.request.json().catch(() => ({}));
      const id = body?.id || (new URL(context.request.url).searchParams.get("id"));
      if (!id) return new Response("Missing id", { status: 400 });

      const { results } = await queryDB(context.env, "SELECT * FROM files WHERE key = ?", [id]);
      const row = results?.[0];
      if (!row) return new Response("Not found", { status: 404 });

      const now = Date.now();
      if (row.expires_at && now > row.expires_at) {
        // optional: cleanup R2 + mark deleted
        try {
          await deleteFromR2(context.env, row.path);
          await execDB(context.env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [id]);
        } catch (e) {
          console.warn("cleanup error:", e);
        }
        return new Response("File expired", { status: 410 });
      }

      // check download limits
      if (row.max_downloads > 0 && row.download_count >= row.max_downloads) {
        return new Response("Download limit reached", { status: 403 });
      }

      // check lock key
      if (row.lock_key) {
        const providedKey = body?.key;
        if (!providedKey) {
          return new Response(
            JSON.stringify({ error: "key_required", message: "This file is protected. Provide key in POST body." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const providedHash = await hashSHA256(providedKey);
        if (providedHash !== row.lock_key) {
          return new Response("Invalid key", { status: 403 });
        }
      }

      // At this point, allowed. Stream file from R2
      // Use direct R2 access to get object (we'll use env.R2.get via r2.ts getFromR2 returns body)
      // r2.get returns an object; but helper getFromR2 returns body only — we will call env.R2.get directly to access metadata if needed.
      // However to keep with lib, we'll rely on row.mime_type and stream body via getFromR2
      const objBody = await getFromR2(context.env, row.path); // returns ReadableStream or ArrayBuffer depending on lib impl
      if (!objBody) return new Response("File not found in storage", { status: 404 });

      // increment counters and log analytics (best-effort)
      await execDB(context.env, "UPDATE files SET download_count = download_count + 1 WHERE key = ?", [id]);

      // Insert analytics entry (record ip/user-agent)
      try {
        const ip = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
        const ua = context.request.headers.get("User-Agent") || "";
        await execDB(
          context.env,
          `INSERT INTO analytics (file_key, action, timestamp, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
          [id, "download", Date.now(), ip, ua]
        );
      } catch (e) {
        console.warn("analytics store error", e);
      }

      // If one_time flag set, delete file after serving (best-effort async)
      if (row.one_time === 1) {
        // spawn but don't block (we'll still try to mark DB)
        try {
          await deleteFromR2(context.env, row.path);
          await execDB(context.env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [id]);
        } catch (e) {
          console.warn("one-time deletion error", e);
        }
      }

      // Return file stream with appropriate headers
      const headers: Record<string, string> = {
        "Content-Type": row.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(row.file_name || "file")}"`,
      };

      return new Response(objBody, { headers });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err: any) {
    console.error("download error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// sanitize filename for Content-Disposition
function sanitizeFilename(name: string) {
  return name.replace(/["/\\<>]/g, "_");
}

async function hashSHA256(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
