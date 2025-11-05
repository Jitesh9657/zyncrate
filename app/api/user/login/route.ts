// app/api/user/login/route.ts
import { NextResponse } from "next/server";
import { queryDB } from "@/lib/db";
import { nanoid } from "nanoid";

export const runtime = "edge"; // ✅ Cloudflare Edge-compatible

type ReqBody = {
  email?: string;
  password?: string;
};

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // ✅ Use Web Crypto API (Edge compatible)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hexHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return hexHash === hash; // Compare hashes (simple SHA-based)
}

export async function POST(req: Request, env: any) {
  try {
    const body = (await req.json()) as ReqBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // ✅ Fetch user from D1
    const { results } = await queryDB(
      env,
      "SELECT id, password_hash FROM users WHERE email = ?",
      [email]
    );

    const user = results?.[0];
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    // ✅ Verify password (SHA-256 version)
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // ✅ Generate and store auth token
    const auth_token = nanoid(32);
    await queryDB(env, "UPDATE users SET auth_token = ? WHERE id = ?", [
      auth_token,
      user.id,
    ]);

    // ✅ Return with token + cookie
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email },
      auth_token,
      message: "Login successful — token stored.",
    });

    res.cookies.set("auth_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return res;
  } catch (err: any) {
    console.error("🔥 Login error:", err);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
