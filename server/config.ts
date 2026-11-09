import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const IS_VERCEL = !!process.env.VERCEL
export const IS_PROD = process.env.NODE_ENV === 'production' || IS_VERCEL

/**
 * Local folder for the development database (./data/pg) and, without cloud storage configured, uploaded images.
 * On Vercel the file system is read-only and temporary, so nothing is ever written here in production.
 */
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
export const DIST_DIR = path.join(ROOT, 'dist')

if (!IS_VERCEL) fs.mkdirSync(DATA_DIR, { recursive: true })

export const PORT = Number(process.env.PORT ?? 3001)

/** Optional canonical public URL, e.g. https://www.mystore.com (no trailing slash). */
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '')

/** True when images should go to Vercel Blob (set automatically when a Blob store is connected to the project). */
export const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN
