import type { Product } from '../../shared/types'
import { effectivePrice } from './format'

/* ---------- UTM capture ---------- */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const
const STORE_KEY = 'store_utm'

export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>

/**
 * Remembers the campaign parameters of the visit's landing URL (first touch wins within a session),
 * so they are still known when the visitor later clicks WhatsApp on another page.
 */
export function captureUtm(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const found: Utm = {}
    for (const k of UTM_KEYS) {
      const v = params.get(k)
      if (v) found[k] = v.slice(0, 150)
    }
    if (Object.keys(found).length && !sessionStorage.getItem(STORE_KEY)) {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(found))
    }
  } catch {
    /* storage can be unavailable (private mode) – tracking is best-effort */
  }
}

export function getUtm(): Utm {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '{}') as Utm
  } catch {
    return {}
  }
}

/* ---------- Meta (Facebook) Pixel ---------- */

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: (...a: unknown[]) => void }
declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let pixelId = ''

/** Loads the Pixel once. Does nothing until a Pixel ID has been entered in the admin settings. */
export function initPixel(id: string): void {
  if (!id || pixelId === id || window.fbq) return
  pixelId = id
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else (fbq.queue ??= []).push(args)
  }
  window.fbq = fbq
  window._fbq = fbq
  fbq.loaded = true
  fbq.queue = []
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('init', id)
}

function pixel(event: string, data?: Record<string, unknown>) {
  if (!window.fbq) return
  window.fbq('track', event, { ...data, ...getUtm() })
}

export const trackPageView = () => pixel('PageView')

const content = (p: Product) => ({
  content_ids: [String(p.id)],
  content_name: p.name,
  content_type: 'product',
  content_category: p.categoryName ?? undefined,
  value: effectivePrice(p),
  currency: 'XAF', // ISO code for the CFA franc (FCFA)
})

export const trackViewContent = (p: Product) => pixel('ViewContent', content(p))

/** "Order on WhatsApp" is the conversion the ads optimise for, so it is reported as a Lead. */
export function trackOrderClick(p: Product): void {
  pixel('Lead', content(p))
  logClick('order', p.id)
}

export function trackContactClick(): void {
  pixel('Contact')
  logClick('contact', null)
}

export const trackShareClick = (p: Product) => logClick('share', p.id)

/** Server-side tally (no personal data) shown on the admin dashboard. */
function logClick(action: 'order' | 'share' | 'contact', productId: number | null): void {
  const utm = getUtm()
  try {
    void fetch('/api/track', {
      method: 'POST',
      keepalive: true, // survives the page being left for WhatsApp
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        productId,
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
      }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}
