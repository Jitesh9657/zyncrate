// app/lib/db.ts

/**
 * ✅ Universal D1 Database Helper for Cloudflare.
 * Handles SELECT, INSERT, UPDATE, and DELETE safely across Edge environments.
 * 
 * Use queryDB() for SELECT → returns { results, success }
 * Use execDB() for INSERT / UPDATE / DELETE → returns { success }
 */

export async function queryDB(
  env: any,
  query: string,
  params: any[] = []
): Promise<{ results: any[]; success: boolean }> {
  try {
    if (!env?.DB) {
      throw new Error(
        "⚠️ Missing D1 binding — ensure `DB` is defined in wrangler.toml and Cloudflare project settings."
      );
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
 * ⚙️ Execute non-SELECT statements (INSERT, UPDATE, DELETE)
 */
export async function execDB(
  env: any,
  query: string,
  params: any[] = []
): Promise<{ success: boolean; meta?: any }> {
  try {
    if (!env?.DB) {
      throw new Error(
        "⚠️ Missing D1 binding — ensure `DB` is defined in wrangler.toml and Cloudflare project settings."
      );
    }

    const stmt = env.DB.prepare(query).bind(...params);
    const result = await stmt.run();

    return { success: true, meta: result };
  } catch (err) {
    console.error("❌ D1 exec error:", err, "\nQuery:", query, "\nParams:", params);
    return { success: false };
  }
}

/**
 * 🧱 Helper: Get file metadata by unique key.
 */
export async function getFileByKey(env: any, key: string) {
  const { results } = await queryDB(env, "SELECT * FROM files WHERE key = ?", [key]);
  return results?.[0] || null;
}

/**
 * 🧩 Helper: Initialize default tables if needed (optional for dev or bootstrap).
 * Run this once in your setup phase (not during build).
 */
export async function ensureTables(env: any) {
  try {
    console.log("🔍 Ensuring D1 tables...");
    await execDB(
      env,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`
    );

    await execDB(
      env,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        auth_token TEXT,
        plan TEXT DEFAULT 'free',
        created_at INTEGER
      )`
    );

    await execDB(
      env,
      `CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temp_token TEXT UNIQUE,
        created_at INTEGER,
        expires_at INTEGER,
        last_activity INTEGER,
        ip_address TEXT,
        user_agent TEXT
      )`
    );

    await execDB(
      env,
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        path TEXT,
        created_at INTEGER,
        expires_at INTEGER,
        download_count INTEGER DEFAULT 0,
        max_downloads INTEGER DEFAULT 5,
        one_time INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        locked INTEGER DEFAULT 0,
        lock_key TEXT,
        user_id INTEGER,
        guest_session_id TEXT
      )`
    );

    await execDB(
      env,
      `CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER,
        file_key TEXT,
        user_id INTEGER,
        guest_session_id TEXT,
        action TEXT,
        timestamp INTEGER,
        ip_address TEXT,
        user_agent TEXT
      )`
    );

    console.log("✅ D1 tables verified / created successfully.");
  } catch (err) {
    console.error("⚠️ Failed to ensure D1 tables:", err);
  }
}
