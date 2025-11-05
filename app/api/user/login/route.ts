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

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Find user
    const user = db
      .prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .get(email);

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    // Verify password
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Generate new auth token for session
    const auth_token = nanoid(32);
    db.prepare("UPDATE users SET auth_token = ? WHERE id = ?").run(auth_token, user.id);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email },
      auth_token,
      message: "Login successful — use this token to stay logged in.",
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
