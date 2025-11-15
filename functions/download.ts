// zyncrate/functions/download.ts
import { getFromR2, deleteFromR2 } from "../lib/r2";
import { queryDB, execDB } from "../lib/db";

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return new Response("Missing id", { status: 400 });

  const { results } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [id]);
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

export async function onRequestPost(context: any) {
  const { request, env } = context;

  const body = await request.json().catch(() => ({}));
  const id = body?.id || new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const { results } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [id]);
  const row = results?.[0];
  if (!row) return new Response("Not found", { status: 404 });

  const now = Date.now();
  if (row.expires_at && now > row.expires_at) {
    try {
      await deleteFromR2(env, row.path);
      await execDB(env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [id]);
    } catch (_) {}
    return new Response("File expired", { status: 410 });
  }

  if (row.max_downloads > 0 && row.download_count >= row.max_downloads) {
    return new Response("Download limit reached", { status: 403 });
  }

  if (row.lock_key) {
    const provided = body?.key;
    if (!provided) {
      return new Response(JSON.stringify({ error: "key_required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const hash = await hashSHA256(provided);
    if (hash !== row.lock_key) return new Response("Invalid key", { status: 403 });
  }

  const stream = await getFromR2(env, row.path);
  if (!stream) return new Response("Missing file", { status: 404 });

  await execDB(env, "UPDATE files SET download_count = download_count + 1 WHERE key = ?", [id]);

  if (row.one_time === 1) {
    try {
      await deleteFromR2(env, row.path);
      await execDB(env, "UPDATE files SET is_deleted = 1 WHERE key = ?", [id]);
    } catch (_) {}
  }

  const headers = {
    "Content-Type": row.mime_type || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${sanitize(row.file_name)}"`
  };

  return new Response(stream, { headers });
}

function sanitize(name: string) {
  return name.replace(/["/\\<>]/g, "_");
}

async function hashSHA256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
