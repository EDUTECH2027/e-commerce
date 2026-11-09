import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { UPLOAD_DIR } from '../config.ts'

/**
 * One upload produces three files that share an id:
 *   <id>.webp     – main image, max 1200px wide (product page, gallery)
 *   <id>-sm.webp  – 480px wide (cards, thumbnails)
 *   <id>-og.jpg   – 1200x630 JPEG on white (Facebook / WhatsApp link previews)
 * Only the main URL (`/uploads/<id>.webp`) is stored in the database.
 */
const MAIN_URL = /^\/uploads\/([a-f0-9]{24})\.webp$/

export function isStoredImageUrl(url: string): boolean {
  return MAIN_URL.test(url)
}

export async function processImage(input: Buffer): Promise<string> {
  const id = crypto.randomBytes(12).toString('hex')
  // sharp throws on anything that is not a decodable image, which doubles as content validation.
  const base = sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 }).rotate()

  await Promise.all([
    base.clone().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, `${id}.webp`)),
    base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(UPLOAD_DIR, `${id}-sm.webp`)),
    base
      .clone()
      .resize({ width: 1200, height: 630, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(UPLOAD_DIR, `${id}-og.jpg`)),
  ])
  return `/uploads/${id}.webp`
}

export async function deleteImage(url: string): Promise<void> {
  const m = MAIN_URL.exec(url)
  if (!m) return
  const id = m[1]
  await Promise.all(
    [`${id}.webp`, `${id}-sm.webp`, `${id}-og.jpg`].map((f) => fs.rm(path.join(UPLOAD_DIR, f), { force: true })),
  )
}

/** Deletes files that were referenced before an edit but no longer are. */
export async function deleteRemovedImages(before: string[], after: string[]): Promise<void> {
  const keep = new Set(after)
  await Promise.all(before.filter((u) => !keep.has(u)).map(deleteImage))
}

export function ogImageUrl(url: string): string {
  return url.replace(/\.webp$/, '-og.jpg')
}
