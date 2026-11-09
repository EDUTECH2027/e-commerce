import crypto from 'node:crypto'
import { query, queryOne } from './db.js'
import { createCategory } from './lib/categories.js'
import { createUser, listUsers } from './lib/users.js'
import { ensureSchema } from './schema.js'

// [English, French, Arabic]
const DEFAULT_CATEGORIES: [string, string, string][] = [
  ['Televisions', 'Téléviseurs', 'أجهزة التلفاز'],
  ['Refrigerators', 'Réfrigérateurs', 'الثلاجات'],
  ['Kitchen Appliances', 'Électroménager de cuisine', 'أجهزة المطبخ'],
  ['Kitchen Utensils', 'Ustensiles de cuisine', 'أدوات المطبخ'],
  ['Electronics', 'Électronique', 'الإلكترونيات'],
  ['Accessories', 'Accessoires', 'الإكسسوارات'],
  ['Household Equipment', 'Équipement ménager', 'المعدات المنزلية'],
  ['Special Offers', 'Offres spéciales', 'عروض خاصة'],
]

async function bootstrap(): Promise<void> {
  await ensureSchema()

  if ((await listUsers()).length === 0) {
    const email = process.env.ADMIN_EMAIL?.trim() || 'admin@example.com'
    const generated = !process.env.ADMIN_PASSWORD
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
    if ((await createUser(email, password, 'owner')) && generated) {
      console.log('\n──────────────── First-run admin account ────────────────')
      console.log(`  Email:    ${email}`)
      console.log(`  Password: ${password}`)
      console.log('  Shown only once. Sign in at /admin and change it under Settings → Account.')
      console.log('──────────────────────────────────────────────────────────\n')
    }
  }

  const count = (await queryOne<{ n: number }>('SELECT COUNT(*)::int AS n FROM categories'))?.n ?? 0
  if (count === 0) {
    for (const [name, fr, ar] of DEFAULT_CATEGORIES) {
      // Two cold starts can race here; a clash on the unique slug just means the other one won.
      await createCategory({ name, image: null, visible: true, translations: { fr: { name: fr }, ar: { name: ar } } }).catch(() => {})
    }
  } else {
    // Databases created before multi-language support: add French/Arabic names to the untouched starter categories.
    for (const [name, fr, ar] of DEFAULT_CATEGORIES) {
      await query("UPDATE categories SET translations = $1 WHERE name = $2 AND translations = '{}'", [
        JSON.stringify({ fr: { name: fr }, ar: { name: ar } }),
        name,
      ])
    }
  }
}

let ready: Promise<void> | null = null

/** Runs once per server instance: creates tables, the owner account and the starter categories if missing. */
export function ensureReady(): Promise<void> {
  ready ??= bootstrap().catch((err) => {
    ready = null // retry on the next request instead of failing forever
    throw err
  })
  return ready
}
