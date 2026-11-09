import type { Category } from '../../shared/types.ts'
import { db } from '../db.ts'
import { slugify, uniqueSlug } from './slug.ts'

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
  SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
  FROM categories c`

export function listCategories(opts: { visibleOnly: boolean }): Category[] {
  const where = opts.visibleOnly ? 'WHERE c.visible = 1' : ''
  return (db.prepare(`${SELECT} ${where} ORDER BY c.sort_order, c.name`).all() as unknown as Row[]).map(map)
}

export function getCategory(id: number): Category | null {
  const r = db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as Row | undefined
  return r ? map(r) : null
}

export function getCategoryBySlug(slug: string): Category | null {
  const r = db.prepare(`${SELECT} WHERE c.slug = ?`).get(slug) as Row | undefined
  return r ? map(r) : null
}

export interface CategoryInput {
  name: string
  image: string | null
  visible: boolean
  translations: Category['translations']
}

export function createCategory(input: CategoryInput): Category {
  const slug = uniqueSlug(slugify(input.name), (s) => !!getCategoryBySlug(s))
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get() as { m: number }
  const res = db
    .prepare('INSERT INTO categories (name, slug, image, visible, sort_order, translations) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.name, slug, input.image, input.visible ? 1 : 0, max.m + 1, JSON.stringify(input.translations))
  return getCategory(Number(res.lastInsertRowid))!
}

export function updateCategory(id: number, input: CategoryInput): Category | null {
  if (!getCategory(id)) return null
  // The slug stays stable so links already shared keep working.
  db.prepare('UPDATE categories SET name = ?, image = ?, visible = ?, translations = ? WHERE id = ?').run(
    input.name,
    input.image,
    input.visible ? 1 : 0,
    JSON.stringify(input.translations),
    id,
  )
  return getCategory(id)
}

export function deleteCategory(id: number): void {
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function countProductsInCategory(id: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id) as { n: number }).n
}
