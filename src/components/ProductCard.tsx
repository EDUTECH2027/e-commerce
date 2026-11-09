import { Link } from 'react-router-dom'
import type { Product } from '../../shared/types'
import { useSettings } from '../context/SettingsContext'
import { useI18n, useLocalizedProduct } from '../i18n/I18nContext'
import { discountPercent, effectivePrice, formatPrice, hasDiscount, STOCK_STYLE } from '../lib/format'
import { PLACEHOLDER, thumb } from '../lib/img'
import { ArrowRight } from './Icons'

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const p = useLocalizedProduct(product)
  const { currency } = useSettings()
  const { t } = useI18n()
  const soldOut = p.stockStatus === 'out_of_stock'
  const discount = discountPercent(p)

  return (
    <article className="group card flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link to={`/products/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-surface" tabIndex={-1} aria-hidden>
        <img
          src={p.images[0] ? thumb(p.images[0]) : PLACEHOLDER}
          alt=""
          width={480}
          height={360}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105 ${soldOut ? 'opacity-50 grayscale' : ''}`}
        />
        {discount > 0 && !soldOut && (
          <span dir="ltr" className="absolute start-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            -{discount}%
          </span>
        )}
        <span
          className={`absolute end-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STOCK_STYLE[p.stockStatus]}`}
        >
          {t(`stock.${p.stockStatus}`)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {p.categoryName && <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{p.categoryName}</p>}
        <h3 dir="auto" className="mt-1 line-clamp-2 min-h-[2.75rem] text-base leading-snug font-bold text-ink">
          <Link to={`/products/${p.slug}`} className="hover:text-brand-700">
            {p.name}
          </Link>
        </h3>
        {p.shortDescription && <p dir="auto" className="mt-1.5 line-clamp-2 text-sm text-muted">{p.shortDescription}</p>}

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-extrabold text-brand-800">{formatPrice(effectivePrice(p), currency)}</span>
            {hasDiscount(p) && <span className="text-sm text-slate-400 line-through">{formatPrice(p.price, currency)}</span>}
          </div>
          {p.flexiblePayment && (
            <p className="mt-1.5 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              {t('card.flexible')}
            </p>
          )}
          <Link to={`/products/${p.slug}`} className="btn btn-primary mt-3 w-full">
            {t('card.view')} <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-11 w-full" />
      </div>
    </div>
  )
}

export function ProductGrid({ products, loading, skeletons = 8 }: { products?: Product[]; loading?: boolean; skeletons?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {loading || !products
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  )
}
