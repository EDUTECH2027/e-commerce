import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { IS_VERCEL, UPLOAD_DIR, USE_BLOB } from '../config.js'

/**
 * One upload produces three files that share an id:
 *   <id>.webp     – main image, max 1200px wide (product page, gallery)
 *   <id>-sm.webp  – 480px wide (cards, thumbnails)
 *   <id>-og.jpg   – 1200x630 JPEG on white (Facebook / WhatsApp link previews)
 * Only the main URL is stored in the database; the others are derived from it.
 *
 * Where the files live: Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production), otherwise ./data/uploads
 * (local development).
 */
const MAIN_URL =
  /^(?:\/uploads\/|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/)([a-f0-9]{24})\.webp$/

export function isStoredImageUrl(url: string): boolean {
  return MAIN_URL.test(url)
}

const variantNames = (id: string) => [`${id}.webp`, `${id}-sm.webp`, `${id}-og.jpg`]

/** Saves one file to Vercel Blob (production) or ./data/uploads (local) and returns its public URL. */
export async function store(name: string, data: Buffer, contentType: string): Promise<string> {
  if (USE_BLOB) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`uploads/${name}`, data, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    })
    return blob.url
  }
  if (IS_VERCEL) throw new Error('Image storage is not configured. Connect a Vercel Blob store to the project (see DEPLOY.md).')
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, name), data)
  return `/uploads/${name}`
}

export async function processImage(input: Buffer): Promise<string> {
  const id = crypto.randomBytes(12).toString('hex')
  // sharp throws on anything that is not a decodable image, which doubles as content validation.
  const base = sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 }).rotate()

  const [main, small, og] = await Promise.all([
    base.clone().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
    base
      .clone()
      .resize({ width: 1200, height: 630, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer(),
  ])
  const [mainUrl] = await Promise.all([
    store(`${id}.webp`, main, 'image/webp'),
    store(`${id}-sm.webp`, small, 'image/webp'),
    store(`${id}-og.jpg`, og, 'image/jpeg'),
  ])
  return mainUrl
}

/** All stored files that belong to one main image URL. */
function allUrls(url: string): string[] {
  return [url, url.replace(/\.webp$/, '-sm.webp'), url.replace(/\.webp$/, '-og.jpg')]
}

export async function deleteImage(url: string): Promise<void> {
  const m = MAIN_URL.exec(url)
  if (!m) return
  if (url.startsWith('/')) {
    await Promise.all(variantNames(m[1]).map((f) => fs.rm(path.join(UPLOAD_DIR, f), { force: true })))
    return
  }
  if (!USE_BLOB) return
  const { del } = await import('@vercel/blob')
  await del(allUrls(url)).catch(() => {}) // a missing file must never block deleting a product
}

/** Deletes files that were referenced before an edit but no longer are. */
export async function deleteRemovedImages(before: string[], after: string[]): Promise<void> {
  const keep = new Set(after)
  await Promise.all(before.filter((u) => !keep.has(u)).map(deleteImage))
}

export function ogImageUrl(url: string): string {
  return url.replace(/\.webp$/, '-og.jpg')
}
