import type { Category } from '../../shared/types.js'
import { query, queryOne } from '../db.js'
import { slugify, uniqueSlug } from './slug.js'

interface Row {
  id: number
  name: string
  slug: string
  image: string | null
  visible: number
  sort_order: number
  translations: string
  product_count?: number
}

function map(r: Row): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    image: r.image,
    visible: !!r.visible,
    sortOrder: r.sort_order,
    translations: JSON.parse(r.translations) as Category['translations'],
    ...(r.product_count !== undefined ? { productCount: r.product_count } : {}),
  }
}

const SELECT = `
  SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
  FROM categories c`

export async function listCategories(opts: { visibleOnly: boolean }): Promise<Category[]> {
  const where = opts.visibleOnly ? 'WHERE c.visible = 1' : ''
  return (await query<Row>(`${SELECT} ${where} ORDER BY c.sort_order, c.name`)).map(map)
}

export async function getCategory(id: number): Promise<Category | null> {
  const r = await queryOne<Row>(`${SELECT} WHERE c.id = $1`, [id])
  return r ? map(r) : null
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const r = await queryOne<Row>(`${SELECT} WHERE c.slug = $1`, [slug])
  return r ? map(r) : null
}

export interface CategoryInput {
  name: string
  image: string | null
  visible: boolean
  translations: Category['translations']
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const slug = await uniqueSlug(slugify(input.name), async (s) => !!(await getCategoryBySlug(s)))
  const max = await queryOne<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM categories')
  const row = await queryOne<{ id: number }>(
    `INSERT INTO categories (name, slug, image, visible, sort_order, translations)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.name, slug, input.image, input.visible ? 1 : 0, (max?.m ?? 0) + 1, JSON.stringify(input.translations)],
  )
  return (await getCategory(row!.id))!
}

export async function updateCategory(id: number, input: CategoryInput): Promise<Category | null> {
  if (!(await getCategory(id))) return null
  // The slug stays stable so links already shared keep working.
  await query('UPDATE categories SET name = $1, image = $2, visible = $3, translations = $4 WHERE id = $5', [
    input.name,
    input.image,
    input.visible ? 1 : 0,
    JSON.stringify(input.translations),
    id,
  ])
  return getCategory(id)
}

export async function deleteCategory(id: number): Promise<void> {
  await query('DELETE FROM categories WHERE id = $1', [id])
}

export async function countProductsInCategory(id: number): Promise<number> {
  return (await queryOne<{ n: number }>('SELECT COUNT(*)::int AS n FROM products WHERE category_id = $1', [id]))?.n ?? 0
}
