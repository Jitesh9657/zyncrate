// app/lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

/**
 * ✅ Creates a Cloudflare R2-compatible S3 client.
 * Automatically works for both local `.env` and Cloudflare Edge environments.
 */
export function getR2Client(env?: any) {
  const endpoint =
    env?.R2_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId =
    env?.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    env?.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.error("⚠️ Missing R2 credentials or endpoint.");
    throw new Error("R2 client initialization failed — missing credentials.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Default R2 client (for local development use only).
 * In Cloudflare, always use `getR2Client(env)` from your route handlers.
 */
export const r2 = getR2Client(process.env);
