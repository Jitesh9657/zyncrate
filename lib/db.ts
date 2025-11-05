// app/lib/db.ts

/**
 * Universal D1 query helper for Cloudflare.
 * Works in API routes, middleware, and edge functions.
 * Returns consistent { results, success } objects.
 */

export async function queryDB(
  env: any,
  query: string,
  params: any[] = []
): Promise<{ results: any[]; success: boolean }> {
  try {
    if (!env.DB) {
      throw new Error("⚠️ D1 binding 'DB' not found. Make sure it's defined in your wrangler.toml or Cloudflare project settings.");
    }

    const stmt = env.DB.prepare(query).bind(...params);
    const result = await stmt.all();

    return {
      results: result?.results || [],
      success: true,
    };
  } catch (err) {
    console.error("❌ D1 query error:", err, "\nQuery:", query, "\nParams:", params);
    return { results: [], success: false };
  }
}

/**
 * Get file metadata by unique key
 */
export async function getFileByKey(env: any, key: string) {
  const { results } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [key]);
  return results?.[0] || null;
}

/**
 * Insert or update helper — for future expansions (upload, guest, cleanup, etc.)
 */
export async function execDB(env: any, query: string, params: any[] = []) {
  try {
    const stmt = env.DB.prepare(query).bind(...params);
    await stmt.run();
    return { success: true };
  } catch (err) {
    console.error("❌ D1 exec error:", err, "\nQuery:", query, "\nParams:", params);
    return { success: false };
  }
}
