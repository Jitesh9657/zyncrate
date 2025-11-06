// app/lib/config.ts
import { queryDB } from "@/lib/db";

/**
 * Default base configuration.
 * Used if there are no overrides in the D1 `settings` table.
 */
export const BASE_CONFIG = {
  storage: {
    provider: "r2", // or "local" or "s3"
  },
  limits: {
    guest: { maxUploadSizeMB: 500, maxExpiryHours: 24 },
    userFree: { maxUploadSizeMB: 500, maxExpiryHours: 48 },
    userPro: { maxUploadSizeMB: 2000, maxExpiryHours: 168 }, // 7 days
  },
  cleanup: {
    intervalHours: 12,
  },
};

/**
 * Load configuration overrides dynamically from Cloudflare D1.
 * - Reads `key`, `value` pairs from the `settings` table.
 * - Safely merges overrides into BASE_CONFIG.
 * - Returns the merged config object.
 */
export async function loadConfig(env: any) {
  // Clone base config deeply (Edge-compatible)
  const config = JSON.parse(JSON.stringify(BASE_CONFIG));

  try {
    // 🔹 Query D1 for overrides
    const { results } = await queryDB(env, "SELECT key, value FROM settings");
    if (!results || results.length === 0) {
      return config;
    }

    for (const row of results) {
      const path = row.key.split(".");
      let target: any = config;

      // Traverse nested keys like "limits.userPro.maxUploadSizeMB"
      for (let i = 0; i < path.length - 1; i++) {
        if (!(path[i] in target)) target[path[i]] = {};
        target = target[path[i]];
      }

      const finalKey = path[path.length - 1];
      let val: any = row.value;

      // 🔹 Type conversions
      if (typeof val === "string") {
        if (/^\d+$/.test(val)) val = parseInt(val);
        else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);
        else if (val === "true" || val === "false") val = val === "true";
        else if ((val.startsWith("{") && val.endsWith("}")) || (val.startsWith("[") && val.endsWith("]"))) {
          try {
            val = JSON.parse(val);
          } catch {}
        }
      }

      target[finalKey] = val;
    }

    return config;
  } catch (err) {
    console.warn("⚠️ Failed to load settings from D1 (using defaults):", err);
    return config;
  }
}

/**
 * Helper to get runtime config easily in routes:
 * `const CONFIG = await getConfig(env);`
 */
export async function getConfig(env: any) {
  return await loadConfig(env);
}
