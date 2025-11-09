import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// ✅ Use R2-compatible endpoint (Cloudflare)
const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2(bucket: string, key: string, body: ArrayBuffer | Uint8Array) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  });
  return R2.send(cmd);
}

export async function getFromR2(bucket: string, key: string) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const res = await R2.send(cmd);
  return res.Body; // stream
}

export async function deleteFromR2(bucket: string, key: string) {
  const cmd = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return R2.send(cmd);
}

export async function checkR2Object(bucket: string, key: string) {
  const cmd = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  try {
    const res = await R2.send(cmd);
    return res;
  } catch {
    return null;
  }
}
