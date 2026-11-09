import bcrypt from 'bcryptjs'
import type { AdminUser } from '../../shared/types.ts'
import { db } from '../db.ts'

interface Row {
  id: number
  email: string
  password_hash: string
  role: 'owner' | 'editor'
}

const toUser = (r: Row): AdminUser => ({ id: r.id, email: r.email, role: r.role })

export function findUserByEmail(email: string): (AdminUser & { passwordHash: string }) | null {
  const r = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row | undefined
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null
}

export function findUserById(id: number): AdminUser | null {
  const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
  return r ? toUser(r) : null
}

export function getPasswordHash(id: number): string | null {
  const r = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash: string } | undefined
  return r?.password_hash ?? null
}

export function listUsers(): AdminUser[] {
  return (db.prepare('SELECT * FROM users ORDER BY id').all() as unknown as Row[]).map(toUser)
}

export function createUser(email: string, password: string, role: 'owner' | 'editor'): AdminUser {
  const hash = bcrypt.hashSync(password, 12)
  const res = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(email, hash, role)
  return findUserById(Number(res.lastInsertRowid))!
}

export function setPassword(id: number, password: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), id)
}

export function deleteUser(id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
}

export function countOwners(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'").get() as { n: number }).n
}
