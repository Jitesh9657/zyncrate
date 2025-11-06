// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { loadConfig } from "@/lib/config";   // ✅ fixed import
import { execDB } from "@/lib/db";           // ✅ D1 helper
import { nanoid } from "nanoid";             // ✅ edge-safe id generator

export const runtime = "edge"; // ✅ Cloudflare Pages compatible (Edge Runtime)

export async function POST(req: Request, env: any) {
  console.log("⏳ Upload route hit (Cloudflare Edge)");

  // ✅ dynamically load config (since config values come from D1)
  const CONFIG = await loadConfig(env);

  try {
    // ✅ Identify uploader
    const userType = req.headers.get("x-user-type") || "guest";
    const userId = req.headers.get("x-user-id") || null;
    const guestId = req.headers.get("x-guest-id") || null;

    // ✅ Parse incoming form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const expiryHours = Number(formData.get("expiry_hours")) || 24;
    const maxDownloads = Number(formData.get("max_downloads")) || 5;
    const locked = formData.get("locked") === "1" || formData.get("locked") === "true";
    const lockKey = (formData.get("lock_key") as string) || null;
    const oneTime = formData.get("one_time") === "1" || formData.get("one_time") === "true";

    // ✅ Determine upload limits
    let limits = CONFIG.limits.guest;
    if (userType === "user" && userId) {
      const { results } = await env.DB.prepare("SELECT plan FROM users WHERE id = ?").bind(userId).all();
      const user = results?.[0];
      limits = user?.plan === "pro" ? CONFIG.limits.userPro : CONFIG.limits.userFree;
    }

    // ✅ Enforce size
    const allowedMaxSize = limits.maxUploadSizeMB * 1024 * 1024;
    if (file.size > allowedMaxSize) {
      return NextResponse.json(
        { error: `File too large. Max allowed: ${limits.maxUploadSizeMB} MB` },
        { status: 413 }
      );
    }

    // ✅ Expiry enforcement
    const finalExpiryHours = Math.min(expiryHours, limits.maxExpiryHours);

    // ✅ Upload file to R2
    const key = `${nanoid(16)}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const r2 = getR2Client(env);
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );

    console.log("✅ Uploaded to R2:", key);

    const createdAt = Date.now();
    const expiresAt = createdAt + finalExpiryHours * 60 * 60 * 1000;

    // ✅ Save metadata in D1
    await execDB(
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

    // ✅ Record analytics
    await execDB(
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

    const baseUrl = env.BASE_URL || "https://zyncrate.pages.dev";
    const downloadLink = `${baseUrl}/download?key=${encodeURIComponent(key)}`;

    return NextResponse.json({
      success: true,
      key,
      link: downloadLink,
      expires_at: expiresAt,
      message: "File uploaded successfully ✅",
    });
  } catch (err: any) {
    console.error("🔥 Upload failed:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
