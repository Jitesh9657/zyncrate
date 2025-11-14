// zyncrate/functions/key-verify.ts
import { queryDB } from "../lib/db";

/**
 * Verifies a provided key for a file.
 * POST { id: FILEKEY, key: "1234" } -> { ok: true } or 401
 */
export async function onRequest(context: any) {
  try {
    if (context.request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await context.request.json().catch(() => ({}));
    const id = body?.id;
    const key = body?.key;
    if (!id || !key) return new Response("Missing id or key", { status: 400 });

    const { results } = await queryDB(context.env, "SELECT lock_key FROM files WHERE key = ?", [id]);
    const row = results?.[0];
    if (!row) return new Response("Not found", { status: 404 });

    if (!row.lock_key) {
      return new Response(JSON.stringify({ ok: true, message: "No key required" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const providedHash = await hashSHA256(key);
    if (providedHash !== row.lock_key) {
      return new Response(JSON.stringify({ ok: false, message: "Invalid key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("key-verify error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function hashSHA256(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
