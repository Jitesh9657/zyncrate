export const runtime = "edge";

import { NextResponse } from "next/server";

export async function GET(_req: Request, env: any) {
  try {
    const key = `test-${Date.now()}.txt`;
    const content = `Cloudflare R2 test file at ${new Date().toISOString()}`;

    // ✅ Use R2 bucket binding directly (no AWS SDK)
    await env.R2.put(key, content, {
      httpMetadata: { contentType: "text/plain" },
    });

    return NextResponse.json({
      success: true,
      message: `✅ Uploaded test file to ${env.R2_BUCKET_NAME || "R2"}/${key}`,
      key,
    });
  } catch (err: any) {
    console.error("🔥 R2 test failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload test file" },
      { status: 500 }
    );
  }
}
