import type { Product, StockStatus } from '../../shared/types'

let numberLocale = 'en-US'
let isolate = false

/** Set by the language provider: French groups thousands with spaces (300 000), English and Arabic with commas. */
export function setNumberLocale(lang: 'en' | 'fr' | 'ar'): void {
  numberLocale = lang === 'fr' ? 'fr-FR' : 'en-US'
  isolate = lang === 'ar'
}

/** Plain text, e.g. for WhatsApp messages. */
export function formatPriceText(amount: number, currency = 'FCFA'): string {
  return `${amount.toLocaleString(numberLocale)} ${currency}`
}

/**
 * For on-screen use. In right-to-left text the bidi algorithm would otherwise show "90,000 FCFA" as "FCFA 90,000",
 * so Arabic prices are wrapped in a left-to-right isolate (U+2066 … U+2069).
 */
export function formatPrice(amount: number, currency = 'FCFA'): string {
  const text = formatPriceText(amount, currency)
  return isolate ? `⁦${text}⁩` : text
}

export const hasDiscount = (p: Pick<Product, 'price' | 'promoPrice'>): boolean =>
  p.promoPrice !== null && p.promoPrice < p.price

export const effectivePrice = (p: Pick<Product, 'price' | 'promoPrice'>): number =>
  hasDiscount(p) ? (p.promoPrice as number) : p.price

export function discountPercent(p: Pick<Product, 'price' | 'promoPrice'>): number {
  return hasDiscount(p) ? Math.round(((p.price - (p.promoPrice as number)) / p.price) * 100) : 0
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Limited stock',
  out_of_stock: 'Out of stock',
}

export const STOCK_STYLE: Record<StockStatus, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  low_stock: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  out_of_stock: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

/** Parses a user-typed amount like "300 000" or "300,000" into an integer, or null if empty. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}
