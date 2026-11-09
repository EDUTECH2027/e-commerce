import { Link } from 'react-router-dom'
import type { Category } from '../../shared/types'
import { useSettings } from '../context/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { generalMessage, waLink } from '../lib/whatsapp'
import { FacebookIcon, InstagramIcon, PhoneIcon, PinIcon, TikTokIcon, WhatsAppIcon } from './Icons'
import { Logo } from './Header'

export function Footer({ categories }: { categories: Category[] }) {
  const s = useSettings()
  const { lang, t } = useI18n()
  const socials = [
    { url: s.facebookUrl, label: 'Facebook', icon: <FacebookIcon /> },
    { url: s.instagramUrl, label: 'Instagram', icon: <InstagramIcon /> },
    { url: s.tiktokUrl, label: 'TikTok', icon: <TikTokIcon /> },
  ].filter((x) => x.url)

  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div>
          <div className="inline-block rounded-xl bg-white/95 p-3 [&_span]:text-brand-900">
            <Logo />
          </div>
          <p dir="auto" className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200">{s.description}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map((x) => (
                <a
                  key={x.label}
                  href={x.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={x.label}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                >
                  {x.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold tracking-wider text-white uppercase">{t('ft.shop')}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/products" className="hover:text-white">{t('nav.all')}</Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className="hover:text-white">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold tracking-wider text-white uppercase">{t('ft.contact')}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a href={waLink(s, generalMessage(lang))} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-white">
                <WhatsAppIcon width={18} height={18} /> {t('ft.chat')}
              </a>
            </li>
            {s.phone && (
              <li>
                <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 hover:text-white">
                  <PhoneIcon width={18} height={18} /> <bdi dir="ltr">{s.phone}</bdi>
                </a>
              </li>
            )}
            {s.address && (
              <li className="flex items-start gap-2.5">
                <PinIcon width={18} height={18} className="mt-0.5 shrink-0" /> {s.address}
              </li>
            )}
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-300">
        {t('ft.legal', { year: new Date().getFullYear(), name: s.businessName, currency: s.currency })}
      </div>
    </footer>
  )
}
