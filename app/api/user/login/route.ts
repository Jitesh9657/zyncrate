// app/api/user/login/route.ts
import { NextResponse } from "next/server";
import { queryDB, execDB } from "@/lib/db";
import { nanoid } from "nanoid";

export const runtime = "edge"; // ✅ Cloudflare Edge-compatible

type ReqBody = {
  email?: string;
  password?: string;
};

// ✅ Edge-safe password verification (SHA-256)
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hexHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hexHash === storedHash;
}

export async function POST(req: Request, env: any) {
  try {
    const body = (await req.json()) as ReqBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required." },
        { status: 400 }
      );
    }

    // ✅ Fetch user from Cloudflare D1
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

    // ✅ Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    // ✅ Generate a new auth token
    const auth_token = nanoid(32);
    await execDB(env, "UPDATE users SET auth_token = ? WHERE id = ?", [
      auth_token,
      user.id,
    ]);

    // ✅ Build response
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, plan: user.plan },
      auth_token,
      message: "Login successful — token issued.",
    });

    // ✅ Set secure cookie
    response.cookies.set("auth_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("🔥 Login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to login." },
      { status: 500 }
    );
  }
}
