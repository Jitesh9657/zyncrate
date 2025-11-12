export const runtime = "edge";

import { NextResponse } from "next/server";
import { queryDB, execDB } from "@/lib/db";
import { nanoid } from "nanoid";

type ReqBody = {
  email?: string;
  password?: string;
};

// ✅ Edge-safe SHA-256 hashing
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request, env: any) {
  try {
    const body = (await req.json()) as ReqBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Email and password (min 6 characters) required." },
        { status: 400 }
      );
    }

    // ✅ Check for existing user
    const { results: existing } = await queryDB(
      env,
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existing?.length) {
      return NextResponse.json(
        { error: "User already exists." },
        { status: 409 }
      );
    }

    // ✅ Create new user
    const passwordHash = await hashPassword(password);
    const authToken = nanoid(32);
    const createdAt = Date.now();

    await execDB(
      env,
      `INSERT INTO users (email, password_hash, created_at, auth_token, plan)
       VALUES (?, ?, ?, ?, 'free')`,
      [email, passwordHash, createdAt, authToken]
    );

    // ✅ Retrieve new user ID
    const { results: [newUser] = [] } = await queryDB(
      env,
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    // ✅ Return response with secure cookie
    const response = NextResponse.json({
      success: true,
      user: { id: newUser?.id, email, plan: "free" },
      auth_token: authToken,
      message: "🎉 Account created successfully.",
    });

    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // HTTPS-only cookies (Cloudflare default)
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("🔥 Register error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to register user." },
      { status: 500 }
    );
  }
}
