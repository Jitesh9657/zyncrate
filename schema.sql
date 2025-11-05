-- ========== FILES TABLE ==========
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
);

-- ========== USERS TABLE ==========
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password_hash TEXT,
  provider TEXT DEFAULT 'local',
  provider_id TEXT,
  created_at INTEGER,
  is_verified INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'free',
  plan_expiry INTEGER,
  storage_limit INTEGER DEFAULT 104857600,
  used_storage INTEGER DEFAULT 0,
  max_file_size INTEGER DEFAULT 52428800,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  auth_token TEXT,
  last_login INTEGER
);

-- ========== PLANS TABLE ==========
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  description TEXT,
  max_storage INTEGER,
  max_file_size INTEGER,
  max_downloads INTEGER,
  price REAL,
  duration_days INTEGER
);

-- ========== GUESTS TABLE ==========
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temp_token TEXT UNIQUE,
  created_at INTEGER,
  expires_at INTEGER,
  last_activity INTEGER,
  ip_address TEXT,
  user_agent TEXT
);

-- ========== ANALYTICS TABLE ==========
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
);

-- ========== SETTINGS TABLE ==========
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ========== SESSIONS TABLE ==========
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  token TEXT UNIQUE,
  created_at INTEGER,
  expires_at INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_key ON files(key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_analytics_file_id ON analytics(file_id);
CREATE INDEX IF NOT EXISTS idx_guests_temp_token ON guests(temp_token);
