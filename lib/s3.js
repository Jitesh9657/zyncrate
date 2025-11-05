import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

export async function uploadToR2(key, body, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return s3Client.send(cmd);
}

export async function getObjectStream(key) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });
  const res = await s3Client.send(cmd);
  return res.Body;
}

export async function deleteFromR2(key) {
  const cmd = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });
  return s3Client.send(cmd);
}
