/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, withDefaultTranslations } from '../../shared/defaults'
import type { StoreSettings } from '../../shared/types'
import { api } from '../lib/api'
import { useI18n } from '../i18n/I18nContext'
import { localizeSettings } from '../i18n/localize'
import { initPixel } from '../lib/tracking'

interface Ctx {
  settings: StoreSettings
  /** Replace the cached settings (used by the admin after saving). */
  setSettings: (s: StoreSettings) => void
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    api.get<StoreSettings>('/api/settings').then(setSettings, () => setSettings(withDefaultTranslations(DEFAULT_SETTINGS)))
  }, [])

  useEffect(() => {
    if (settings?.metaPixelId) initPixel(settings.metaPixelId)
  }, [settings?.metaPixelId])

  if (!settings) {
    return (
      <div className="grid min-h-screen place-items-center bg-white" role="status" aria-label="Loading">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
      </div>
    )
  }
  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>
}

/** Store settings with the visitor's language applied to the owner-entered texts (headline, banner…). */
export function useSettings(): StoreSettings {
  const ctx = useContext(SettingsContext)
  const { lang } = useI18n()
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  const raw = ctx.settings
  return useMemo(() => localizeSettings(raw, lang), [raw, lang])
}

export function useSetSettings(): (s: StoreSettings) => void {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSetSettings must be used inside SettingsProvider')
  return ctx.setSettings
}
