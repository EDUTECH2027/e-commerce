import { Link } from 'react-router-dom'
import type { AdminStats } from '../../shared/types'
import { PlusIcon } from '../components/Icons'
import { useSettings } from '../context/SettingsContext'
import { api } from '../lib/api'
import { effectivePrice, formatPrice, STOCK_LABEL, STOCK_STYLE } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { PLACEHOLDER, thumb } from '../lib/img'

function Stat({ label, value, tone = 'text-brand-800' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-1 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const settings = useSettings()
  const { data, loading, error } = useAsync(() => api.get<AdminStats>('/api/admin/stats'), 'stats')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900">Dashboard</h1>
          <p className="text-sm text-muted">A quick look at your store.</p>
        </div>
        <Link to="/admin/products/new" className="btn btn-primary">
          <PlusIcon width={18} height={18} /> Add product
        </Link>
      </div>

      {!settings.whatsappNumber && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            <strong>Set your WhatsApp number.</strong> Until you do, customers cannot reach you directly from “Order on WhatsApp”.
          </p>
          <Link to="/admin/settings" className="btn btn-primary">Open settings</Link>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}

      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Total products" value={data.totalProducts} />
            <Stat label="Active" value={data.activeProducts} tone="text-emerald-700" />
            <Stat label="Out of stock" value={data.outOfStock} tone={data.outOfStock ? 'text-red-600' : 'text-brand-800'} />
            <Stat label="Categories" value={data.totalCategories} />
            <Stat label="Featured" value={data.featuredProducts} tone="text-teal-700" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-brand-900">Recently added</h2>
                <Link to="/admin/products" className="text-sm font-semibold text-brand-700">All products</Link>
              </div>
              {data.recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No products yet. Add your first one!</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recent.map((p) => (
                    <li key={p.id}>
                      <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <img src={p.images[0] ? thumb(p.images[0]) : PLACEHOLDER} alt="" className="h-12 w-12 rounded-lg bg-surface object-contain" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                          <span className="text-xs text-muted">{formatPrice(effectivePrice(p), settings.currency)}</span>
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STOCK_STYLE[p.stockStatus]}`}>{STOCK_LABEL[p.stockStatus]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-5">
              <h2 className="text-lg font-extrabold text-brand-900">WhatsApp activity</h2>
              <p className="text-xs text-muted">Last 30 days</p>
              <p className="mt-3 text-4xl font-black text-wa-700">{data.whatsappClicks30d}</p>
              <p className="text-sm text-muted">button clicks (order, share &amp; contact)</p>

              {data.topClicked.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-bold text-ink">Most requested products</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {data.topClicked.map((t) => (
                      <li key={t.productId} className="flex justify-between gap-3">
                        <span className="truncate">{t.name}</span>
                        <span className="font-bold">{t.clicks}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.topSources.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-bold text-ink">Traffic sources</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {data.topSources.map((t) => (
                      <li key={t.source} className="flex justify-between gap-3">
                        <span className="truncate capitalize">{t.source}</span>
                        <span className="font-bold">{t.clicks}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.whatsappClicks30d === 0 && <p className="mt-4 text-sm text-muted">Clicks will appear here once customers start contacting you.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
