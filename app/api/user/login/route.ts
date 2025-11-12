export const runtime = "edge";

import { NextResponse } from "next/server";
import { queryDB, execDB } from "@/lib/db";
import { nanoid } from "nanoid";

type ReqBody = {
  email?: string;
  password?: string;
};

// ✅ Edge-native password verification using Web Crypto API
async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<boolean> {
  const data = new TextEncoder().encode(plain);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHash === storedHash;
}

export async function POST(req: Request, env: any) {
  try {
    const body = (await req.json()) as ReqBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // ✅ Query D1 for user
    const { results } = await queryDB(
      env,
      "SELECT id, email, password_hash, plan FROM users WHERE email = ?",
      [email]
    );

    const user = results?.[0];
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email." },
        { status: 404 }
      );
    }

    // ✅ Verify password securely
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 401 }
      );
    }

    // ✅ Issue auth token
    const authToken = nanoid(32);
    await execDB(env, "UPDATE users SET auth_token = ? WHERE id = ?", [
      authToken,
      user.id,
    ]);

    // ✅ Prepare response
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, plan: user.plan },
      auth_token: authToken,
      message: "✅ Login successful — token issued.",
    });

    // ✅ Secure cookie setup
    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // Cloudflare Pages always serves HTTPS
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("🔥 Login error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to login." },
      { status: 500 }
    );
  }
}
