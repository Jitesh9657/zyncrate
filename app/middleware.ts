import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import db from "@/lib/db";
import crypto from "crypto";

export async function middleware(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth_token")?.value;
  const token = authHeader?.replace("Bearer ", "") || cookieToken;
  const requestHeaders = new Headers(req.headers);

  // 👇 Default: assume guest
  let userType = "guest";
  let userId: number | null = null;
  let userPlan = "free";
  let guestToken = req.cookies.get("guest_id")?.value;

  // 1️⃣ Check if a logged-in user
  if (token) {
    const user = db
      .prepare("SELECT id, email, plan FROM users WHERE auth_token = ?")
      .get(token);

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

    // 2️⃣ Check if it's a valid guest token
    const guest = db
      .prepare("SELECT id, temp_token FROM guests WHERE temp_token = ?")
      .get(token);

    if (guest) {
      userType = "guest";
      requestHeaders.set("x-user-type", "guest");
      requestHeaders.set("x-guest-id", String(guest.id));

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    // 3️⃣ If token is invalid, reject
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 4️⃣ No token → create or reuse guest session
  if (!guestToken) {
    guestToken = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO guests (temp_token, created_at, expires_at, last_activity)
       VALUES (?, ?, ?, ?)`
    ).run(guestToken, now, now + 7 * 24 * 60 * 60 * 1000, now);
  }

  requestHeaders.set("x-user-type", userType);
  requestHeaders.set("x-user-plan", userPlan);
  requestHeaders.set("x-guest-id", guestToken);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set guest_id cookie for future API requests
  response.cookies.set("guest_id", guestToken, {
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return response;
}

export const config = {
  matcher: ["/api/:path*"], // applies to all API routes
};
