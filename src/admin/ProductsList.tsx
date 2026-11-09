import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category, Product, ProductList, StockStatus } from '../../shared/types'
import { EditIcon, ExternalIcon, PlusIcon, SearchIcon, StarIcon, TrashIcon } from '../components/Icons'
import { useSettings } from '../context/SettingsContext'
import { api } from '../lib/api'
import { effectivePrice, formatPrice, hasDiscount } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { PLACEHOLDER, thumb } from '../lib/img'
import { useUi } from './ui'

export default function ProductsList() {
  const { currency } = useSettings()
  const { toast, confirm } = useUi()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    api.get<Category[]>('/api/admin/categories').then(setCategories, () => {})
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const key = `${debounced}|${category}|${status}`
  const { data, loading, error, reload } = useAsync(() => {
    const p = new URLSearchParams()
    if (debounced) p.set('q', debounced)
    if (category) p.set('category', category)
    if (status) p.set('status', status)
    return api.get<ProductList>(`/api/admin/products?${p}`)
  }, key)

  const patch = async (p: Product, body: Partial<Pick<Product, 'active' | 'featured' | 'stockStatus'>>) => {
    try {
      await api.patch(`/api/admin/products/${p.id}`, body)
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const remove = async (p: Product) => {
    if (!(await confirm(`Delete “${p.name}”? This also removes its images and cannot be undone.`, { confirmLabel: 'Delete', danger: true }))) return
    try {
      await api.del(`/api/admin/products/${p.id}`)
      toast('Product deleted.')
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900">Products</h1>
          <p className="text-sm text-muted">{data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}</p>
        </div>
        <Link to="/admin/products/new" className="btn btn-primary">
          <PlusIcon width={18} height={18} /> Add product
        </Link>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-[1fr_12rem_12rem] sm:p-4">
        <div className="relative">
          <SearchIcon width={18} height={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search products" className="input pl-10" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Filter by category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select aria-label="Filter by status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Visible in store</option>
          <option value="inactive">Hidden</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="featured">Featured</option>
        </select>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}

      <div className="card overflow-hidden">
        {loading && !data ? (
          <div className="space-y-px p-4">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton mb-3 h-16" />)}</div>
        ) : data && data.items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-bold text-ink">{debounced || category || status ? 'No products match your filters.' : 'No products yet.'}</p>
            {!debounced && !category && !status && <Link to="/admin/products/new" className="btn btn-primary mt-4">Add your first product</Link>}
          </div>
        ) : (
          <ul className="divide-y divide-line" aria-busy={loading}>
            {data?.items.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <img src={p.images[0] ? thumb(p.images[0]) : PLACEHOLDER} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-surface object-contain" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-bold text-ink">
                      {p.name}
                      {p.featured && <StarIcon width={14} height={14} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Featured" />}
                    </p>
                    <p className="text-xs text-muted">{p.categoryName ?? 'No category'}</p>
                    <p className="text-sm font-semibold text-brand-800">
                      {formatPrice(effectivePrice(p), currency)}
                      {hasDiscount(p) && <span className="ml-2 text-xs font-normal text-slate-400 line-through">{formatPrice(p.price, currency)}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <select
                    aria-label={`Availability of ${p.name}`}
                    className="input !min-h-9 !w-auto !py-1 text-xs"
                    value={p.stockStatus}
                    onChange={(e) => patch(p, { stockStatus: e.target.value as StockStatus })}
                  >
                    <option value="in_stock">In stock</option>
                    <option value="low_stock">Limited stock</option>
                    <option value="out_of_stock">Out of stock</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => patch(p, { active: !p.active })}
                    aria-pressed={p.active}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${p.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-500 ring-slate-400/30'}`}
                  >
                    {p.active ? 'Visible' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(p, { featured: !p.featured })}
                    aria-pressed={p.featured}
                    aria-label={p.featured ? 'Remove from featured' : 'Mark as featured'}
                    className={`grid h-9 w-9 place-items-center rounded-lg border ${p.featured ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-line text-slate-400 hover:text-amber-500'}`}
                  >
                    <StarIcon width={16} height={16} />
                  </button>
                  <a href={`/products/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.name} in store`} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:text-brand-700">
                    <ExternalIcon width={16} height={16} />
                  </a>
                  <Link to={`/admin/products/${p.id}`} aria-label={`Edit ${p.name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:text-brand-700">
                    <EditIcon width={16} height={16} />
                  </Link>
                  <button type="button" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:border-red-300 hover:text-red-600">
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
