import type { ReactNode } from 'react'
import type { Product } from '../../shared/types'
import { useSettings } from '../context/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { trackContactClick, trackOrderClick, trackShareClick } from '../lib/tracking'
import { generalMessage, productOrderMessage, productShareLink, waLink } from '../lib/whatsapp'
import { ShareIcon, WhatsAppIcon } from './Icons'

interface BaseProps {
  className?: string
  children?: ReactNode
}

/**
 * Plain <a> links (not window.open) so they work with popup blockers and open the WhatsApp app
 * directly on phones, or WhatsApp Web / the desktop app on computers.
 */
export function ContactWhatsAppButton({ className = '', children }: BaseProps) {
  const settings = useSettings()
  const { lang, t } = useI18n()
  return (
    <a
      href={waLink(settings, generalMessage(lang))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackContactClick}
      className={`btn btn-wa ${className}`}
    >
      <WhatsAppIcon />
      {children ?? t('hero.chat')}
    </a>
  )
}

export function OrderWhatsAppButton({ product, color, className = '', children }: BaseProps & { product: Product; color?: string }) {
  const settings = useSettings()
  const { lang, t } = useI18n()
  const soldOut = product.stockStatus === 'out_of_stock'
  return (
    <a
      href={waLink(settings, productOrderMessage(settings, product, lang, color))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackOrderClick(product)}
      className={`btn btn-wa ${className}`}
    >
      <WhatsAppIcon />
      {children ?? (soldOut ? t('p.ask') : t('p.order'))}
    </a>
  )
}

export function ShareWhatsAppButton({ product, className = '' }: BaseProps & { product: Product }) {
  const settings = useSettings()
  const { lang, t } = useI18n()
  return (
    <a
      href={productShareLink(settings, product, lang)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackShareClick(product)}
      className={`btn btn-secondary ${className}`}
    >
      <ShareIcon />
      {t('p.share')}
    </a>
  )
}

/** On product pages the mobile sticky order bar already offers WhatsApp, so the bubble is hidden there on small screens. */
export function FloatingWhatsApp({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const settings = useSettings()
  const { lang, t } = useI18n()
  return (
    <a
      href={waLink(settings, generalMessage(lang))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackContactClick}
      aria-label={t('wa.float')}
      className={`fixed end-4 bottom-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-wa-600 text-white shadow-lift transition hover:scale-105 hover:bg-wa-700 motion-safe:animate-pulse-ring sm:end-6 sm:bottom-6 ${hideOnMobile ? 'max-lg:hidden' : ''}`}
    >
      <WhatsAppIcon width={30} height={30} />
    </a>
  )
}
