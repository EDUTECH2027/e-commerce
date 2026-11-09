import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import type { AdminStats } from '../../shared/types.ts'
import { requireAuth, requireOwner } from '../auth.ts'
import { db } from '../db.ts'
import {
  countProductsInCategory,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../lib/categories.ts'
import { deleteImage, deleteRemovedImages, processImage } from '../lib/images.ts'
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  patchProduct,
  productStats,
  updateProduct,
} from '../lib/products.ts'
import { getSettings, saveSettings } from '../lib/settings.ts'
import { countOwners, createUser, deleteUser, findUserByEmail, findUserById, listUsers } from '../lib/users.ts'
import { categorySchema, newUserSchema, patchProductSchema, productSchema, settingsSchema } from '../schemas.ts'

export const adminRouter = Router()
adminRouter.use(requireAuth)

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
adminRouter.get('/stats', (_req, res) => {
  const clicks = db
    .prepare("SELECT COUNT(*) AS n FROM whatsapp_clicks WHERE created_at >= datetime('now', '-30 days')")
    .get() as { n: number }
  const topClicked = db
    .prepare(
      `SELECT p.id AS productId, p.name AS name, COUNT(*) AS clicks
       FROM whatsapp_clicks w JOIN products p ON p.id = w.product_id
       WHERE w.created_at >= datetime('now', '-30 days')
       GROUP BY p.id ORDER BY clicks DESC LIMIT 5`,
    )
    .all() as unknown as AdminStats['topClicked']
  const topSources = db
    .prepare(
      `SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS source, COUNT(*) AS clicks
       FROM whatsapp_clicks WHERE created_at >= datetime('now', '-30 days')
       GROUP BY source ORDER BY clicks DESC LIMIT 5`,
    )
    .all() as unknown as AdminStats['topSources']
  const stats: AdminStats = {
    ...productStats(),
    recent: listProducts({ publicOnly: false, limit: 5 }).items,
    whatsappClicks30d: clicks.n,
    topClicked,
    topSources,
  }
  res.json(stats)
})

// ---------- Uploads ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
})

adminRouter.post('/uploads', upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!files.length) {
    res.status(400).json({ error: 'Choose at least one image file.' })
    return
  }
  const urls: string[] = []
  try {
    for (const f of files) urls.push(await processImage(f.buffer))
  } catch {
    await Promise.all(urls.map(deleteImage))
    res.status(400).json({ error: 'One of the files is not a valid image (use JPG, PNG or WebP).' })
    return
  }
  res.status(201).json({ urls })
})

// ---------- Products ----------
adminRouter.get('/products', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined
  const category = Number(req.query.category)
  const status = ['active', 'inactive', 'out_of_stock', 'featured'].find((s) => s === req.query.status) as
    | 'active' | 'inactive' | 'out_of_stock' | 'featured' | undefined
  res.json(
    listProducts({
      publicOnly: false,
      q,
      categoryId: Number.isInteger(category) && category > 0 ? category : undefined,
      status,
      limit: 100,
      offset: Number(req.query.offset) || 0,
    }),
  )
})

adminRouter.get('/products/:id', (req, res) => {
  const p = id(req) ? getProductById(id(req)!) : null
  if (!p) return void notFound(res, 'Product')
  res.json(p)
})

function checkCategory(categoryId: number | null, res: Response): boolean {
  if (categoryId !== null && !getCategory(categoryId)) {
    res.status(400).json({ error: 'The selected category does not exist.', fields: { categoryId: 'Choose a valid category.' } })
    return false
  }
  return true
}

adminRouter.post('/products', (req, res) => {
  const data = validate(productSchema, req.body, res)
  if (!data || !checkCategory(data.categoryId, res)) return
  res.status(201).json(createProduct(data))
})

adminRouter.put('/products/:id', async (req, res) => {
  const pid = id(req)
  const before = pid ? getProductById(pid) : null
  if (!pid || !before) return void notFound(res, 'Product')
  const data = validate(productSchema, req.body, res)
  if (!data || !checkCategory(data.categoryId, res)) return
  const updated = updateProduct(pid, data)
  await deleteRemovedImages(before.images, data.images)
  res.json(updated)
})

adminRouter.patch('/products/:id', (req, res) => {
  const pid = id(req)
  const data = validate(patchProductSchema, req.body, res)
  if (!data) return
  const p = pid ? patchProduct(pid, data) : null
  if (!p) return void notFound(res, 'Product')
  res.json(p)
})

adminRouter.delete('/products/:id', async (req, res) => {
  const removed = id(req) ? deleteProduct(id(req)!) : null
  if (!removed) return void notFound(res, 'Product')
  await Promise.all(removed.images.map(deleteImage))
  res.status(204).end()
})

// ---------- Categories ----------
adminRouter.get('/categories', (_req, res) => {
  res.json(listCategories({ visibleOnly: false }))
})

adminRouter.post('/categories', (req, res) => {
  const data = validate(categorySchema, req.body, res)
  if (!data) return
  res.status(201).json(createCategory(data))
})

adminRouter.put('/categories/:id', async (req, res) => {
  const cid = id(req)
  const before = cid ? getCategory(cid) : null
  if (!cid || !before) return void notFound(res, 'Category')
  const data = validate(categorySchema, req.body, res)
  if (!data) return
  const updated = updateCategory(cid, data)
  if (before.image && before.image !== data.image) await deleteImage(before.image)
  res.json(updated)
})

adminRouter.delete('/categories/:id', async (req, res) => {
  const cid = id(req)
  const cat = cid ? getCategory(cid) : null
  if (!cid || !cat) return void notFound(res, 'Category')
  const n = countProductsInCategory(cid)
  if (n > 0) {
    res.status(409).json({
      error: `This category still contains ${n} product${n === 1 ? '' : 's'}. Move or delete them first, or hide the category instead.`,
    })
    return
  }
  deleteCategory(cid)
  if (cat.image) await deleteImage(cat.image)
  res.status(204).end()
})

// ---------- Settings (owner only) ----------
adminRouter.get('/settings', (_req, res) => {
  res.json(getSettings())
})

adminRouter.put('/settings', requireOwner, async (req, res) => {
  const data = validate(settingsSchema, req.body, res)
  if (!data) return
  const before = getSettings()
  saveSettings(data)
  if (before.logoUrl && before.logoUrl !== data.logoUrl) await deleteImage(before.logoUrl)
  res.json(data)
})

// ---------- Team (owner only) ----------
adminRouter.get('/users', requireOwner, (_req, res) => {
  res.json(listUsers())
})

adminRouter.post('/users', requireOwner, (req, res) => {
  const data = validate(newUserSchema, req.body, res)
  if (!data) return
  if (findUserByEmail(data.email)) {
    res.status(409).json({ error: 'A user with this email already exists.' })
    return
  }
  res.status(201).json(createUser(data.email, data.password, data.role))
})

adminRouter.delete('/users/:id', requireOwner, (req, res) => {
  const uid = id(req)
  const target = uid ? findUserById(uid) : null
  if (!uid || !target) return void notFound(res, 'User')
  if (uid === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account.' })
    return
  }
  if (target.role === 'owner' && countOwners() <= 1) {
    res.status(400).json({ error: 'There must be at least one owner.' })
    return
  }
  deleteUser(uid)
  res.status(204).end()
})

// ---------- Error handling for this router (multer limits, etc.) ----------
adminRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be smaller than 10 MB.' : 'Upload failed. Check the files and try again.'
    res.status(400).json({ error: msg })
    return
  }
  next(err)
})
