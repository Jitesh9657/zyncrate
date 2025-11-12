export const runtime = "edge";

import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { execDB } from "@/lib/db";
import { nanoid } from "nanoid";

export async function POST(req: Request, env: any) {
  try {
    console.log("⏳ Upload route hit (Cloudflare Edge)");

    // ✅ Load configuration
    const CONFIG = await loadConfig(env);

    // ✅ Identify uploader
    const userType = req.headers.get("x-user-type") || "guest";
    const userId = req.headers.get("x-user-id");
    const guestId = req.headers.get("x-guest-id");

    // ✅ Parse incoming form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const expiryHours = Number(formData.get("expiry_hours")) || 24;
    const maxDownloads = Number(formData.get("max_downloads")) || 5;
    const locked = ["1", "true"].includes(String(formData.get("locked")));
    const lockKey = (formData.get("lock_key") as string) || null;
    const oneTime = ["1", "true"].includes(String(formData.get("one_time")));

    // ✅ Determine plan limits
    let limits = CONFIG.limits.guest;
    if (userType === "user" && userId) {
      const { results } = await env.DB.prepare(
        "SELECT plan FROM users WHERE id = ?"
      ).bind(userId).all();
      const plan = results?.[0]?.plan;
      limits = plan === "pro" ? CONFIG.limits.userPro : CONFIG.limits.userFree;
    }

    // ✅ Enforce size limit
    const maxSizeBytes = limits.maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File too large. Max allowed: ${limits.maxUploadSizeMB} MB` },
        { status: 413 }
      );
    }

    // ✅ Expiry enforcement
    const finalExpiryHours = Math.min(expiryHours, limits.maxExpiryHours);

    // ✅ Upload directly to R2 (no AWS SDK)
    const key = `${nanoid(16)}-${file.name}`;
    const body = await file.arrayBuffer();

    await env.R2.put(key, body, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    console.log("✅ Uploaded to R2:", key);

    // ✅ Record metadata in D1
    const createdAt = Date.now();
    const expiresAt = createdAt + finalExpiryHours * 60 * 60 * 1000;

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

    // ✅ Log analytics
    await execDB(
      env,
      `INSERT INTO analytics
         (file_key, user_id, guest_session_id, action, timestamp, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        key,
        userType === "user" ? userId : null,
        userType === "guest" ? guestId : null,
        "upload",
        Date.now(),
        req.headers.get("x-forwarded-for"),
        req.headers.get("user-agent"),
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
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
