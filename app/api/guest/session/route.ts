// app/api/guest/session/route.ts
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { queryDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Cloudflare Pages edge environment

export async function GET(req: Request, env: any) {
  try {
    const session_id = nanoid(16);
    const auth_token = nanoid(32);
    const now = Date.now();
    const expires_at = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Capture IP and User-Agent
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    // ✅ Insert guest record into Cloudflare D1
    await queryDB(
      env,
      `
        INSERT INTO guests (temp_token, created_at, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `,
      [auth_token, now, expires_at, ip, ua]
    );

    // ✅ Build response
    const res = NextResponse.json({
      success: true,
      session_id,
      auth_token,
      expires_at,
    });

    // ✅ Set cookie (Cloudflare supports it)
    res.cookies.set("auth_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return res;
  } catch (err: any) {
    console.error("Guest session error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create guest session" },
      { status: 500 }
    );
  }
}
