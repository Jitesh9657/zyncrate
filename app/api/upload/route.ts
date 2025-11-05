import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import db from "@/lib/db";
import { randomUUID } from "crypto";
import { CONFIG } from "@/lib/config";

export async function POST(req: Request) {
  console.log("⏳ Upload route hit");

  try {
    // Identify uploader (middleware sets these)
    const userType = req.headers.get("x-user-type") || "guest";
    const userId = req.headers.get("x-user-id") || null;
    const guestId = req.headers.get("x-guest-id") || null;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse optional fields
    const expiryHoursRaw = formData.get("expiry_hours") as string | null;
    const maxDownloadsRaw = formData.get("max_downloads") as string | null;
    const lockedRaw = formData.get("locked") as string | null;
    const lockKeyRaw = formData.get("lock_key") as string | null;
    const oneTimeRaw = formData.get("one_time") as string | null;

    const expiryHours = expiryHoursRaw ? parseInt(expiryHoursRaw, 10) : 24;
    const maxDownloads = maxDownloadsRaw ? parseInt(maxDownloadsRaw, 10) : 5;
    const locked = lockedRaw === "1" || lockedRaw === "true";
    const lock_key = lockKeyRaw ? String(lockKeyRaw) : null;
    const one_time = oneTimeRaw === "1" || oneTimeRaw === "true";

    // 🧠 Determine limit set
    let limits = CONFIG.limits.guest;
    if (userType === "user") {
      const user = db.prepare("SELECT plan FROM users WHERE id = ?").get(userId);
      limits = user?.plan === "pro" ? CONFIG.limits.userPro : CONFIG.limits.userFree;
    }

    // Enforce max file size
    const allowedMaxSize = limits.maxUploadSizeMB * 1024 * 1024;
    if (file.size > allowedMaxSize) {
      return NextResponse.json(
        {
          error: `File too large. Max allowed: ${limits.maxUploadSizeMB} MB`,
        },
        { status: 413 }
      );
    }

    // Enforce expiry limits
    const maxAllowedExpiry = limits.maxExpiryHours;
    const finalExpiryHours =
      expiryHours > maxAllowedExpiry ? maxAllowedExpiry : expiryHours;

    // Prepare R2 key and upload
    const key = `${randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      })
    );

    console.log("✅ Uploaded to R2:", key);

    // Compute timestamps
    const created_at = Date.now();
    const expires_at = created_at + finalExpiryHours * 60 * 60 * 1000;

    // Store file metadata
    db.prepare(
      `INSERT INTO files
        (key, file_name, file_size, mime_type, path, created_at, expires_at,
         download_count, max_downloads, one_time, is_deleted,
         locked, lock_key, user_id, guest_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      key,
      file.name,
      file.size,
      file.type || null,
      key,
      created_at,
      expires_at,
      0,
      maxDownloads,
      one_time ? 1 : 0,
      0,
      locked ? 1 : 0,
      lock_key,
      userType === "user" ? userId : null,
      userType === "guest" ? guestId : null
    );

    // Analytics (optional)
    try {
      db.prepare(
        `INSERT INTO analytics (file_id, user_id, guest_session_id, action, timestamp, ip_address, user_agent)
         VALUES (
           (SELECT id FROM files WHERE key = ?),
           ?, ?, ?, ?, ?, ?
         )`
      ).run(
        key,
        userType === "user" ? userId : null,
        userType === "guest" ? guestId : null,
        "upload",
        Date.now(),
        req.headers.get("x-forwarded-for") || null,
        req.headers.get("user-agent") || null
      );
    } catch (e) {
      console.warn("Analytics upload insert failed:", e);
    }

    // Return file link
    const downloadPage = `${process.env.BASE_URL || ""}/download?key=${encodeURIComponent(
      key
    )}`;
    return NextResponse.json({
      success: true,
      key,
      link: downloadPage,
      message: "File uploaded successfully",
    });
  } catch (err: any) {
    console.error("🔥 Upload failed:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
