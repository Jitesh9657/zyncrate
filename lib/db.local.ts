// app/lib/db.ts
let db: any;

if (process.env.CF_PAGES || process.env.CF_PAGES_URL) {
  // Running on Cloudflare Pages (D1)
  db = (globalThis as any).DB;
  console.log("⚡ Using Cloudflare D1 Database");
} else {
  // Local fallback using better-sqlite3
  const Database = require("better-sqlite3");
  const fs = require("fs");
  const path = require("path");

  const dir = path.resolve("./data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const dbPath = process.env.SQLITE_FILE || path.join(dir, "files.db");
  db = new Database(dbPath);
  console.log("🗄️ Using Local SQLite DB:", dbPath);
}

export default db;
