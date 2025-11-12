import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryDB, execDB } from "@/lib/db";

export const runtime = "edge"; // ✅ Cloudflare Pages / Workers compatible

export async function middleware(req: NextRequest, env: any) {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth_token")?.value;
  const token = authHeader?.replace("Bearer ", "") || cookieToken;

  // Clone headers (Edge immutable by default)
  const headers = new Headers(req.headers);

  let userType = "guest";
  let userId: number | null = null;
  let userPlan = "free";
  let guestToken = req.cookies.get("guest_id")?.value;

  try {
    // 1️⃣ Check for authenticated user
    if (token) {
      const { results: users } = await queryDB(
        env,
        "SELECT id, email, plan FROM users WHERE auth_token = ?",
        [token]
      );

      const user = users?.[0];
      if (user) {
        userType = "user";
        userId = user.id;
        userPlan = user.plan || "free";

        headers.set("x-user-type", "user");
        headers.set("x-user-id", String(user.id));
        headers.set("x-user-email", user.email);
        headers.set("x-user-plan", userPlan);

        return NextResponse.next({ request: { headers } });
      }

      // 2️⃣ If not a user, check if it's a guest token
      const { results: guests } = await queryDB(
        env,
        "SELECT id, temp_token FROM guests WHERE temp_token = ?",
        [token]
      );

      const guest = guests?.[0];
      if (guest) {
        headers.set("x-user-type", "guest");
        headers.set("x-guest-id", String(guest.id));

        return NextResponse.next({ request: { headers } });
      }

      // 3️⃣ Invalid token
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    // 4️⃣ Handle guest sessions
    if (!guestToken) {
      guestToken = crypto.randomUUID(); // ✅ Edge-safe random ID
      const now = Date.now();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

      await execDB(
        env,
        `
        INSERT INTO guests (temp_token, created_at, expires_at, last_activity)
        VALUES (?, ?, ?, ?)
      `,
        [guestToken, now, expiresAt, now]
      );
    }

    // ✅ Set guest headers
    headers.set("x-user-type", userType);
    headers.set("x-user-plan", userPlan);
    headers.set("x-guest-id", guestToken);

    const response = NextResponse.next({ request: { headers } });

    // ✅ Persist guest_id cookie
    response.cookies.set("guest_id", guestToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // HTTPS-only
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error("🔥 Middleware auth error:", err);
    return NextResponse.json(
      { error: err.message || "Authentication middleware failed." },
      { status: 500 }
    );
  }
}

// ✅ Apply to all API routes
export const config = {
  matcher: ["/api/:path*"],
};
