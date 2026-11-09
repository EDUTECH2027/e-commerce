/**
 * Vercel entry point: the whole store (API + server-rendered pages) runs as this one function.
 * vercel.json sends every request that is not a static file here. Local development uses server/index.ts.
 */
import { createApp } from '../server/app.js'

export default createApp()
