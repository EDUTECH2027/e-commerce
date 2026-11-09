import type { Lang } from '../../shared/lang'
import { normalizeWhatsAppNumber } from '../../shared/phone'
import type { Product, StoreSettings } from '../../shared/types'
import { translate } from '../i18n/messages'
import { effectivePrice, formatPriceText as formatPrice, hasDiscount } from './format'

/** Simple message for the general "Chat on WhatsApp" buttons, in the visitor's language. */
export const generalMessage = (lang: Lang): string => translate(lang, 'msg.general')

/**
 * Official click-to-chat link: https://wa.me/<number>?text=<encoded message>.
 * The number always comes from the admin-managed settings. If none is set yet, `wa.me/?text=` still opens
 * WhatsApp with the message ready and lets the visitor pick the recipient.
 */
export function waLink(settings: Pick<StoreSettings, 'whatsappNumber'>, text: string): string {
  return `https://wa.me/${normalizeWhatsAppNumber(settings.whatsappNumber)}?text=${encodeURIComponent(text)}`
}

export function siteOrigin(settings: Pick<StoreSettings, 'siteUrl'>): string {
  return settings.siteUrl || window.location.origin
}

/** Language-neutral product URL; the visitor's language is not baked into the link they send to the seller. */
export function productUrl(settings: Pick<StoreSettings, 'siteUrl'>, p: Pick<Product, 'slug'>): string {
  return `${siteOrigin(settings)}/products/${p.slug}`
}

const joinPercents = (percents: number[], lang: Lang) => percents.map((p) => `${p}%`).join(translate(lang, 'pct.join'))

/** The prefilled message a customer sees in WhatsApp, built from the real product data and live settings. */
export function productOrderMessage(settings: StoreSettings, p: Product, lang: Lang, color?: string): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(lang, key, vars)
  const current = formatPrice(effectivePrice(p), settings.currency)
  const price = hasDiscount(p)
    ? t('msg.promo', { price: current, regular: formatPrice(p.price, settings.currency) })
    : formatPrice(p.price, settings.currency)

  const closing =
    p.stockStatus === 'out_of_stock'
      ? t('msg.closing.out')
      : p.flexiblePayment
        ? t('msg.closing.flex', { percents: joinPercents(settings.installmentPercents, lang) })
        : t('msg.closing.plain')

  const colon = lang === 'fr' ? ' : ' : ': ' // French typography puts a space before the colon
  return [
    t('msg.hello'),
    '',
    `${t('msg.product')}${colon}${p.name}`,
    `${t('msg.price')}${colon}${price}`,
    ...(color ? [`${t('msg.colour')}${colon}${color}`] : []),
    `${t('msg.link')}${colon}${productUrl(settings, p)}`,
    '',
    closing,
    '',
    t('msg.thanks'),
  ].join('\n')
}

/** "Share on WhatsApp": opens WhatsApp's contact picker with a ready-made recommendation. */
export function productShareLink(settings: StoreSettings, p: Product, lang: Lang): string {
  const text = `${translate(lang, 'msg.share', { name: p.name, price: formatPrice(effectivePrice(p), settings.currency) })}\n${productUrl(settings, p)}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
