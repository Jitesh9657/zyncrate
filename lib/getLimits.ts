// lib/getLimits.ts
import { CONFIG } from "@/lib/config";

export function getLimits(userType: string, plan?: string) {
  if (userType === "guest") return CONFIG.limits.guest;
  if (plan === "pro") return CONFIG.limits.userPro;
  return CONFIG.limits.userFree;
}

// 👇 Added helper: Expiry dropdown options generator
export function getExpiryOptions(userType: string, plan?: string) {
  const limits = getLimits(userType, plan);
  const allOptions = [1, 6, 12, 24, 48, 168]; // 168 = 7 days
  return allOptions.filter((hrs) => hrs <= limits.maxExpiryHours);
}
