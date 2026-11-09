import path from 'node:path'
import { DATA_DIR } from './config.js'

/**
 * PostgreSQL access. Everything goes through query(), so this is the only file that knows which driver is used:
 *  - DATABASE_URL set (Vercel + Neon): Neon's serverless driver, which talks HTTP and suits short-lived functions.
 *  - otherwise (local development): PGlite, a real PostgreSQL running inside Node with its files in ./data/pg.
 * Both speak the same SQL, so what you test locally is what runs online.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>
type Runner = (text: string, params: unknown[]) => Promise<Row[]>

let runner: Promise<Runner> | null = null

async function createRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (url) {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)
    return async (text, params) => (await sql.query(text, params as never[])) as Row[]
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set. Add a Postgres (Neon) database to the Vercel project; see DEPLOY.md.')
  }
  // Local development only. The name is a variable so deployment bundlers do not pull this package in.
  const pkg = '@electric-sql/pglite'
  const { PGlite } = await import(pkg)
  const local = new PGlite(path.join(DATA_DIR, 'pg'))
  return async (text, params) => (await local.query(text, params)).rows as Row[]
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  runner ??= createRunner().catch((err) => {
    runner = null // allow a retry on the next request
    throw err
  })
  return (await (await runner)(text, params)) as T[]
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null
}

/** Timestamps come back as Date objects from some drivers and strings from others. */
export const iso = (v: unknown): string => (v instanceof Date ? v : new Date(String(v))).toISOString()
