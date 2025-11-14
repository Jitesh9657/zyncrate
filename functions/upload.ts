// zyncrate/functions/upload.ts
import { uploadToR2 } from "../lib/r2";
import { execDB } from "../lib/db";

/**
 * Upload handler (POST multipart/form-data)
 * Fields:
 *  - file (File)
 *  - expiryHours (number) optional, default 24
 *  - maxDownloads (number) optional, default 0 (unlimited)
 *  - key (string) optional -> protects download
 *  - one_time (0|1) optional
 *
 * Returns { success, fileKey, downloadUrl }
 */
export async function onRequest(context: any) {
  try {
    if (context.request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const form = await context.request.formData();
    const file = form.get("file") as File | null;
    if (!file) return new Response("No file provided", { status: 400 });

    const expiryHours = Number(form.get("expiryHours") ?? 24);
    const maxDownloads = Number(form.get("maxDownloads") ?? 0);
    const keyPlain = (form.get("key") as string) || null;
    const oneTime = Number(form.get("one_time") ?? 0) ? 1 : 0;

    // generate id and path
    const uuid = crypto.randomUUID();
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");

    // preserve extension if exists
    const originalName = (file as any).name || `file-${uuid}`;
    const ext = originalName.includes(".") ? "." + originalName.split(".").pop() : "";
    const fileKey = `f_${uuid}`; // DB unique key
    const r2Path = `uploads/${y}/${m}/${d}/${fileKey}${ext}`;

    // read file body
    const arrayBuffer = await (file as any).arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // store file to R2
    await uploadToR2(context.env, r2Path, fileBytes, (file as any).type || "application/octet-stream");

    // hash key if provided
    let lockKeyHash: string | null = null;
    if (keyPlain) {
      lockKeyHash = await hashSHA256(keyPlain);
    }

    // expiry timestamp (ms)
    const expires_at = Date.now() + expiryHours * 60 * 60 * 1000;

    // insert metadata into D1
    await execDB(
      context.env,
      `INSERT INTO files
        (key, file_name, file_size, mime_type, path, created_at, expires_at, max_downloads, one_time, lock_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileKey,
        originalName,
        (file as any).size ?? fileBytes.length,
        (file as any).type || "application/octet-stream",
        r2Path,
        Date.now(),
        expires_at,
        maxDownloads,
        oneTime,
        lockKeyHash,
      ]
    );

    const downloadUrl = `/download.html?id=${encodeURIComponent(fileKey)}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileKey,
        downloadUrl,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("upload error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const MAX_SIZE = 1024 * 1024 * 200; // 200 MB or your choice
if (file.size > MAX_SIZE) {
  return new Response("File too large", { status: 413 });
}


// helper hash
async function hashSHA256(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
