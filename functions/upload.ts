import { uploadToR2 } from "../lib/r2";
import { execDB } from "../lib/db";

export async function onRequest(context: any) {
  const { env, request } = context;

  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Invalid form data", { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file") as File;
  if (!file) return new Response(JSON.stringify({ success: false, error: "No file provided" }), { status: 400 });

  // Limits
  const MAX_SIZE = 200 * 1024 * 1024; // 200MB
  if (file.size > MAX_SIZE) {
    return new Response(JSON.stringify({ success: false, error: "File too large" }), { status: 413 });
  }

  const expiryHours = Number(form.get("expiryHours")) || 24;
  const maxDownloads = Number(form.get("maxDownloads")) || 0;
  const key = form.get("key")?.toString() || "";
  const oneTime = Number(form.get("one_time")) === 1 ? 1 : 0;

  const id = "f_" + Math.random().toString(36).slice(2, 10);
  const r2Path = `files/${id}`;

  const arrayBuffer = await file.arrayBuffer();
  await uploadToR2(env, r2Path, arrayBuffer, file.type);

  const createdAt = Date.now();
  const expiresAt = createdAt + expiryHours * 60 * 60 * 1000;

  await execDB(
    env,
    `INSERT INTO files (key, file_name, file_size, mime_type, path, created_at, expires_at, max_downloads, one_time, locked, lock_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      file.name,
      file.size,
      file.type,
      r2Path,
      createdAt,
      expiresAt,
      maxDownloads,
      oneTime,
      key ? 1 : 0,
      key || null
    ]
  );

  return new Response(
    JSON.stringify({
      success: true,
      downloadUrl: `/download.html?id=${id}`,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
