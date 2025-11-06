import { NextResponse } from "next/server";
import { getR2Client } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "edge";

export async function GET(req: Request, env: any) {
  try {
    const r2 = getR2Client(env);
    const key = `test-${Date.now()}.txt`;
    const body = `Cloudflare test file at ${new Date().toISOString()}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      })
    );

    return NextResponse.json({
      success: true,
      message: `✅ Uploaded test file to ${env.R2_BUCKET}/${key}`,
    });
  } catch (err: any) {
    console.error("Test R2 failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
