// app/api/user/register/route.ts
import { NextResponse } from "next/server";
import { queryDB, execDB } from "@/lib/db";
import { nanoid } from "nanoid";

export const runtime = "edge"; // ✅ Cloudflare Edge runtime

type ReqBody = {
  email?: string;
  password?: string;
};

// ✅ Edge-safe SHA-256 password hashing
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
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
        { error: "Email and password (min 6 chars) required." },
        { status: 400 }
      );
    }

    // ✅ Check for existing account
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

    // ✅ Hash password and create user
    const password_hash = await hashPassword(password);
    const auth_token = nanoid(32);
    const now = Date.now();

    await execDB(
      env,
      `INSERT INTO users (email, password_hash, created_at, auth_token, plan)
       VALUES (?, ?, ?, ?, 'free')`,
      [email, password_hash, now, auth_token]
    );

    // ✅ Retrieve the inserted user id
    const { results: [newUser] = [] } = await queryDB(
      env,
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    // ✅ Build response with cookie
    const res = NextResponse.json({
      success: true,
      user: { id: newUser?.id, email, plan: "free" },
      auth_token,
      message: "Account created successfully.",
    });

    res.cookies.set("auth_token", auth_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("🔥 Register error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to register." },
      { status: 500 }
    );
  }
}
