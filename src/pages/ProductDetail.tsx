import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { computeInstallments } from '../../shared/installments'
import type { Product } from '../../shared/types'
import { ChevronLeft, ChevronRight, ShieldIcon } from '../components/Icons'
import { ProductGrid } from '../components/ProductCard'
import { OrderWhatsAppButton, ShareWhatsAppButton } from '../components/WhatsAppButton'
import { useSettings } from '../context/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { localizeProduct } from '../i18n/localize'
import { api, ApiError } from '../lib/api'
import { discountPercent, effectivePrice, formatPrice, hasDiscount, STOCK_STYLE } from '../lib/format'
import { useAsync, usePageMeta } from '../lib/hooks'
import { PLACEHOLDER, thumb } from '../lib/img'
import { trackViewContent } from '../lib/tracking'
import NotFound from './NotFound'

function Gallery({ images, name }: { images: string[]; name: string }) {
  const { t, dir } = useI18n()
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = images.length
  const go = (i: number) => setIndex((i + count) % count)

  if (count === 0) {
    return <img src={PLACEHOLDER} alt="" className="aspect-square w-full rounded-2xl bg-surface object-cover" />
  }
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl border border-line bg-surface"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null || count < 2) return
          const dx = e.changedTouches[0].clientX - touchX.current
          // Swiping towards the reading direction's end moves forward.
          if (Math.abs(dx) > 45) go(index + ((dir === 'rtl' ? dx > 0 : dx < 0) ? 1 : -1))
          touchX.current = null
        }}
      >
        <img
          key={images[index]}
          src={images[index]}
          alt={t('p.photo', { name, i: index + 1, n: count })}
          width={1200}
          height={900}
          // The main image is the largest contentful element on an ad landing page, so load it immediately.
          fetchPriority="high"
          decoding="async"
          className="aspect-[4/3] w-full animate-fade-up object-contain p-3 sm:aspect-square sm:p-6"
        />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t('p.prev')} className="absolute start-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-card hover:bg-white">
              <ChevronLeft />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t('p.next')} className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-card hover:bg-white">
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t('p.showPhoto', { i: i + 1 })}
                aria-current={i === index}
                className={`block h-16 w-16 overflow-hidden rounded-xl border-2 bg-surface sm:h-20 sm:w-20 ${i === index ? 'border-brand-700' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <img src={thumb(src)} alt="" width={80} height={80} loading="lazy" className="h-full w-full object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Installments({ product }: { product: Product }) {
  const s = useSettings()
  const { t } = useI18n()
  const plans = computeInstallments(effectivePrice(product), s.installmentPercents)
  return (
    <section aria-labelledby="flex-title" className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-teal-700">
        <ShieldIcon width={20} height={20} />
        <h2 id="flex-title" className="font-extrabold">{t('fp.title')}</h2>
      </div>
      <p dir="auto" className="mt-2 text-sm text-slate-700">{s.flexiblePaymentInfo}</p>

      <div className="mt-4 grid gap-3 min-[420px]:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.percent} className="rounded-xl border border-teal-100 bg-white p-4">
            <p className="text-sm font-extrabold text-brand-900">{t('fp.pct', { n: plan.percent })}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t('fp.initial')}</dt>
                <dd className="font-bold text-ink">{formatPrice(plan.initial, s.currency)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t('fp.remaining')}</dt>
                <dd className="font-bold text-ink">{formatPrice(plan.remaining, s.currency)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t('fp.repay')}</dt>
                <dd className="font-semibold text-ink">{t('fp.upTo', { n: s.installmentMonths })}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-600">{t('fp.disclaimer')}</p>
    </section>
  )
}

export default function ProductDetail() {
  const { slug = '' } = useParams()
  const s = useSettings()
  const { t, lang } = useI18n()
  const { data, error, loading } = useAsync(
    () => api.get<{ product: Product; related: Product[] }>(`/api/products/${encodeURIComponent(slug)}`),
    slug,
  )
  const product = useMemo(() => (data ? localizeProduct(data.product, lang) : undefined), [data, lang])
  const [color, setColor] = useState<{ slug: string; value: string } | null>(null)
  const selectedColor = color?.slug === slug ? color.value : ''

  usePageMeta({
    title: product ? `${product.name} – ${formatPrice(effectivePrice(product), s.currency)} | ${s.businessName}` : s.businessName,
    description: product ? (product.shortDescription || product.description.slice(0, 150)) : undefined,
    image: product?.images[0] ? product.images[0].replace(/\.webp$/, '-og.jpg') : undefined,
    noindex: !product && !loading,
  })

  const id = product?.id
  useEffect(() => {
    if (product) trackViewContent(product)
    // Fire once per product, not on every re-render (or language change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error instanceof ApiError && error.status === 404) {
    return <NotFound message={t('p.gone')} />
  }
  if (error) {
    return (
      <div className="container-page py-20 text-center">
        <p role="alert" className="text-red-700">{error.message}</p>
      </div>
    )
  }
  if (loading || !product) {
    return (
      <div className="container-page grid gap-8 py-8 lg:grid-cols-2" aria-busy>
        <div className="skeleton aspect-square" />
        <div className="space-y-4">
          <div className="skeleton h-4 w-1/4" />
          <div className="skeleton h-9 w-4/5" />
          <div className="skeleton h-9 w-1/3" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-14 w-full" />
        </div>
      </div>
    )
  }

  const p = product
  const price = effectivePrice(p)
  const soldOut = p.stockStatus === 'out_of_stock'
  const paragraphs = p.description.split(/\n{2,}/).filter(Boolean)

  return (
    <div className="container-page pt-6 pb-28 sm:pt-8 lg:pb-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-700">{t('nav.home')}</Link> /{' '}
        {p.categorySlug ? (
          <>
            <Link to={`/category/${p.categorySlug}`} className="hover:text-brand-700">{p.categoryName}</Link> /{' '}
          </>
        ) : null}
        <span className="text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={p.images} name={p.name} />

        <div>
          {p.categoryName && <p className="text-xs font-bold tracking-wider text-teal-700 uppercase">{p.categoryName}</p>}
          <h1 dir="auto" className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-brand-900 sm:text-3xl">{p.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-3xl font-black text-brand-800">{formatPrice(price, s.currency)}</span>
            {hasDiscount(p) && (
              <>
                <span className="text-lg text-slate-400 line-through">{formatPrice(p.price, s.currency)}</span>
                <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">{t('p.save', { n: discountPercent(p) })}</span>
              </>
            )}
          </div>

          <p className="mt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${STOCK_STYLE[p.stockStatus]}`}>
              <span aria-hidden className={`h-2 w-2 rounded-full ${soldOut ? 'bg-slate-400' : p.stockStatus === 'low_stock' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {t(`stock.${p.stockStatus}`)}
            </span>
          </p>

          {p.shortDescription && <p dir="auto" className="mt-4 text-base leading-relaxed text-slate-700">{p.shortDescription}</p>}

          {p.colors.length > 0 && (
            <fieldset className="mt-5">
              <legend className="text-sm font-bold text-ink">
                {t('p.colour')} {selectedColor && <span className="font-normal text-muted">– {selectedColor}</span>}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={selectedColor === c}
                    onClick={() => setColor(selectedColor === c ? null : { slug, value: c })}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedColor === c ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-white hover:border-brand-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="hint">{t('p.colour.hint')}</p>
            </fieldset>
          )}

          {/* Primary conversion action: visible without scrolling on every screen size. */}
          <div className="mt-6 flex flex-col gap-3 min-[480px]:flex-row">
            <OrderWhatsAppButton product={p} color={selectedColor || undefined} className="!min-h-14 flex-1 !text-base" />
            <ShareWhatsAppButton product={p} className="!min-h-14" />
          </div>
          <p className="mt-2 text-xs text-muted">{t('p.nopay')}</p>

          {p.flexiblePayment && !soldOut && (
            <div className="mt-6">
              <Installments product={p} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {paragraphs.length > 0 && (
          <section aria-labelledby="desc-title">
            <h2 id="desc-title" className="text-xl font-extrabold text-brand-900">{t('p.desc')}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-slate-700">
              {paragraphs.map((text, i) => (
                <p key={i} dir="auto" className="whitespace-pre-line">{text}</p>
              ))}
            </div>
          </section>
        )}
        {p.specs.length > 0 && (
          <section aria-labelledby="spec-title">
            <h2 id="spec-title" className="text-xl font-extrabold text-brand-900">{t('p.specs')}</h2>
            <dl className="card mt-3 divide-y divide-line overflow-hidden text-sm">
              {p.specs.map((sp, i) => (
                <div key={i} className="grid grid-cols-[2fr_3fr] gap-3 px-4 py-3 odd:bg-surface/70">
                  <dt dir="auto" className="font-semibold text-ink">{sp.label}</dt>
                  <dd dir="auto" className="text-slate-700">{sp.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {data && data.related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-6 text-2xl font-extrabold tracking-tight text-brand-900">{t('p.related')}</h2>
          <ProductGrid products={data.related} />
        </section>
      )}

      {/* Mobile sticky bar keeps the order button within thumb reach while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{p.name}</p>
            <p className="text-lg leading-tight font-black text-brand-800">{formatPrice(price, s.currency)}</p>
          </div>
          <OrderWhatsAppButton product={p} color={selectedColor || undefined} className="ms-auto !px-5">
            {soldOut ? t('p.askShort') : t('p.order')}
          </OrderWhatsAppButton>
        </div>
      </div>
    </div>
  )
}
