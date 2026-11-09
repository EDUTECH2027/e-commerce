import type { StoreSettings } from '../../shared/types.ts'
import { DEFAULT_SETTINGS, withDefaultTranslations } from '../../shared/defaults.ts'
import { db } from '../db.ts'

export { DEFAULT_SETTINGS }

export function getSettings(): StoreSettings {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as { data: string } | undefined
  const saved = row ? (JSON.parse(row.data) as Partial<StoreSettings>) : {}
  return withDefaultTranslations({ ...DEFAULT_SETTINGS, ...saved })
}

export function saveSettings(settings: StoreSettings): void {
  db.prepare(
    `INSERT INTO settings (id, data) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  ).run(JSON.stringify(settings))
}
