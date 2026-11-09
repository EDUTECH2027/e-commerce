import type { Product, ProductInput, Spec, StockStatus } from '../../shared/types.js'
import { iso, query, queryOne } from '../db.js'
import { slugify, uniqueSlug } from './slug.js'

interface Row {
  id: number
  slug: string
  name: string
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  category_translations: string | null
  translations: string
  search_text: string
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
  created_at: Date | string
  updated_at: Date | string
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
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
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

export async function listProducts(o: ListOptions): Promise<{ items: Product[]; total: number }> {
  const where: string[] = []
  const params: unknown[] = []
  const bind = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  if (o.publicOnly) where.push(PUBLIC_WHERE)
  if (o.categorySlug) where.push(`c.slug = ${bind(o.categorySlug)}`)
  if (o.categoryId) where.push(`p.category_id = ${bind(o.categoryId)}`)
  if (o.q) {
    // Every word must appear in the name or short description (in any language) or the category name.
    for (const word of o.q.trim().split(/\s+/).slice(0, 6)) {
      const like = bind(`%${escapeLike(word)}%`)
      where.push(
        `(p.name ILIKE ${like} OR p.short_description ILIKE ${like} OR c.name ILIKE ${like} OR p.search_text ILIKE ${like})`,
      )
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
    : o.sort === 'name' ? 'lower(p.name) ASC'
    : 'p.created_at DESC, p.id DESC'

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(o.limit ?? 24, 1), 100)
  const offset = Math.max(o.offset ?? 0, 0)

  const countParams = [...params]
  const [countRow, rows] = await Promise.all([
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`,
      countParams,
    ),
    query<Row>(`${SELECT} ${whereSql} ORDER BY ${order} LIMIT ${bind(limit)} OFFSET ${bind(offset)}`, params),
  ])
  return { items: rows.map(map), total: countRow?.n ?? 0 }
}

export async function getProductById(id: number): Promise<Product | null> {
  const r = await queryOne<Row>(`${SELECT} WHERE p.id = $1`, [id])
  return r ? map(r) : null
}

export async function getPublicProductBySlug(slug: string): Promise<Product | null> {
  const r = await queryOne<Row>(`${SELECT} WHERE p.slug = $1 AND ${PUBLIC_WHERE}`, [slug])
  return r ? map(r) : null
}

export async function relatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const [same, others] = await Promise.all([
    product.categoryId
      ? listProducts({ publicOnly: true, categoryId: product.categoryId, limit: limit + 1 })
      : Promise.resolve({ items: [] as Product[] }),
    listProducts({ publicOnly: true, limit: limit * 2 + 1 }),
  ])
  const picked = same.items.filter((p) => p.id !== product.id).slice(0, limit)
  if (picked.length < limit) {
    const more = others.items.filter((p) => p.id !== product.id && !picked.some((x) => x.id === p.id))
    picked.push(...more.slice(0, limit - picked.length))
  }
  return picked
}

export async function homeSections() {
  const take = async (opts: Partial<ListOptions>) => (await listProducts({ publicOnly: true, limit: 8, ...opts })).items
  const [featured, newArrivals, bestSellers, offers, flexible] = await Promise.all([
    take({ filter: 'featured' }),
    take({ sort: 'newest' }),
    take({ filter: 'bestsellers' }),
    take({ filter: 'offers' }),
    take({ filter: 'flexible' }),
  ])
  return { featured, newArrivals, bestSellers, offers, flexible }
}

/** Names and short descriptions in every language, so French and Arabic searches find English-typed products. */
function searchText(i: ProductInput): string {
  const parts = [i.name, i.shortDescription]
  for (const t of Object.values(i.translations)) parts.push(t?.name ?? '', t?.shortDescription ?? '')
  return parts.filter(Boolean).join(' ')
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
  searchText(i),
]

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = await uniqueSlug(slugify(input.name), async (s) => !!(await queryOne('SELECT 1 FROM products WHERE slug = $1', [s])))
  const row = await queryOne<{ id: number }>(
    `INSERT INTO products (name, category_id, price, promo_price, short_description, description, specs, colors,
       images, stock_status, active, featured, best_seller, flexible_payment, translations, search_text, slug)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
    [...columns(input), slug],
  )
  return (await getProductById(row!.id))!
}

/** The slug is deliberately NOT regenerated on edit, so links already shared in ads keep working. */
export async function updateProduct(id: number, input: ProductInput): Promise<Product | null> {
  const row = await queryOne<{ id: number }>(
    `UPDATE products SET name = $1, category_id = $2, price = $3, promo_price = $4, short_description = $5,
       description = $6, specs = $7, colors = $8, images = $9, stock_status = $10, active = $11, featured = $12,
       best_seller = $13, flexible_payment = $14, translations = $15, search_text = $16, updated_at = now()
     WHERE id = $17 RETURNING id`,
    [...columns(input), id],
  )
  return row ? getProductById(id) : null
}

export async function patchProduct(
  id: number,
  patch: Partial<Pick<ProductInput, 'active' | 'featured' | 'bestSeller' | 'stockStatus'>>,
): Promise<Product | null> {
  const current = await getProductById(id)
  if (!current) return null
  return updateProduct(id, { ...current, ...patch })
}

export async function deleteProduct(id: number): Promise<Product | null> {
  const p = await getProductById(id)
  if (!p) return null
  await query('DELETE FROM products WHERE id = $1', [id])
  return p
}

export async function allPublicSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await query<{ slug: string; updated_at: Date | string }>(
    `SELECT p.slug, p.updated_at FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${PUBLIC_WHERE}`,
  )
  return rows.map((r) => ({ slug: r.slug, updatedAt: iso(r.updated_at) }))
}

export async function productStats() {
  const row = await queryOne<{
    total: number
    active: number
    out: number
    featured: number
    categories: number
  }>(`SELECT
        (SELECT COUNT(*)::int FROM products) AS total,
        (SELECT COUNT(*)::int FROM products WHERE active = 1) AS active,
        (SELECT COUNT(*)::int FROM products WHERE stock_status = 'out_of_stock') AS out,
        (SELECT COUNT(*)::int FROM products WHERE featured = 1) AS featured,
        (SELECT COUNT(*)::int FROM categories) AS categories`)
  return {
    totalProducts: row?.total ?? 0,
    activeProducts: row?.active ?? 0,
    outOfStock: row?.out ?? 0,
    featuredProducts: row?.featured ?? 0,
    totalCategories: row?.categories ?? 0,
  }
}
