// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { randomUUID } from "crypto";
import { CONFIG } from "@/lib/config";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Cloudflare Pages compatible

export async function POST(req: Request, env: any) {
  console.log("⏳ Upload route hit (Cloudflare)");

  try {
    // Identify uploader
    const userType = req.headers.get("x-user-type") || "guest";
    const userId = req.headers.get("x-user-id") || null;
    const guestId = req.headers.get("x-guest-id") || null;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse optional fields
    const expiryHours = Number(formData.get("expiry_hours")) || 24;
    const maxDownloads = Number(formData.get("max_downloads")) || 5;
    const locked = formData.get("locked") === "1" || formData.get("locked") === "true";
    const lockKey = (formData.get("lock_key") as string) || null;
    const oneTime = formData.get("one_time") === "1" || formData.get("one_time") === "true";

    // Get limits based on user type
    let limits = CONFIG.limits.guest;
    if (userType === "user") {
      const { results } = await queryDB(env, "SELECT plan FROM users WHERE id = ?", [userId]);
      const user = results?.[0];
      limits = user?.plan === "pro" ? CONFIG.limits.userPro : CONFIG.limits.userFree;
    }

    // ✅ Enforce max file size
    const allowedMaxSize = limits.maxUploadSizeMB * 1024 * 1024;
    if (file.size > allowedMaxSize) {
      return NextResponse.json(
        { error: `File too large. Max allowed: ${limits.maxUploadSizeMB} MB` },
        { status: 413 }
      );
    }

    // ✅ Enforce expiry limits
    const finalExpiryHours = Math.min(expiryHours, limits.maxExpiryHours);

    // ✅ Upload to R2
    const key = `${randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );

    console.log("✅ Uploaded to R2:", key);

    const createdAt = Date.now();
    const expiresAt = createdAt + finalExpiryHours * 60 * 60 * 1000;

    // ✅ Store file metadata in D1
    await queryDB(
      env,
      `INSERT INTO files
      (key, file_name, file_size, mime_type, path, created_at, expires_at,
       download_count, max_downloads, one_time, is_deleted,
       locked, lock_key, user_id, guest_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        key,
        file.name,
        file.size,
        file.type || null,
        key,
        createdAt,
        expiresAt,
        0,
        maxDownloads,
        oneTime ? 1 : 0,
        0,
        locked ? 1 : 0,
        lockKey,
        userType === "user" ? userId : null,
        userType === "guest" ? guestId : null,
      ]
    );

    // ✅ Log analytics
    await queryDB(
      env,
      `INSERT INTO analytics (file_key, user_id, guest_session_id, action, timestamp, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        key,
        userType === "user" ? userId : null,
        userType === "guest" ? guestId : null,
        "upload",
        Date.now(),
        req.headers.get("x-forwarded-for") || null,
        req.headers.get("user-agent") || null,
      ]
    );

    // ✅ Return file link
    const baseUrl = env.BASE_URL || "https://zyncrate.pages.dev";
    const downloadLink = `${baseUrl}/download?key=${encodeURIComponent(key)}`;

    return NextResponse.json({
      success: true,
      key,
      link: downloadLink,
      message: "File uploaded successfully",
    });
  } catch (err: any) {
    console.error("🔥 Upload failed:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
