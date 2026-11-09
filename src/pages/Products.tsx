import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Category, Product, ProductList } from '../../shared/types'
import { CloseIcon } from '../components/Icons'
import { ProductGrid } from '../components/ProductCard'
import { useSettings } from '../context/SettingsContext'
import { useI18n, useLocalizedCategories } from '../i18n/I18nContext'
import type { MessageKey } from '../i18n/messages'
import { api } from '../lib/api'
import { useAsync, usePageMeta } from '../lib/hooks'
import NotFound from './NotFound'

const PAGE_SIZE = 12

const FILTERS = ['', 'offers', 'flexible', 'featured', 'bestsellers'] as const
const filterKey = (id: string): MessageKey => (id ? (`f.${id}` as MessageKey) : 'f.all')
const SORTS = ['newest', 'price_asc', 'price_desc', 'name'] as const

export default function Products() {
  const settings = useSettings()
  const { t, lang } = useI18n()
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = params.get('filter') ?? ''
  const sort = params.get('sort') ?? 'newest'
  const inStock = params.get('inStock') === '1'

  const url = (offset: number) => {
    const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort })
    if (slug) p.set('category', slug)
    if (q) p.set('q', q)
    if (filter) p.set('filter', filter)
    if (inStock) p.set('inStock', '1')
    return `/api/products?${p}`
  }
  const key = url(0)

  // The category (for the page title and a proper 404 when the slug is unknown).
  const categories = useAsync(() => api.get<Category[]>('/api/categories'), 'categories')
  const localizedCategories = useLocalizedCategories(categories.data ?? [])
  const category = slug ? (localizedCategories.find((c) => c.slug === slug) ?? null) : null

  // First page is loaded per filter combination; further pages are appended below.
  const first = useAsync(() => api.get<ProductList>(key), key)
  const [more, setMore] = useState<{ key: string; items: Product[] }>({ key: '', items: [] })
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')

  const extra = more.key === key ? more.items : []
  const items = [...(first.data?.items ?? []), ...extra]
  const total = first.data?.total ?? 0
  const loading = first.loading
  const error = first.error?.message || moreError

  const loadMore = () => {
    setLoadingMore(true)
    setMoreError('')
    api.get<ProductList>(url(items.length)).then(
      (r) =>
        setMore((prev) => {
          const base = prev.key === key ? prev.items : []
          const seen = new Set([...(first.data?.items ?? []), ...base].map((p) => p.id))
          return { key, items: [...base, ...r.items.filter((p) => !seen.has(p.id))] }
        }),
      (e: Error) => setMoreError(e.message),
    ).finally(() => setLoadingMore(false))
  }

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  const notFound = !!slug && !categories.loading && category === null
  const title = q
    ? t('products.results', { q })
    : category
      ? category.name
      : filter && (FILTERS as readonly string[]).includes(filter)
        ? t(filterKey(filter))
        : t('products.all')
  usePageMeta({
    title: `${title} | ${settings.businessName}`,
    description: t('products.meta', { what: title.toLowerCase(), name: settings.businessName }),
    noindex: !!q || notFound,
  })

  if (notFound) return <NotFound message={t('nf.cat')} />

  return (
    <div className="container-page py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link to="/" className="hover:text-brand-700">{t('nav.home')}</Link> / <span className="text-ink">{category ? category.name : t('products.crumb')}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {loading ? t('loading') : t(total === 1 ? 'products.count.one' : 'products.count.other', { n: total.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={inStock} onChange={(e) => setParam('inStock', e.target.checked ? '1' : '')} className="h-4 w-4 accent-brand-800" />
            {t('instock.only')}
          </label>
          <label className="sr-only" htmlFor="sort">{t('sort.label')}</label>
          <select id="sort" value={sort} onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)} className="input !w-auto">
            {SORTS.map((s) => (
              <option key={s} value={s}>{t(`sort.${s}` as MessageKey)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('filter.aria')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setParam('filter', f)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === f ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-white hover:border-brand-300'
            }`}
          >
            {t(filterKey(f))}
          </button>
        ))}
        {q && (
          <button type="button" onClick={() => setParam('q', '')} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
            “{q}” <CloseIcon width={14} height={14} />
            <span className="sr-only">{t('search.clear')}</span>
          </button>
        )}
      </div>

      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : !loading && items.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <p className="text-lg font-bold text-ink">{t('empty.title')}</p>
            <p className="mt-1 text-sm text-muted">{t('empty.text')}</p>
            <Link to="/products" className="btn btn-primary mt-5">{t('empty.cta')}</Link>
          </div>
        ) : (
          <ProductGrid products={items} loading={loading} skeletons={8} />
        )}

        {!loading && items.length < total && (
          <div className="mt-8 text-center">
            <button type="button" className="btn btn-secondary !px-8" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? t('loading') : t('more', { n: total - items.length })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
