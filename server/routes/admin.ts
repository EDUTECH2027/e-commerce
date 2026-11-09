import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import type { AdminStats } from '../../shared/types.js'
import { requireAuth, requireOwner } from '../auth.js'
import { query } from '../db.js'
import {
  countProductsInCategory,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../lib/categories.js'
import { deleteImage, deleteRemovedImages, processImage } from '../lib/images.js'
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  patchProduct,
  productStats,
  updateProduct,
} from '../lib/products.js'
import { getSettings, saveSettings } from '../lib/settings.js'
import { countOwners, createUser, deleteUser, findUserById, listUsers } from '../lib/users.js'
import { categorySchema, newUserSchema, patchProductSchema, productSchema, settingsSchema } from '../schemas.js'

export const adminRouter = Router()
adminRouter.use(requireAuth)
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store') // admin data must never be cached by browsers or the CDN
  next()
})

const id = (req: Request) => {
  const n = Number(req.params.id)
  return Number.isInteger(n) && n > 0 ? n : null
}
const notFound = (res: Response, what: string) => res.status(404).json({ error: `${what} not found.` })

/** Turns zod failures into `{ error, fields }` so forms can show messages next to inputs. */
function validate<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, body: unknown, res: Response): T | null {
  const r = schema.safeParse(body)
  if (r.success) return r.data
  const fields: Record<string, string> = {}
  for (const issue of r.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message
  res.status(400).json({ error: Object.values(fields)[0] ?? 'Invalid data.', fields })
  return null
}

// ---------- Dashboard ----------
adminRouter.get('/stats', async (_req, res) => {
  const [counts, recent, clicks, topClicked, topSources] = await Promise.all([
    productStats(),
    listProducts({ publicOnly: false, limit: 5 }),
    query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM whatsapp_clicks WHERE created_at >= now() - interval '30 days'`),
    query<AdminStats['topClicked'][number]>(
      `SELECT p.id AS "productId", p.name AS name, COUNT(*)::int AS clicks
       FROM whatsapp_clicks w JOIN products p ON p.id = w.product_id
       WHERE w.created_at >= now() - interval '30 days'
       GROUP BY p.id, p.name ORDER BY clicks DESC LIMIT 5`,
    ),
    query<AdminStats['topSources'][number]>(
      `SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS source, COUNT(*)::int AS clicks
       FROM whatsapp_clicks WHERE created_at >= now() - interval '30 days'
       GROUP BY 1 ORDER BY clicks DESC LIMIT 5`,
    ),
  ])
  const stats: AdminStats = { ...counts, recent: recent.items, whatsappClicks30d: clicks[0]?.n ?? 0, topClicked, topSources }
  res.json(stats)
})

// ---------- Uploads ----------
// Vercel rejects request bodies over 4.5 MB, so the dashboard shrinks photos in the browser first and sends one
// file per request. This limit is the matching server-side guard.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
})

adminRouter.post('/uploads', upload.array('files', 4), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!files.length) {
    res.status(400).json({ error: 'Choose at least one image file.' })
    return
  }
  const urls: string[] = []
  try {
    for (const f of files) urls.push(await processImage(f.buffer))
  } catch (err) {
    await Promise.all(urls.map(deleteImage))
    if (err instanceof Error && /storage is not configured/i.test(err.message)) throw err
    res.status(400).json({ error: 'One of the files is not a valid image (use JPG, PNG or WebP).' })
    return
  }
  res.status(201).json({ urls })
})

// ---------- Products ----------
adminRouter.get('/products', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined
  const category = Number(req.query.category)
  const status = ['active', 'inactive', 'out_of_stock', 'featured'].find((s) => s === req.query.status) as
    | 'active' | 'inactive' | 'out_of_stock' | 'featured' | undefined
  res.json(
    await listProducts({
      publicOnly: false,
      q,
      categoryId: Number.isInteger(category) && category > 0 ? category : undefined,
      status,
      limit: 100,
      offset: Number(req.query.offset) || 0,
    }),
  )
})

adminRouter.get('/products/:id', async (req, res) => {
  const p = id(req) ? await getProductById(id(req)!) : null
  if (!p) return void notFound(res, 'Product')
  res.json(p)
})

async function checkCategory(categoryId: number | null, res: Response): Promise<boolean> {
  if (categoryId !== null && !(await getCategory(categoryId))) {
    res.status(400).json({ error: 'The selected category does not exist.', fields: { categoryId: 'Choose a valid category.' } })
    return false
  }
  return true
}

adminRouter.post('/products', async (req, res) => {
  const data = validate(productSchema, req.body, res)
  if (!data || !(await checkCategory(data.categoryId, res))) return
  res.status(201).json(await createProduct(data))
})

adminRouter.put('/products/:id', async (req, res) => {
  const pid = id(req)
  const before = pid ? await getProductById(pid) : null
  if (!pid || !before) return void notFound(res, 'Product')
  const data = validate(productSchema, req.body, res)
  if (!data || !(await checkCategory(data.categoryId, res))) return
  const updated = await updateProduct(pid, data)
  await deleteRemovedImages(before.images, data.images)
  res.json(updated)
})

adminRouter.patch('/products/:id', async (req, res) => {
  const pid = id(req)
  const data = validate(patchProductSchema, req.body, res)
  if (!data) return
  const p = pid ? await patchProduct(pid, data) : null
  if (!p) return void notFound(res, 'Product')
  res.json(p)
})

adminRouter.delete('/products/:id', async (req, res) => {
  const removed = id(req) ? await deleteProduct(id(req)!) : null
  if (!removed) return void notFound(res, 'Product')
  await Promise.all(removed.images.map(deleteImage))
  res.status(204).end()
})

// ---------- Categories ----------
adminRouter.get('/categories', async (_req, res) => {
  res.json(await listCategories({ visibleOnly: false }))
})

adminRouter.post('/categories', async (req, res) => {
  const data = validate(categorySchema, req.body, res)
  if (!data) return
  res.status(201).json(await createCategory(data))
})

adminRouter.put('/categories/:id', async (req, res) => {
  const cid = id(req)
  const before = cid ? await getCategory(cid) : null
  if (!cid || !before) return void notFound(res, 'Category')
  const data = validate(categorySchema, req.body, res)
  if (!data) return
  const updated = await updateCategory(cid, data)
  if (before.image && before.image !== data.image) await deleteImage(before.image)
  res.json(updated)
})

adminRouter.delete('/categories/:id', async (req, res) => {
  const cid = id(req)
  const cat = cid ? await getCategory(cid) : null
  if (!cid || !cat) return void notFound(res, 'Category')
  const n = await countProductsInCategory(cid)
  if (n > 0) {
    res.status(409).json({
      error: `This category still contains ${n} product${n === 1 ? '' : 's'}. Move or delete them first, or hide the category instead.`,
    })
    return
  }
  await deleteCategory(cid)
  if (cat.image) await deleteImage(cat.image)
  res.status(204).end()
})

// ---------- Settings (owner only) ----------
adminRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings())
})

adminRouter.put('/settings', requireOwner, async (req, res) => {
  const data = validate(settingsSchema, req.body, res)
  if (!data) return
  const before = await getSettings()
  await saveSettings(data)
  if (before.logoUrl && before.logoUrl !== data.logoUrl) await deleteImage(before.logoUrl)
  res.json(data)
})

// ---------- Team (owner only) ----------
adminRouter.get('/users', requireOwner, async (_req, res) => {
  res.json(await listUsers())
})

adminRouter.post('/users', requireOwner, async (req, res) => {
  const data = validate(newUserSchema, req.body, res)
  if (!data) return
  const created = await createUser(data.email, data.password, data.role)
  if (!created) {
    res.status(409).json({ error: 'A user with this email already exists.' })
    return
  }
  res.status(201).json(created)
})

adminRouter.delete('/users/:id', requireOwner, async (req, res) => {
  const uid = id(req)
  const target = uid ? await findUserById(uid) : null
  if (!uid || !target) return void notFound(res, 'User')
  if (uid === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account.' })
    return
  }
  if (target.role === 'owner' && (await countOwners()) <= 1) {
    res.status(400).json({ error: 'There must be at least one owner.' })
    return
  }
  await deleteUser(uid)
  res.status(204).end()
})

// ---------- Error handling for this router (multer limits, etc.) ----------
adminRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be smaller than 4 MB.' : 'Upload failed. Check the files and try again.'
    res.status(400).json({ error: msg })
    return
  }
  next(err)
})
