import compression from 'compression'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import { bootstrap } from './bootstrap.ts'
import { DIST_DIR, IS_PROD, PORT, UPLOAD_DIR } from './config.ts'
import { adminRouter } from './routes/admin.ts'
import { authRouter } from './routes/auth.ts'
import { publicRouter } from './routes/public.ts'
import { pageHead, renderHtml, robots, sitemap } from './seo.ts'

bootstrap()

const app = express()
app.disable('x-powered-by')
// Set TRUST_PROXY=1 when running behind nginx / a hosting proxy so https and client IPs are detected correctly.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://connect.facebook.net'],
        'img-src': ["'self'", 'data:', 'blob:', 'https://www.facebook.com'],
        'connect-src': ["'self'", 'https://www.facebook.com', 'https://connect.facebook.net'],
        'upgrade-insecure-requests': null,
      },
    },
  }),
)
app.use(compression())
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// Uploaded image file names are random, so they can be cached "forever".
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, fallthrough: false }))

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api', publicRouter)
app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }))

// ---- Serve the built storefront with per-page SEO tags (production) ----
const indexFile = path.join(DIST_DIR, 'index.html')
if (fs.existsSync(indexFile)) {
  const template = fs.readFileSync(indexFile, 'utf8')

  app.get('/robots.txt', (req, res) => void res.type('text/plain').send(robots(req)))
  app.get('/sitemap.xml', (req, res) => void res.type('application/xml').send(sitemap(req)))
  app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '365d', immutable: true, fallthrough: false }))
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }))

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const head = pageHead(req)
    if (req.path.startsWith('/admin')) res.set('X-Robots-Tag', 'noindex')
    res.status(head.status).set('Cache-Control', 'no-cache').type('html').send(renderHtml(template, head))
  })
}

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

app.listen(PORT, () => {
  console.log(`Store ${IS_PROD ? 'running' : 'API running'} on http://localhost:${PORT}`)
})
