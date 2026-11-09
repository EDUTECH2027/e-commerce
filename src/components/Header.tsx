import { useId, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LANG_LABEL, LANGS, isLang } from '../../shared/lang'
import type { Category } from '../../shared/types'
import { useSettings } from '../context/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { trackContactClick } from '../lib/tracking'
import { generalMessage, waLink } from '../lib/whatsapp'
import { SearchIcon, WhatsAppIcon } from './Icons'

export function Logo({ className = '' }: { className?: string }) {
  const { businessName, logoUrl } = useSettings()
  const { t } = useI18n()
  return (
    <Link to="/" className={`flex min-w-0 items-center gap-2.5 ${className}`} aria-label={t('logo.home', { name: businessName })}>
      {logoUrl ? (
        <img src={logoUrl.replace(/\.webp$/, '-sm.webp')} alt="" className="h-10 w-auto max-w-[9rem] object-contain" height={40} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-800 text-lg font-extrabold text-white">
          {businessName.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate text-lg leading-tight font-extrabold tracking-tight text-brand-900">{businessName}</span>
    </Link>
  )
}

function LanguageSwitcher() {
  const { choice, setLang, t } = useI18n()
  return (
    <>
      <label htmlFor="lang-select" className="sr-only">
        {t('lang.label')}
      </label>
      <select
        id="lang-select"
        value={choice}
        onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
        className="input !min-h-10 !w-auto shrink-0 cursor-pointer !px-2.5 text-sm font-semibold"
      >
        {LANGS.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    </>
  )
}

function SearchBar({ className = '' }: { className?: string }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const urlQuery = location.pathname.startsWith('/products') || location.pathname.startsWith('/category') ? (params.get('q') ?? '') : ''
  // Re-mount the form when the query changes through the URL (back button, clearing filters) so the box follows it.
  return <SearchForm key={urlQuery} initial={urlQuery} className={className} />
}

function SearchForm({ initial, className }: { initial: string; className: string }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [value, setValue] = useState(initial)
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('search.label')}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('search.placeholder')}
        className="input h-11 rounded-full bg-surface ps-5 pe-12"
        enterKeyHint="search"
        maxLength={100}
      />
      <button type="submit" aria-label={t('search.submit')} className="absolute end-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-brand-800 text-white hover:bg-brand-700">
        <SearchIcon width={18} height={18} />
      </button>
    </form>
  )
}

export function Header({ categories }: { categories: Category[] }) {
  const settings = useSettings()
  const { lang, t } = useI18n()
  const pill = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
      isActive ? 'bg-brand-800 text-white' : 'text-ink hover:bg-brand-50'
    }`

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      {settings.promoBanner && (
        <div dir="auto" className="bg-brand-900 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">{settings.promoBanner}</div>
      )}
      <div className="container-page flex items-center gap-2 py-3 sm:gap-4">
        <Logo className="shrink-0 max-sm:max-w-[48%]" />
        <SearchBar className="mx-auto hidden max-w-xl flex-1 md:block" />
        <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0">
          <LanguageSwitcher />
          <a
            href={waLink(settings, generalMessage(lang))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackContactClick}
            className="btn btn-wa shrink-0 !px-4"
          >
            <WhatsAppIcon />
            <span className="max-sm:sr-only">{t('header.whatsapp')}</span>
          </a>
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBar />
      </div>
      <nav aria-label={t('nav.categories')} className="border-t border-line/70">
        <div className="container-page no-scrollbar flex gap-1 overflow-x-auto py-2">
          <NavLink to="/" end className={pill}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/products" end className={pill}>
            {t('nav.all')}
          </NavLink>
          {categories.map((c) => (
            <NavLink key={c.id} to={`/category/${c.slug}`} className={pill}>
              {c.name}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}
