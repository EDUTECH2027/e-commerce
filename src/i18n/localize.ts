import { overlay, type Lang } from '../../shared/lang'
import type { Category, CategoryText, Product, ProductText, SettingsText, StoreSettings } from '../../shared/types'

/** Returns the product with owner-entered French/Arabic text laid over the base text (empty fields fall back). */
export function localizeProduct(p: Product, lang: Lang): Product {
  if (lang === 'en') return p
  const withText = overlay<Product & ProductText>(p, lang, p.translations)
  const cat = overlay<{ name: string } & CategoryText>({ name: p.categoryName ?? '' }, lang, p.categoryTranslations)
  return p.categoryName ? { ...withText, categoryName: cat.name } : withText
}

export function localizeCategory(c: Category, lang: Lang): Category {
  return lang === 'en' ? c : overlay<Category & CategoryText>(c, lang, c.translations)
}

export function localizeSettings(s: StoreSettings, lang: Lang): StoreSettings {
  return lang === 'en' ? s : overlay<StoreSettings & SettingsText>(s, lang, s.translations)
}
