import crypto from 'node:crypto'
import { db } from './db.ts'
import { createCategory } from './lib/categories.ts'
import { createUser, listUsers } from './lib/users.ts'

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

/** First-run setup: owner account and the starter categories. Idempotent. */
export function bootstrap(): void {
  if (listUsers().length === 0) {
    const email = process.env.ADMIN_EMAIL?.trim() || 'admin@example.com'
    const generated = !process.env.ADMIN_PASSWORD
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
    createUser(email, password, 'owner')
    console.log('\n──────────────── First-run admin account ────────────────')
    console.log(`  Email:    ${email}`)
    console.log(`  Password: ${generated ? password : '(from ADMIN_PASSWORD)'}`)
    if (generated) console.log('  Shown only once. Sign in at /admin and change it under Settings → Account.')
    console.log('──────────────────────────────────────────────────────────\n')
  }

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
  if (n === 0) {
    for (const [name, fr, ar] of DEFAULT_CATEGORIES) {
      createCategory({ name, image: null, visible: true, translations: { fr: { name: fr }, ar: { name: ar } } })
    }
  } else {
    // Databases created before multi-language support: add French/Arabic names to the untouched starter categories.
    const fill = db.prepare("UPDATE categories SET translations = ? WHERE name = ? AND translations = '{}'")
    for (const [name, fr, ar] of DEFAULT_CATEGORIES) fill.run(JSON.stringify({ fr: { name: fr }, ar: { name: ar } }), name)
  }
}
