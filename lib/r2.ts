// app/lib/r2.ts
/**
 * ✅ Cloudflare R2 client (no AWS SDK)
 * Works in Edge runtime and reduces bundle size drastically.
 */

export function getR2Client(env: any) {
  if (!env?.R2) {
    throw new Error("Missing R2 binding. Make sure wrangler.toml defines R2 = { binding = \"R2\", bucket_name = \"your-bucket\" }");
  }

  return env.R2; // Cloudflare auto-binds R2 bucket to env.R2
}

/**
 * ⬆️ Upload a file to R2
 */
export async function uploadToR2(env: any, key: string, body: ArrayBuffer | Uint8Array, type?: string) {
  const r2 = getR2Client(env);
  await r2.put(key, body, { httpMetadata: { contentType: type || "application/octet-stream" } });
  return true;
}

/**
 * ⬇️ Download (get) a file stream
 */
export async function getFromR2(env: any, key: string) {
  const r2 = getR2Client(env);
  const obj = await r2.get(key);
  if (!obj) throw new Error("File not found in R2");
  return obj.body;
}

/**
 * 🗑️ Delete a file
 */
export async function deleteFromR2(env: any, key: string) {
  const r2 = getR2Client(env);
  await r2.delete(key);
  return true;
}
