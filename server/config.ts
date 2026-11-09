import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
export const DIST_DIR = path.join(ROOT, 'dist')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const PORT = Number(process.env.PORT ?? 3001)
export const IS_PROD = process.env.NODE_ENV === 'production'

/** JWT signing secret: from the environment, or generated once and persisted in the data folder. */
function loadSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const file = path.join(DATA_DIR, '.jwt-secret')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const secret = crypto.randomBytes(48).toString('hex')
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}
export const JWT_SECRET = loadSecret()

/** Optional canonical public URL, e.g. https://www.mystore.com (no trailing slash). */
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '')
