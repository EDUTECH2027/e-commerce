/**
 * One-off: copies a catalogue created with the old SQLite version (data/store.db + data/uploads) into the current
 * PostgreSQL database, and uploads its images to the current image storage.
 *
 *   Local:   npm run migrate:sqlite
 *   Vercel:  pull the production environment first (so DATABASE_URL and BLOB_READ_WRITE_TOKEN are set), then run it:
 *            npx vercel env pull .env.production.local
 *            node --env-file=.env.production.local server/migrate-sqlite.ts
 *
 * It refuses to run if the target already has products. Admin accounts are NOT copied (the live site creates
 * its own owner from ADMIN_EMAIL / ADMIN_PASSWORD).
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DATA_DIR } from './config.js'
import { query, queryOne } from './db.js'
import { store } from './lib/images.js'
import { ensureSchema } from './schema.js'

const sqlitePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(DATA_DIR, 'store.db')
if (!fs.existsSync(sqlitePath)) {
  console.error(`No SQLite database found at ${sqlitePath}. Nothing to migrate.`)
  process.exit(1)
}
const uploadsDir = path.join(path.dirname(sqlitePath), 'uploads')
const src = new DatabaseSync(sqlitePath, { readOnly: true })
type Row = Record<string, string | number | null>
const all = (sql: string) => src.prepare(sql).all() as Row[]

await ensureSchema()
const existing = (await queryOne<{ n: number }>('SELECT COUNT(*)::int AS n FROM products'))?.n ?? 0
if (existing > 0) {
  console.error(`The target database already has ${existing} products. Refusing to merge; aborting.`)
  process.exit(1)
}

const urlMap = new Map<string, string>()
async function moveImage(url: string | null): Promise<string | null> {
  if (!url) return null
  const m = /^\/uploads\/([a-f0-9]{24})\.webp$/.exec(url)
  if (!m) return url // already a remote URL
  const done = urlMap.get(url)
  if (done) return done
  const id = m[1]
  const files: [string, string][] = [[`${id}.webp`, 'image/webp'], [`${id}-sm.webp`, 'image/webp'], [`${id}-og.jpg`, 'image/jpeg']]
  let main = url
  for (const [name, type] of files) {
    const file = path.join(uploadsDir, name)
    if (!fs.existsSync(file)) {
      console.warn(`  missing file ${name} (skipped)`)
      continue
    }
    const stored = await store(name, fs.readFileSync(file), type)
    if (name === `${id}.webp`) main = stored
  }
  urlMap.set(url, main)
  return main
}

const sqliteTime = (v: string | number | null) => String(v ?? '').replace(' ', 'T') + 'Z'

// Categories (the starter ones the new database created are replaced by the real ones, ids preserved).
await query('DELETE FROM categories')
const categories = all('SELECT * FROM categories ORDER BY id')
for (const c of categories) {
  await query(
    `INSERT INTO categories (id, name, slug, image, visible, sort_order, translations, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
    [c.id, c.name, c.slug, await moveImage(c.image as string | null), c.visible, c.sort_order, c.translations ?? '{}', sqliteTime(c.created_at)],
  )
}

const products = all('SELECT * FROM products ORDER BY id')
for (const p of products) {
  const images = JSON.parse(String(p.images)) as string[]
  const moved: string[] = []
  for (const u of images) moved.push((await moveImage(u)) as string)
  const tr = JSON.parse(String(p.translations ?? '{}')) as Record<string, { name?: string; shortDescription?: string } | undefined>
  const searchText = [p.name, p.short_description, ...Object.values(tr).flatMap((t) => [t?.name, t?.shortDescription])].filter(Boolean).join(' ')
  await query(
    `INSERT INTO products (id, slug, name, category_id, price, promo_price, short_description, description, specs, colors,
       images, stock_status, active, featured, best_seller, flexible_payment, translations, search_text, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::timestamptz,$20::timestamptz)`,
    [p.id, p.slug, p.name, p.category_id, p.price, p.promo_price, p.short_description, p.description, p.specs, p.colors,
     JSON.stringify(moved), p.stock_status, p.active, p.featured, p.best_seller, p.flexible_payment, p.translations ?? '{}',
     searchText, sqliteTime(p.created_at), sqliteTime(p.updated_at)],
  )
}

// Store settings (move the logo too).
const settingsRow = all('SELECT data FROM settings WHERE id = 1')[0]
if (settingsRow) {
  const settings = JSON.parse(String(settingsRow.data)) as Record<string, unknown>
  if (typeof settings.logoUrl === 'string' && settings.logoUrl) settings.logoUrl = await moveImage(settings.logoUrl)
  await query(`INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [JSON.stringify(settings)])
}

// New rows must not reuse the ids we just inserted.
for (const table of ['categories', 'products']) {
  await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${table}), 1))`)
}

console.log(`Migrated ${categories.length} categories, ${products.length} products, ${urlMap.size} images${settingsRow ? ' and the store settings' : ''}.`)
process.exit(0)
