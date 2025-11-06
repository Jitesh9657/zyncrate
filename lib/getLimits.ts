// app/lib/getLimits.ts
import { BASE_CONFIG, getConfig } from "@/lib/config";

/**
 * 🧠 Get upload/download limits for a given user type and plan.
 * Supports both static frontend (no env) and dynamic D1 backend.
 */
export async function getLimits(envOrUserType: any, maybeUserType?: string, maybePlan?: string) {
  // ✅ Detect whether this is frontend (no env)
  const isFrontendCall = typeof envOrUserType === "string";
  const userType = isFrontendCall ? envOrUserType : maybeUserType || "guest";
  const plan = isFrontendCall ? maybeUserType : maybePlan;

  if (isFrontendCall) {
    // Static config fallback for client
    if (userType === "guest") return BASE_CONFIG.limits.guest;
    if (plan === "pro") return BASE_CONFIG.limits.userPro;
    return BASE_CONFIG.limits.userFree;
  }

  // Backend (Cloudflare D1) path
  const env = envOrUserType;
  try {
    const CONFIG = await getConfig(env);
    if (userType === "guest") return CONFIG.limits.guest;
    if (plan === "pro") return CONFIG.limits.userPro;
    return CONFIG.limits.userFree;
  } catch (err) {
    console.warn("⚠️ Failed to load runtime config, using BASE_CONFIG:", err);
    if (userType === "guest") return BASE_CONFIG.limits.guest;
    if (plan === "pro") return BASE_CONFIG.limits.userPro;
    return BASE_CONFIG.limits.userFree;
  }
}

/**
 * ⏳ Generate expiry dropdown options dynamically.
 */
export async function getExpiryOptions(envOrUserType: any, maybeUserType?: string, maybePlan?: string) {
  const limits = await getLimits(envOrUserType, maybeUserType, maybePlan);
  const allOptions = [1, 6, 12, 24, 48, 168]; // hours
  return allOptions.filter((hrs) => hrs <= limits.maxExpiryHours);
}
