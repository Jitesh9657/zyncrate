import { NextResponse } from "next/server";
import db from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET(req: Request) {
  try {
    const session_id = nanoid(16);
    const auth_token = nanoid(32);
    const now = Date.now();
    const expires_at = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Capture IP and UA for basic analytics
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    // Store guest info
    db.prepare(`
      INSERT INTO guests (session_id, auth_token, created_at, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session_id, auth_token, now, expires_at, ip, ua);

    // Build response
    const res = NextResponse.json({
      success: true,
      session_id,
      auth_token,
      expires_at,
    });

    // Set auth cookie for persistence
    res.cookies.set("guest_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("Guest session error:", err);
    return NextResponse.json({ error: "Failed to create guest session" }, { status: 500 });
  }
}
