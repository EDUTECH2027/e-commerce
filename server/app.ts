import compression from 'compression'
import cookieParser from 'cookie-parser'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import { ensureReady } from './bootstrap.js'
import { DIST_DIR, IS_VERCEL } from './config.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { publicRouter } from './routes/public.js'
import { pageHead, renderHtml, robots, sitemap } from './seo.js'

const LOCAL_INDEX = path.join(DIST_DIR, 'index.html')
let templateCache: { html: string; at: number } | null = null

/**
 * The built index.html. Locally it is read from ./dist. On Vercel the function does not contain the static files,
 * so it asks the CDN for /index.html (a real file, so it is served directly and never loops back here).
 */
async function getTemplate(req: Request): Promise<string> {
  if (!IS_VERCEL) {
    templateCache ??= { html: fs.readFileSync(LOCAL_INDEX, 'utf8'), at: Date.now() }
    return templateCache.html
  }
  if (templateCache && Date.now() - templateCache.at < 60_000) return templateCache.html
  const res = await fetch(`${req.protocol}://${req.get('host')}/index.html`)
  const html = await res.text()
  if (!res.ok || !html.includes('<!--app-head-->')) throw new Error(`Could not load index.html (HTTP ${res.status})`)
  templateCache = { html, at: Date.now() }
  return html
}

export interface AppOptions {
  /** Hook for serving local files (uploads, built assets) before the page renderer takes over. */
  beforePages?: (app: Express) => void
}

/** The whole store (API, admin API, SEO-rendered pages) as one Express app: no listen() here, so Vercel can host it. */
export function createApp(options: AppOptions = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  // Behind Vercel (or another proxy) the real client address and https come from forwarded headers.
  if (IS_VERCEL) app.set('trust proxy', 1)
  else if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://connect.facebook.net'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://www.facebook.com', 'https://*.public.blob.vercel-storage.com'],
          'connect-src': ["'self'", 'https://www.facebook.com', 'https://connect.facebook.net'],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  )
  if (!IS_VERCEL) app.use(compression()) // Vercel's CDN already compresses responses
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))

  // Create tables / the owner account on the first request of each server instance.
  app.use(async (_req, _res, next) => {
    await ensureReady()
    next()
  })

  app.use('/api/auth', authRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', publicRouter)
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }))

  options.beforePages?.(app)

  app.get('/robots.txt', async (req, res) => void res.type('text/plain').send(await robots(req)))
  app.get('/sitemap.xml', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=0, s-maxage=300').type('application/xml').send(await sitemap(req))
  })

  // Every other page: the single-page app, with title and share tags filled in for crawlers.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const [template, head] = await Promise.all([getTemplate(req), pageHead(req)])
    if (req.path.startsWith('/admin')) res.set('X-Robots-Tag', 'noindex').set('Cache-Control', 'no-store')
    else if (head.status === 200) res.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
    else res.set('Cache-Control', 'public, max-age=0, s-maxage=5')
    res.status(head.status).type('html').send(renderHtml(template, head))
  })

  // Central error handler: log details server-side, return a generic message to the client.
  // Express identifies error handlers by their four parameters, so `_next` must stay even though it is unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: status === 404 ? 'Not found.' : 'Bad request.' })
      return
    }
    console.error(`[${req.method} ${req.originalUrl}]`, err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  })

  return app
}
