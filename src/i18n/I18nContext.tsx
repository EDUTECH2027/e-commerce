/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isLang, langDir, type Lang } from '../../shared/lang'
import type { Category, Product } from '../../shared/types'
import { setNumberLocale } from '../lib/format'
import { localizeCategory, localizeProduct } from './localize'
import { translate, type MessageKey, type Vars } from './messages'

const STORE_KEY = 'store_lang'

/** ?lang=fr in a link wins (used by ads), then the visitor's saved choice, then the browser language. */
function detectLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (isLang(q)) return q
  } catch { /* ignore */ }
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (isLang(saved)) return saved
  } catch { /* ignore */ }
  for (const l of navigator.languages ?? [navigator.language]) {
    const prefix = l?.slice(0, 2).toLowerCase()
    if (isLang(prefix)) return prefix
  }
  return 'en'
}

interface Ctx {
  /** Language the page is shown in (always English inside /admin). */
  lang: Lang
  dir: 'ltr' | 'rtl'
  /** The visitor's chosen storefront language. */
  choice: Lang
  setLang: (l: Lang) => void
  t: (key: MessageKey, vars?: Vars) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Lang>(detectLang)
  const { pathname } = useLocation()
  // The owner's dashboard is English-only; never flip it to RTL because the visitor picked Arabic.
  const lang: Lang = pathname.startsWith('/admin') ? 'en' : choice
  const dir = langDir(lang)

  // Prices and numbers are formatted by plain functions, so tell them the current locale before children render.
  setNumberLocale(lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => {
    setChoice(l)
    try {
      localStorage.setItem(STORE_KEY, l)
    } catch { /* storage unavailable: the choice just lasts for this visit */ }
  }, [])

  const t = useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang])
  const value = useMemo(() => ({ lang, dir, choice, setLang, t }), [lang, dir, choice, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

/** Product / category with the visitor's language applied. */
export function useLocalizedProduct(p: Product): Product {
  const { lang } = useI18n()
  return useMemo(() => localizeProduct(p, lang), [p, lang])
}

export function useLocalizedProducts(list: Product[] | undefined): Product[] | undefined {
  const { lang } = useI18n()
  return useMemo(() => list?.map((p) => localizeProduct(p, lang)), [list, lang])
}

export function useLocalizedCategories(list: Category[]): Category[] {
  const { lang } = useI18n()
  return useMemo(() => list.map((c) => localizeCategory(c, lang)), [list, lang])
}
