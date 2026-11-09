import bcrypt from 'bcryptjs'
import type { AdminUser } from '../../shared/types.js'
import { query, queryOne } from '../db.js'

interface Row {
  id: number
  email: string
  password_hash: string
  role: 'owner' | 'editor'
}

const toUser = (r: Row): AdminUser => ({ id: r.id, email: r.email, role: r.role })

export async function findUserByEmail(email: string): Promise<(AdminUser & { passwordHash: string }) | null> {
  const r = await queryOne<Row>('SELECT * FROM users WHERE lower(email) = lower($1)', [email])
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null
}

export async function findUserById(id: number): Promise<AdminUser | null> {
  const r = await queryOne<Row>('SELECT * FROM users WHERE id = $1', [id])
  return r ? toUser(r) : null
}

export async function getPasswordHash(id: number): Promise<string | null> {
  return (await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [id]))?.password_hash ?? null
}

export async function listUsers(): Promise<AdminUser[]> {
  return (await query<Row>('SELECT * FROM users ORDER BY id')).map(toUser)
}

/** Returns null when a user with this email already exists (also when two requests race to create it). */
export async function createUser(email: string, password: string, role: 'owner' | 'editor'): Promise<AdminUser | null> {
  const hash = bcrypt.hashSync(password, 12)
  const r = await queryOne<Row>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO NOTHING RETURNING *`,
    [email, hash, role],
  )
  return r ? toUser(r) : null
}

export async function setPassword(id: number, password: string): Promise<void> {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(password, 12), id])
}

export async function deleteUser(id: number): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [id])
}

export async function countOwners(): Promise<number> {
  return (await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users WHERE role = 'owner'"))?.n ?? 0
}
