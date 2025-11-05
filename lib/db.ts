// app/lib/db.ts
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// -----------------------------
// 📂 Ensure "data" directory exists
// -----------------------------
const dir = path.resolve("./data");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log("📁 Created data directory:", dir);
}

const dbPath = process.env.SQLITE_FILE || path.join(dir, "files.db");
const db = new Database(dbPath);
console.log("🗄️ Using SQLite DB at:", dbPath);

// -----------------------------
// 🔹 Helper: Auto-add missing columns
// -----------------------------
function ensureColumns(table: string, columns: Record<string, string>) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  for (const [col, def] of Object.entries(columns)) {
    if (!existing.includes(col)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
      console.log(`🧱 Added missing column: ${table}.${col}`);
    }
  }
}

// -----------------------------
// 1️⃣ FILES TABLE
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS files (
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
    guest_session_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`).run();

ensureColumns("files", {
  mime_type: "TEXT",
  path: "TEXT",
  expires_at: "INTEGER",
  one_time: "INTEGER DEFAULT 0",
  is_deleted: "INTEGER DEFAULT 0",
  locked: "INTEGER DEFAULT 0",
  lock_key: "TEXT",
  guest_session_id: "TEXT",
  user_id: "INTEGER",
});

// -----------------------------
// 2️⃣ USERS TABLE
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at INTEGER,
    is_verified INTEGER DEFAULT 0,
    plan TEXT DEFAULT 'free',
    plan_expiry INTEGER,
    storage_limit INTEGER DEFAULT 104857600, -- 100MB
    used_storage INTEGER DEFAULT 0,
    max_file_size INTEGER DEFAULT 52428800,  -- 50MB default
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    auth_token TEXT,
    last_login INTEGER
  )
`).run();

ensureColumns("users", {
  plan: "TEXT DEFAULT 'free'",
  plan_expiry: "INTEGER",
  storage_limit: "INTEGER DEFAULT 104857600",
  used_storage: "INTEGER DEFAULT 0",
  max_file_size: "INTEGER DEFAULT 52428800",
});

// -----------------------------
// 3️⃣ PLANS TABLE
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    max_storage INTEGER,
    max_file_size INTEGER,
    max_downloads INTEGER,
    price REAL,
    duration_days INTEGER
  )
`).run();

ensureColumns("plans", {
  description: "TEXT",
});

// -----------------------------
// 4️⃣ GUESTS TABLE (Anonymous users)
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temp_token TEXT UNIQUE,
    created_at INTEGER,
    expires_at INTEGER,
    last_activity INTEGER,
    ip_address TEXT,
    user_agent TEXT
  )
`).run();

ensureColumns("guests", {
  last_activity: "INTEGER",
  ip_address: "TEXT",
  user_agent: "TEXT",
});

// -----------------------------
// 5️⃣ ANALYTICS TABLE
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    file_key TEXT,
    user_id INTEGER,
    guest_session_id TEXT,
    action TEXT,
    timestamp INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(file_id) REFERENCES files(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`).run();

ensureColumns("analytics", {
  file_key: "TEXT",
});

// -----------------------------
// 6️⃣ SETTINGS TABLE
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

// -----------------------------
// 7️⃣ SESSIONS TABLE (for auth tokens)
// -----------------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE,
    created_at INTEGER,
    expires_at INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`).run();

// -----------------------------
// 8️⃣ INDEXES (Performance boost)
// -----------------------------
db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_key ON files(key)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_file_id ON analytics(file_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_guests_temp_token ON guests(temp_token)`).run();

export default db;
