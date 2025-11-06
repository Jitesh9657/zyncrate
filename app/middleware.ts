// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryDB, execDB } from "@/lib/db"; // ✅ Use execDB for inserts

export const runtime = "edge"; // ✅ Cloudflare Pages / Workers compatible

export async function middleware(req: NextRequest, env: any) {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth_token")?.value;
  const token = authHeader?.replace("Bearer ", "") || cookieToken;
  const requestHeaders = new Headers(req.headers);

  // Default user context
  let userType = "guest";
  let userId: number | null = null;
  let userPlan = "free";
  let guestToken = req.cookies.get("guest_id")?.value;

  try {
    // 1️⃣ Check for logged-in user via auth token
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

      // 3️⃣ Invalid token → reject
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    // 4️⃣ If no token, create new guest session
    if (!guestToken) {
      guestToken = crypto.randomUUID(); // ✅ Edge-safe random ID
      const now = Date.now();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

      await execDB(
        env,
        `INSERT INTO guests (temp_token, created_at, expires_at, last_activity)
         VALUES (?, ?, ?, ?)`,
        [guestToken, now, expiresAt, now]
      );
    }

    // ✅ Set headers for guest or user
    requestHeaders.set("x-user-type", userType);
    requestHeaders.set("x-user-plan", userPlan);
    requestHeaders.set("x-guest-id", guestToken);

    // ✅ Continue request flow
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // ✅ Set cookie for persistent guest sessions
    response.cookies.set("guest_id", guestToken, {
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("🔥 Middleware auth error:", err);
    return NextResponse.json(
      { error: "Authentication middleware failed." },
      { status: 500 }
    );
  }
}

// ✅ Apply to all API routes
export const config = {
  matcher: ["/api/:path*"],
};
