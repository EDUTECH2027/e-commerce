/**
 * Local / self-hosted entry point (npm run dev:api, npm start). On Vercel the same app is exported from
 * api/index.ts instead, so nothing here runs there.
 */
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createApp } from './app.js'
import { DIST_DIR, PORT, UPLOAD_DIR } from './config.js'

const app = createApp({
  beforePages(app) {
    // Locally, uploaded images live in ./data/uploads (production uses Vercel Blob). Random names -> cache forever.
    app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, fallthrough: false }))
    if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '365d', immutable: true, fallthrough: false }))
      app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }))
    }
  },
})

app.listen(PORT, () => {
  console.log(`Store running on http://localhost:${PORT}`)
})
