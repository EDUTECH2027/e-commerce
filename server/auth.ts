import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { AdminUser } from '../shared/types.js'
import { query, queryOne } from './db.js'
import { findUserById } from './lib/users.js'

export const COOKIE = 'store_admin'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

declare module 'express-serve-static-core' {
  interface Request {
    user?: AdminUser
  }
}

let secretPromise: Promise<string> | null = null

/**
 * Session-signing secret: JWT_SECRET if set, otherwise generated once and kept in the database
 * (serverless functions have no persistent disk to keep it in).
 */
export function getJwtSecret(): Promise<string> {
  secretPromise ??= (async () => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET
    const existing = await queryOne<{ value: string }>(`SELECT value FROM kv WHERE key = 'jwt_secret'`)
    if (existing) return existing.value
    await query(`INSERT INTO kv (key, value) VALUES ('jwt_secret', $1) ON CONFLICT (key) DO NOTHING`, [
      crypto.randomBytes(48).toString('hex'),
    ])
    return (await queryOne<{ value: string }>(`SELECT value FROM kv WHERE key = 'jwt_secret'`))!.value
  })().catch((err) => {
    secretPromise = null
    throw err
  })
  return secretPromise
}

export async function issueSession(req: Request, res: Response, user: AdminUser): Promise<void> {
  const token = jwt.sign({ uid: user.id }, await getJwtSecret(), { expiresIn: '7d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict', // also our CSRF defence: the cookie is never sent on cross-site requests
    secure: req.secure,
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { path: '/' })
}

/** Loads the user from the DB on every request so removed users / changed roles take effect immediately. */
export async function sessionUser(req: Request): Promise<AdminUser | null> {
  const token = req.cookies?.[COOKIE] as string | undefined
  if (!token) return null
  try {
    const payload = jwt.verify(token, await getJwtSecret()) as { uid: number }
    return await findUserById(payload.uid)
  } catch {
    return null
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await sessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Please sign in.' })
    return
  }
  req.user = user
  next()
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'owner') {
    res.status(403).json({ error: 'Only the store owner can do this.' })
    return
  }
  next()
}

export const verifyPassword = (plain: string, hash: string) => bcrypt.compareSync(plain, hash)
