// app/api/guest/session/route.ts
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { execDB } from "@/lib/db"; // ✅ use execDB for INSERT/UPDATE/DELETE

export const runtime = "edge"; // ✅ Required for Cloudflare Pages / Edge Runtime

export async function GET(req: Request, env: any) {
  try {
    // ✅ Generate identifiers
    const session_id = nanoid(16);
    const auth_token = nanoid(32);
    const now = Date.now();
    const expires_at = now + 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    // ✅ Capture request metadata
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    // ✅ Insert guest into D1
    await execDB(
      env,
      `
        INSERT INTO guests (temp_token, created_at, expires_at, ip_address, user_agent, last_activity)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [auth_token, now, expires_at, ip, ua, now]
    );

    // ✅ Build response body
    const response = NextResponse.json({
      success: true,
      session_id,
      auth_token,
      expires_at,
      message: "Guest session created successfully.",
    });

    // ✅ Set persistent guest cookie (for 7 days)
    response.cookies.set("guest_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("🔥 Guest session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create guest session" },
      { status: 500 }
    );
  }
}
