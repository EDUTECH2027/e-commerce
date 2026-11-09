import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { clearSession, issueSession, requireAuth, sessionUser, verifyPassword } from '../auth.js'
import { query, queryOne } from '../db.js'
import { findUserByEmail, getPasswordHash, setPassword } from '../lib/users.js'
import { loginSchema, passwordSchema } from '../schemas.js'

export const authRouter = Router()

const MAX_FAILURES = 10
const WINDOW = '15 minutes'

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

authRouter.post('/login', async (req, res) => {
  // Throttling lives in the database so it holds across serverless instances (an in-memory counter would not).
  const key = `login:${req.ip ?? 'unknown'}`
  const recent = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM login_attempts WHERE key = $1 AND created_at > now() - interval '${WINDOW}'`,
    [key],
  )
  if ((recent?.n ?? 0) >= MAX_FAILURES) {
    res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' })
    return
  }

  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your email and password.' })
    return
  }
  const { email, password } = parsed.data
  const user = await findUserByEmail(email)
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) {
    await query('INSERT INTO login_attempts (key) VALUES ($1)', [key])
    await query(`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`) // keep the table small
    res.status(401).json({ error: 'Incorrect email or password.' })
    return
  }
  const safe = { id: user.id, email: user.email, role: user.role }
  await issueSession(req, res, safe)
  res.json(safe)
})

authRouter.post('/logout', (_req, res) => {
  clearSession(res)
  res.status(204).end()
})

authRouter.get('/me', async (req, res) => {
  const user = await sessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  res.json(user)
})

authRouter.post('/password', requireAuth, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid password.' })
    return
  }
  const hash = await getPasswordHash(req.user!.id)
  if (!hash || !verifyPassword(parsed.data.currentPassword, hash)) {
    res.status(400).json({ error: 'Your current password is incorrect.' })
    return
  }
  await setPassword(req.user!.id, parsed.data.newPassword)
  res.status(204).end()
})
