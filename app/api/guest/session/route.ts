export const runtime = "edge";

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { execDB } from "@/lib/db";

export async function GET(req: Request, env: any) {
  try {
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    // ✅ Generate unique session + token
    const sessionId = nanoid(16);
    const authToken = nanoid(32);

    // ✅ Capture request metadata
    const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // ✅ Insert into Cloudflare D1 (guests table)
    await execDB(
      env,
      `
      INSERT INTO guests (
        temp_token,
        created_at,
        expires_at,
        ip_address,
        user_agent,
        last_activity
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [authToken, now, expiresAt, ipAddress, userAgent, now]
    );

    // ✅ Build and return response
    const response = NextResponse.json({
      success: true,
      session_id: sessionId,
      auth_token: authToken,
      expires_at: expiresAt,
      message: "Guest session created successfully.",
    });

    // ✅ Set secure guest cookie
    response.cookies.set("guest_token", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // ⚠️ ensures HTTPS only
      maxAge: 7 * 24 * 60 * 60,
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
