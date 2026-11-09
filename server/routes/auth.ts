import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { clearSession, issueSession, requireAuth, sessionUser, verifyPassword } from '../auth.ts'
import { findUserByEmail, getPasswordHash, setPassword } from '../lib/users.ts'
import { loginSchema, passwordSchema } from '../schemas.ts'

export const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
})

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

authRouter.post('/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your email and password.' })
    return
  }
  const { email, password } = parsed.data
  const user = findUserByEmail(email)
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) {
    res.status(401).json({ error: 'Incorrect email or password.' })
    return
  }
  const safe = { id: user.id, email: user.email, role: user.role }
  issueSession(req, res, safe)
  res.json(safe)
})

authRouter.post('/logout', (_req, res) => {
  clearSession(res)
  res.status(204).end()
})

authRouter.get('/me', (req, res) => {
  const user = sessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  res.json(user)
})

authRouter.post('/password', requireAuth, (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid password.' })
    return
  }
  const hash = getPasswordHash(req.user!.id)
  if (!hash || !verifyPassword(parsed.data.currentPassword, hash)) {
    res.status(400).json({ error: 'Your current password is incorrect.' })
    return
  }
  setPassword(req.user!.id, parsed.data.newPassword)
  res.status(204).end()
})
