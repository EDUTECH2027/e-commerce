import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { db } from '../db.ts'
import { listCategories } from '../lib/categories.ts'
import {
  getPublicProductBySlug,
  homeSections,
  listProducts,
  relatedProducts,
  type ListOptions,
} from '../lib/products.ts'
import { getSettings } from '../lib/settings.ts'
import { trackSchema } from '../schemas.ts'

export const publicRouter = Router()

publicRouter.get('/settings', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  res.json(getSettings())
})

publicRouter.get('/home', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  res.json({ categories: listCategories({ visibleOnly: true }), ...homeSections() })
})

publicRouter.get('/categories', (_req, res) => {
  res.json(listCategories({ visibleOnly: true }))
})

const FILTERS = ['featured', 'offers', 'flexible', 'bestsellers'] as const
const SORTS = ['newest', 'price_asc', 'price_desc', 'name'] as const
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const int = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined)

publicRouter.get('/products', (req, res) => {
  const filter = str(req.query.filter)
  const sort = str(req.query.sort)
  const opts: ListOptions = {
    publicOnly: true,
    q: str(req.query.q)?.slice(0, 100),
    categorySlug: str(req.query.category),
    filter: FILTERS.find((f) => f === filter),
    sort: SORTS.find((s) => s === sort),
    inStockOnly: req.query.inStock === '1',
    limit: int(req.query.limit),
    offset: int(req.query.offset),
  }
  res.json(listProducts(opts))
})

publicRouter.get('/products/:slug', (req, res) => {
  const product = getPublicProductBySlug(req.params.slug)
  if (!product) {
    res.status(404).json({ error: 'Product not found.' })
    return
  }
  res.json({ product, related: relatedProducts(product) })
})

const trackLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false })

/** Records a WhatsApp button click (no personal data) so the owner can see which products and ads convert. */
publicRouter.post('/track', trackLimiter, (req, res) => {
  const parsed = trackSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request.' })
    return
  }
  const t = parsed.data
  let productId = t.productId ?? null
  if (productId && !db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) productId = null
  db.prepare(
    'INSERT INTO whatsapp_clicks (product_id, action, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?)',
  ).run(productId, t.action, t.utmSource ?? null, t.utmMedium ?? null, t.utmCampaign ?? null)
  res.status(204).end()
})
