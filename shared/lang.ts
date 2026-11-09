export const LANGS = ['en', 'fr', 'ar'] as const
export type Lang = (typeof LANGS)[number]
/** Languages that owners can translate content into (English is the base language they type in). */
export const TRANSLATED_LANGS = ['fr', 'ar'] as const
export type TranslatedLang = (typeof TRANSLATED_LANGS)[number]

export const LANG_LABEL: Record<Lang, string> = { en: 'English', fr: 'Français', ar: 'العربية' }
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v)
export const langDir = (l: Lang): 'ltr' | 'rtl' => (l === 'ar' ? 'rtl' : 'ltr')

/** Returns `base` with any non-empty translated fields for `lang` laid over it. */
export function overlay<T extends object>(base: T, lang: Lang, translations: Partial<Record<TranslatedLang, Partial<T>>> | undefined): T {
  if (lang === 'en' || !translations) return base
  const t = translations[lang]
  if (!t) return base
  const out = { ...base }
  for (const k of Object.keys(t) as (keyof T)[]) {
    const v = t[k]
    if (typeof v === 'string' && v.trim()) out[k] = v as T[keyof T]
  }
  return out
}
