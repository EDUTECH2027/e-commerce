import bcrypt from 'bcryptjs'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { AdminUser } from '../shared/types.ts'
import { JWT_SECRET } from './config.ts'
import { findUserById } from './lib/users.ts'

export const COOKIE = 'store_admin'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

declare module 'express-serve-static-core' {
  interface Request {
    user?: AdminUser
  }
}

export function issueSession(req: Request, res: Response, user: AdminUser): void {
  const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' })
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
function resolveUser(req: Request): AdminUser | null {
  const token = req.cookies?.[COOKIE] as string | undefined
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number }
    return findUserById(payload.uid)
  } catch {
    return null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = resolveUser(req)
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

export const sessionUser = resolveUser
export const verifyPassword = (plain: string, hash: string) => bcrypt.compareSync(plain, hash)
