import { DEFAULT_SETTINGS, withDefaultTranslations } from '../../shared/defaults.js'
import type { StoreSettings } from '../../shared/types.js'
import { query } from '../db.js'

export { DEFAULT_SETTINGS }

// Settings are read on almost every request. A few seconds of per-instance caching saves a database round trip;
// saving invalidates the instance that handled the save, other instances catch up within the TTL.
const TTL_MS = 5000
let cache: { value: StoreSettings; at: number } | null = null

export async function getSettings(): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  const rows = await query<{ data: string }>('SELECT data FROM settings WHERE id = 1')
  const saved = rows[0] ? (JSON.parse(rows[0].data) as Partial<StoreSettings>) : {}
  const value = withDefaultTranslations({ ...DEFAULT_SETTINGS, ...saved })
  cache = { value, at: Date.now() }
  return value
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await query(
    `INSERT INTO settings (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(settings)],
  )
  cache = null
}
