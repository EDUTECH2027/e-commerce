import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { query, queryOne } from '../db.js'
import { listCategories } from '../lib/categories.js'
import {
  getPublicProductBySlug,
  homeSections,
  listProducts,
  relatedProducts,
  type ListOptions,
} from '../lib/products.js'
import { getSettings } from '../lib/settings.js'
import { trackSchema } from '../schemas.js'

export const publicRouter = Router()

/**
 * Public catalogue data may be cached briefly by Vercel's CDN (browsers always revalidate), which keeps ad traffic
 * from hitting the database on every view. Owner edits show up within seconds.
 */
const cdn = (seconds: number) => `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}`

publicRouter.get('/settings', async (_req, res) => {
  res.set('Cache-Control', cdn(5))
  res.json(await getSettings())
})

publicRouter.get('/home', async (_req, res) => {
  const [categories, sections] = await Promise.all([listCategories({ visibleOnly: true }), homeSections()])
  res.set('Cache-Control', cdn(10))
  res.json({ categories, ...sections })
})

publicRouter.get('/categories', async (_req, res) => {
  res.set('Cache-Control', cdn(10))
  res.json(await listCategories({ visibleOnly: true }))
})

const FILTERS = ['featured', 'offers', 'flexible', 'bestsellers'] as const
const SORTS = ['newest', 'price_asc', 'price_desc', 'name'] as const
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const int = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined)

publicRouter.get('/products', async (req, res) => {
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
  res.set('Cache-Control', cdn(10))
  res.json(await listProducts(opts))
})

publicRouter.get('/products/:slug', async (req, res) => {
  const product = await getPublicProductBySlug(req.params.slug)
  if (!product) {
    res.status(404).json({ error: 'Product not found.' })
    return
  }
  res.set('Cache-Control', cdn(10))
  res.json({ product, related: await relatedProducts(product) })
})

// In-memory limiter: per server instance only, which is fine for a cheap, anonymous counter.
const trackLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false })

/** Records a WhatsApp button click (no personal data) so the owner can see which products and ads convert. */
publicRouter.post('/track', trackLimiter, async (req, res) => {
  const parsed = trackSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request.' })
    return
  }
  const t = parsed.data
  let productId = t.productId ?? null
  if (productId && !(await queryOne('SELECT 1 FROM products WHERE id = $1', [productId]))) productId = null
  await query(
    'INSERT INTO whatsapp_clicks (product_id, action, utm_source, utm_medium, utm_campaign) VALUES ($1, $2, $3, $4, $5)',
    [productId, t.action, t.utmSource ?? null, t.utmMedium ?? null, t.utmCampaign ?? null],
  )
  res.status(204).end()
})
