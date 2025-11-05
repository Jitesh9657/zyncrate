// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryDB } from "@/lib/db"; // ✅ D1 query helper

export const runtime = "edge"; // ✅ Required for Cloudflare

export async function middleware(req: NextRequest, env: any) {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth_token")?.value;
  const token = authHeader?.replace("Bearer ", "") || cookieToken;
  const requestHeaders = new Headers(req.headers);

  // 👇 Default values
  let userType = "guest";
  let userId: number | null = null;
  let userPlan = "free";
  let guestToken = req.cookies.get("guest_id")?.value;

  // 1️⃣ Logged-in user check
  if (token) {
    try {
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

        requestHeaders.set("x-user-type", "user");
        requestHeaders.set("x-user-id", String(user.id));
        requestHeaders.set("x-user-email", user.email);
        requestHeaders.set("x-user-plan", userPlan);

        return NextResponse.next({
          request: { headers: requestHeaders },
        });
      }

      // 2️⃣ Check if token belongs to a guest
      const { results: guests } = await queryDB(
        env,
        "SELECT id, temp_token FROM guests WHERE temp_token = ?",
        [token]
      );

      const guest = guests?.[0];
      if (guest) {
        requestHeaders.set("x-user-type", "guest");
        requestHeaders.set("x-guest-id", String(guest.id));

        return NextResponse.next({
          request: { headers: requestHeaders },
        });
      }

      // 3️⃣ Invalid token
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    } catch (err) {
      console.error("Middleware auth check failed:", err);
      return NextResponse.json({ error: "Internal auth check error" }, { status: 500 });
    }
  }

  // 4️⃣ Guest session creation if none exists
  if (!guestToken) {
    guestToken = crypto.randomUUID(); // ✅ Web Crypto API
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    await queryDB(
      env,
      `INSERT INTO guests (temp_token, created_at, expires_at, last_activity)
       VALUES (?, ?, ?, ?)`,
      [guestToken, now, expiresAt, now]
    );
  }

  // Set guest info headers
  requestHeaders.set("x-user-type", userType);
  requestHeaders.set("x-user-plan", userPlan);
  requestHeaders.set("x-guest-id", guestToken);

  // Build response and set cookie
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.cookies.set("guest_id", guestToken, {
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
    sameSite: "lax",
  });

  return response;
}

// ✅ Apply to all API routes
export const config = {
  matcher: ["/api/:path*"],
};
