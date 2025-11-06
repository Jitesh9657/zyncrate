// lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

/**
 * ✅ Lazy initializer for Cloudflare R2 client
 * Works in both build-time and runtime contexts.
 */
export function getR2Client(env?: any) {
  const endpoint = env?.R2_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId = env?.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env?.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn("⚠️ Missing R2 credentials or endpoint.");
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
