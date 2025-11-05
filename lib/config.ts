import db from "@/lib/db";

// default base config
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
 * Loads config, optionally overriding base values from DB.settings table.
 * This allows changing system limits at runtime (no redeploy required).
 */
export function loadConfig() {
  const config = JSON.parse(JSON.stringify(BASE_CONFIG)); // deep clone
  try {
    const rows = db.prepare("SELECT key, value FROM settings").all();

    for (const row of rows) {
      const path = row.key.split(".");
      let target: any = config;
      for (let i = 0; i < path.length - 1; i++) {
        if (!(path[i] in target)) target[path[i]] = {};
        target = target[path[i]];
      }

      const finalKey = path[path.length - 1];
      // Try to parse JSON or number
      let val: any = row.value;
      if (/^\d+$/.test(val)) val = parseInt(val);
      else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);
      else if (val === "true" || val === "false") val = val === "true";
      else if (val.startsWith("{") || val.startsWith("[")) {
        try { val = JSON.parse(val); } catch {}
      }

      target[finalKey] = val;
    }
  } catch (err) {
    console.warn("⚠️ Could not load settings overrides:", err);
  }

  return config;
}

// export a single runtime config (cached)
export const CONFIG = loadConfig();
