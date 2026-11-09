import { query } from './db.js'

const SCHEMA_VERSION = '1'

/** Every statement is idempotent (IF NOT EXISTS) so concurrent cold starts cannot clash. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,

  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     email TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email))`,

  `CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)`,

  `CREATE TABLE IF NOT EXISTS categories (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     slug TEXT NOT NULL UNIQUE,
     image TEXT,
     visible INT NOT NULL DEFAULT 1,
     sort_order INT NOT NULL DEFAULT 0,
     translations TEXT NOT NULL DEFAULT '{}',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS products (
     id SERIAL PRIMARY KEY,
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     category_id INT REFERENCES categories(id) ON DELETE SET NULL,
     price INT NOT NULL,
     promo_price INT,
     short_description TEXT NOT NULL DEFAULT '',
     description TEXT NOT NULL DEFAULT '',
     specs TEXT NOT NULL DEFAULT '[]',
     colors TEXT NOT NULL DEFAULT '[]',
     images TEXT NOT NULL DEFAULT '[]',
     stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock','low_stock','out_of_stock')),
     active INT NOT NULL DEFAULT 1,
     featured INT NOT NULL DEFAULT 0,
     best_seller INT NOT NULL DEFAULT 0,
     flexible_payment INT NOT NULL DEFAULT 1,
     translations TEXT NOT NULL DEFAULT '{}',
     search_text TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at)`,

  // "Order on WhatsApp" clicks, so the owner can see what converts (no personal data).
  `CREATE TABLE IF NOT EXISTS whatsapp_clicks (
     id SERIAL PRIMARY KEY,
     product_id INT REFERENCES products(id) ON DELETE SET NULL,
     action TEXT NOT NULL,
     utm_source TEXT,
     utm_medium TEXT,
     utm_campaign TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_clicks_created ON whatsapp_clicks(created_at)`,

  // Sign-in throttling that works across serverless instances (an in-memory counter would not).
  `CREATE TABLE IF NOT EXISTS login_attempts (
     id SERIAL PRIMARY KEY,
     key TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(key, created_at)`,
]

async function isCurrent(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }>(`SELECT value FROM kv WHERE key = 'schema_version'`)
    return rows[0]?.value === SCHEMA_VERSION
  } catch {
    return false // the kv table does not exist yet
  }
}

/** Creates the tables on first run. On later cold starts this is a single cheap query. */
export async function ensureSchema(): Promise<void> {
  if (await isCurrent()) return
  for (const sql of STATEMENTS) await query(sql)
  await query(
    `INSERT INTO kv (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SCHEMA_VERSION],
  )
}
