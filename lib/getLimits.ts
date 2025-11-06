// app/lib/getLimits.ts
import { BASE_CONFIG, getConfig } from "@/lib/config";

/**
 * 🧠 Get upload/download limits for a given user type and plan.
 * Works with either static BASE_CONFIG (fallback)
 * or dynamic config loaded from Cloudflare D1.
 */
export async function getLimits(env: any, userType: string, plan?: string) {
  try {
    const CONFIG = await getConfig(env); // ✅ load runtime overrides
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
 * Returns hours list filtered by max limit.
 */
export async function getExpiryOptions(env: any, userType: string, plan?: string) {
  const limits = await getLimits(env, userType, plan);
  const allOptions = [1, 6, 12, 24, 48, 168]; // hours
  return allOptions.filter((hrs) => hrs <= limits.maxExpiryHours);
}
