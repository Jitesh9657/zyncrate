// app/api/user/register/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

type ReqBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Email and password (min 6 chars) required" }, { status: 400 });
    }

    // Check existing
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const auth_token = nanoid(32);

    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, created_at, auth_token)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(email, password_hash, now, auth_token);

    const userId = info.lastInsertRowid;

    return NextResponse.json({
      success: true,
      user: { id: userId, email },
      auth_token,
      message: "Account created — save the auth token to stay logged in.",
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
