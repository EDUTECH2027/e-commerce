import type { Product, ProductInput, Spec, StockStatus } from '../../shared/types.ts'
import { db } from '../db.ts'
import { slugify, uniqueSlug } from './slug.ts'

interface Row {
  id: number
  slug: string
  name: string
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  category_translations: string | null
  translations: string
  price: number
  promo_price: number | null
  short_description: string
  description: string
  specs: string
  colors: string
  images: string
  stock_status: StockStatus
  active: number
  featured: number
  best_seller: number
  flexible_payment: number
  created_at: string
  updated_at: string
}

function map(r: Row): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    categoryTranslations: JSON.parse(r.category_translations ?? '{}') as Product['categoryTranslations'],
    translations: JSON.parse(r.translations) as Product['translations'],
    price: r.price,
    promoPrice: r.promo_price,
    shortDescription: r.short_description,
    description: r.description,
    specs: JSON.parse(r.specs) as Spec[],
    colors: JSON.parse(r.colors) as string[],
    images: JSON.parse(r.images) as string[],
    stockStatus: r.stock_status,
    active: !!r.active,
    featured: !!r.featured,
    bestSeller: !!r.best_seller,
    flexiblePayment: !!r.flexible_payment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.translations AS category_translations
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`

/** Storefront rule: only active products whose category (if any) is visible. */
const PUBLIC_WHERE = 'p.active = 1 AND (c.id IS NULL OR c.visible = 1)'

const OFFER_WHERE = 'p.promo_price IS NOT NULL AND p.promo_price < p.price'

export interface ListOptions {
  publicOnly: boolean
  q?: string
  categorySlug?: string
  categoryId?: number
  filter?: 'featured' | 'offers' | 'flexible' | 'bestsellers'
  status?: 'active' | 'inactive' | 'out_of_stock' | 'featured'
  inStockOnly?: boolean
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name'
  limit?: number
  offset?: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m)

export function listProducts(o: ListOptions): { items: Product[]; total: number } {
  const where: string[] = []
  const params: (string | number)[] = []

  if (o.publicOnly) where.push(PUBLIC_WHERE)
  if (o.categorySlug) {
    where.push('c.slug = ?')
    params.push(o.categorySlug)
  }
  if (o.categoryId) {
    where.push('p.category_id = ?')
    params.push(o.categoryId)
  }
  if (o.q) {
    for (const word of o.q.trim().split(/\s+/).slice(0, 6)) {
      const like = `%${escapeLike(word)}%`
      where.push(
        "(p.name LIKE ? ESCAPE '\\' OR p.short_description LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')",
      )
      params.push(like, like, like)
    }
  }
  if (o.filter === 'featured') where.push('p.featured = 1')
  else if (o.filter === 'offers') where.push(OFFER_WHERE)
  else if (o.filter === 'flexible') where.push('p.flexible_payment = 1')
  else if (o.filter === 'bestsellers') where.push('p.best_seller = 1')

  if (o.status === 'active') where.push('p.active = 1')
  else if (o.status === 'inactive') where.push('p.active = 0')
  else if (o.status === 'out_of_stock') where.push("p.stock_status = 'out_of_stock'")
  else if (o.status === 'featured') where.push('p.featured = 1')

  if (o.inStockOnly) where.push("p.stock_status != 'out_of_stock'")

  const effective = 'COALESCE(CASE WHEN p.promo_price < p.price THEN p.promo_price END, p.price)'
  const order =
    o.sort === 'price_asc' ? `${effective} ASC, p.id DESC`
    : o.sort === 'price_desc' ? `${effective} DESC, p.id DESC`
    : o.sort === 'name' ? 'p.name COLLATE NOCASE ASC'
    : 'p.created_at DESC, p.id DESC'

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`)
      .get(...params) as { n: number }
  ).n
  const limit = Math.min(Math.max(o.limit ?? 24, 1), 100)
  const offset = Math.max(o.offset ?? 0, 0)
  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as unknown as Row[]
  return { items: rows.map(map), total }
}

export function getProductById(id: number): Product | null {
  const r = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined
  return r ? map(r) : null
}

export function getPublicProductBySlug(slug: string): Product | null {
  const r = db.prepare(`${SELECT} WHERE p.slug = ? AND ${PUBLIC_WHERE}`).get(slug) as Row | undefined
  return r ? map(r) : null
}

export function relatedProducts(product: Product, limit = 4): Product[] {
  const same = product.categoryId
    ? listProducts({ publicOnly: true, categoryId: product.categoryId, limit: limit + 1 }).items
    : []
  const picked = same.filter((p) => p.id !== product.id).slice(0, limit)
  if (picked.length < limit) {
    const more = listProducts({ publicOnly: true, limit: limit * 2 + 1 }).items.filter(
      (p) => p.id !== product.id && !picked.some((x) => x.id === p.id),
    )
    picked.push(...more.slice(0, limit - picked.length))
  }
  return picked
}

export function homeSections() {
  const take = (opts: Partial<ListOptions>) => listProducts({ publicOnly: true, limit: 8, ...opts }).items
  return {
    featured: take({ filter: 'featured' }),
    newArrivals: take({ sort: 'newest' }),
    bestSellers: take({ filter: 'bestsellers' }),
    offers: take({ filter: 'offers' }),
    flexible: take({ filter: 'flexible' }),
  }
}

const columns = (i: ProductInput) => [
  i.name,
  i.categoryId,
  i.price,
  i.promoPrice,
  i.shortDescription,
  i.description,
  JSON.stringify(i.specs),
  JSON.stringify(i.colors),
  JSON.stringify(i.images),
  i.stockStatus,
  i.active ? 1 : 0,
  i.featured ? 1 : 0,
  i.bestSeller ? 1 : 0,
  i.flexiblePayment ? 1 : 0,
  JSON.stringify(i.translations),
]

export function createProduct(input: ProductInput): Product {
  const slug = uniqueSlug(slugify(input.name), (s) => !!db.prepare('SELECT 1 FROM products WHERE slug = ?').get(s))
  const res = db
    .prepare(
      `INSERT INTO products (name, category_id, price, promo_price, short_description, description, specs, colors,
         images, stock_status, active, featured, best_seller, flexible_payment, translations, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(...columns(input), slug)
  return getProductById(Number(res.lastInsertRowid))!
}

/** The slug is deliberately NOT regenerated on edit, so links already shared in ads keep working. */
export function updateProduct(id: number, input: ProductInput): Product | null {
  const res = db
    .prepare(
      `UPDATE products SET name = ?, category_id = ?, price = ?, promo_price = ?, short_description = ?,
         description = ?, specs = ?, colors = ?, images = ?, stock_status = ?, active = ?, featured = ?,
         best_seller = ?, flexible_payment = ?, translations = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(...columns(input), id)
  return res.changes ? getProductById(id) : null
}

export function patchProduct(
  id: number,
  patch: Partial<Pick<ProductInput, 'active' | 'featured' | 'bestSeller' | 'stockStatus'>>,
): Product | null {
  const current = getProductById(id)
  if (!current) return null
  return updateProduct(id, { ...current, ...patch })
}

export function deleteProduct(id: number): Product | null {
  const p = getProductById(id)
  if (!p) return null
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
  return p
}

export function allPublicSlugs(): { slug: string; updatedAt: string }[] {
  const rows = db
    .prepare(
      `SELECT p.slug, p.updated_at FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${PUBLIC_WHERE}`,
    )
    .all() as unknown as { slug: string; updated_at: string }[]
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }))
}

export function productStats() {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n
  return {
    totalProducts: one('SELECT COUNT(*) AS n FROM products'),
    activeProducts: one('SELECT COUNT(*) AS n FROM products WHERE active = 1'),
    outOfStock: one("SELECT COUNT(*) AS n FROM products WHERE stock_status = 'out_of_stock'"),
    featuredProducts: one('SELECT COUNT(*) AS n FROM products WHERE featured = 1'),
    totalCategories: one('SELECT COUNT(*) AS n FROM categories'),
  }
}
