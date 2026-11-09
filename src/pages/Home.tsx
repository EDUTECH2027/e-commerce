import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Category, HomeData, Product } from '../../shared/types'
import { ArrowRight, BoxIcon, ChatIcon, CheckIcon, SearchIcon, ShieldIcon, TagIcon } from '../components/Icons'
import { ProductGrid } from '../components/ProductCard'
import { ContactWhatsAppButton } from '../components/WhatsAppButton'
import { useSettings } from '../context/SettingsContext'
import { useI18n, useLocalizedCategories } from '../i18n/I18nContext'
import type { MessageKey } from '../i18n/messages'
import { api } from '../lib/api'
import { useAsync, usePageMeta } from '../lib/hooks'
import { thumb } from '../lib/img'

/** "30% or 40%" in the visitor's language. */
function usePercents(): string {
  const { installmentPercents } = useSettings()
  const { t } = useI18n()
  return installmentPercents.map((n) => `${n}%`).join(t('pct.join'))
}

function SectionHeader({ title, subtitle, to }: { title: string; subtitle?: string; to?: string }) {
  const { t } = useI18n()
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-brand-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
          {t('viewAll')} <ArrowRight width={16} height={16} />
        </Link>
      )}
    </div>
  )
}

function ProductSection({ title, subtitle, to, products, loading, tinted }: {
  title: string
  subtitle?: string
  to: string
  products?: Product[]
  loading: boolean
  tinted?: boolean
}) {
  if (!loading && (!products || products.length === 0)) return null
  return (
    <section className={tinted ? 'bg-surface py-12 sm:py-14' : 'py-12 sm:py-14'}>
      <div className="container-page">
        <SectionHeader title={title} subtitle={subtitle} to={to} />
        <ProductGrid products={products?.slice(0, 4)} loading={loading} skeletons={4} />
      </div>
    </section>
  )
}

function Hero({ products }: { products: Product[] }) {
  const s = useSettings()
  const { t } = useI18n()
  const percents = usePercents()
  const shots = products.filter((p) => p.images[0]).slice(0, 3)
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-teal-700 text-white">
      <div aria-hidden className="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      <div aria-hidden className="absolute -bottom-32 start-1/3 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:py-20">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-white/20 ring-inset">
            <TagIcon width={14} height={14} /> {t('hero.badge', { percents, months: s.installmentMonths })}
          </span>
          <h1 dir="auto" className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">{s.heroTitle}</h1>
          <p dir="auto" className="mt-5 max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">{s.heroSubtitle}</p>
          <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row">
            <ContactWhatsAppButton className="!min-h-12 !px-7 !text-base" />
            <Link to="/products" className="btn !min-h-12 !px-7 !text-base bg-white text-brand-900 hover:bg-brand-50">
              {t('hero.browse')} <ArrowRight width={18} height={18} />
            </Link>
          </div>
        </div>

        {shots.length > 0 && (
          <div className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden>
            <div className="grid grid-cols-2 gap-4">
              {shots.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  tabIndex={-1}
                  className={`overflow-hidden rounded-2xl bg-white p-2 shadow-lift transition hover:-translate-y-1 ${i === 0 ? 'col-span-2' : ''}`}
                >
                  <img
                    src={thumb(p.images[0])}
                    alt=""
                    width={480}
                    height={360}
                    loading="eager"
                    className={`w-full rounded-xl bg-surface object-contain ${i === 0 ? 'h-52' : 'h-36'}`}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Trust() {
  const s = useSettings()
  const { t } = useI18n()
  const percents = usePercents()
  const vars = { percents, months: s.installmentMonths }
  const items: { icon: ReactNode; n: 1 | 2 | 3 | 4 }[] = [
    { icon: <TagIcon />, n: 1 },
    { icon: <BoxIcon />, n: 2 },
    { icon: <ChatIcon />, n: 3 },
    { icon: <ShieldIcon />, n: 4 },
  ]
  return (
    <section className="border-b border-line bg-white">
      <div className="container-page grid grid-cols-1 gap-x-6 gap-y-4 py-6 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.n} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">{i.icon}</span>
            <div>
              <p className="text-sm font-bold text-ink">{t(`trust.${i.n}.title` as MessageKey, vars)}</p>
              <p className="text-xs text-muted">{t(`trust.${i.n}.text` as MessageKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CategoryTiles({ categories }: { categories: Category[] }) {
  const { t } = useI18n()
  if (categories.length === 0) return null
  return (
    <section className="py-12 sm:py-14">
      <div className="container-page">
        <SectionHeader title={t('sect.categories')} subtitle={t('sect.categories.sub')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.slug}`}
              className="group card flex items-center gap-3 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift sm:p-4"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-lg font-extrabold text-brand-700 sm:h-14 sm:w-14">
                {c.image ? (
                  <img src={thumb(c.image)} alt="" width={56} height={56} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  c.name.charAt(0)
                )}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm leading-tight font-bold text-ink group-hover:text-brand-700">{c.name}</span>
                <span className="text-xs text-muted">{t('cat.items', { n: c.productCount ?? 0 })}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowToBuy() {
  const { t } = useI18n()
  const percents = usePercents()
  const steps: { icon: ReactNode; n: 1 | 2 | 3 | 4 }[] = [
    { icon: <SearchIcon />, n: 1 },
    { icon: <ChatIcon />, n: 2 },
    { icon: <CheckIcon />, n: 3 },
    { icon: <BoxIcon />, n: 4 },
  ]
  return (
    <section className="bg-surface py-12 sm:py-16">
      <div className="container-page">
        <SectionHeader title={t('how.title')} subtitle={t('how.sub')} />
        <ol className="grid gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4">
          {steps.map((st) => (
            <li key={st.n} className="card relative p-5">
              <span className="absolute end-4 top-4 text-4xl font-black text-brand-100">{st.n}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-800 text-white">{st.icon}</span>
              <h3 className="mt-4 font-bold text-ink">{t(`how.${st.n}.title` as MessageKey)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`how.${st.n}.text` as MessageKey, { percents })}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function WhatsAppSection() {
  const { t } = useI18n()
  const percents = usePercents()
  return (
    <section className="py-12 sm:py-16">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wa-700 to-teal-700 px-6 py-10 text-center text-white sm:px-12 sm:py-14">
          <div aria-hidden className="absolute -start-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-4xl">{t('contact.title')}</h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-white/90 sm:text-lg">{t('contact.text', { percents })}</p>
          <div className="relative mt-7 flex justify-center">
            <ContactWhatsAppButton className="!min-h-12 !bg-white !px-8 !text-base !text-wa-700 hover:!bg-wa-600/10" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const s = useSettings()
  const { t } = useI18n()
  const percents = usePercents()
  const { data, loading, error } = useAsync(() => api.get<HomeData>('/api/home'), 'home')
  const categories = useLocalizedCategories(data?.categories ?? [])
  usePageMeta({ title: `${s.businessName} – ${s.heroTitle}`, description: s.description })

  const heroProducts = data ? [...data.featured, ...data.newArrivals] : []

  return (
    <>
      <Hero products={heroProducts} />
      <Trust />
      {error && (
        <div className="container-page py-10">
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {t('home.error')}
            {import.meta.env.DEV && ` (Developer hint: ${error.message} Is the API running? Use "npm run dev", not "npm run dev:web".)`}
          </p>
        </div>
      )}
      <CategoryTiles categories={categories} />
      <ProductSection title={t('sect.featured')} subtitle={t('sect.featured.sub')} to="/products?filter=featured" products={data?.featured} loading={loading} />
      <ProductSection tinted title={t('sect.new')} subtitle={t('sect.new.sub')} to="/products?sort=newest" products={data?.newArrivals} loading={loading} />
      <ProductSection title={t('sect.best')} subtitle={t('sect.best.sub')} to="/products?filter=bestsellers" products={data?.bestSellers} loading={loading} />
      <ProductSection tinted title={t('sect.offers')} subtitle={t('sect.offers.sub')} to="/products?filter=offers" products={data?.offers} loading={loading} />
      <ProductSection title={t('sect.flexible')} subtitle={t('sect.flexible.sub', { percents })} to="/products?filter=flexible" products={data?.flexible} loading={loading} />
      <HowToBuy />
      <WhatsAppSection />
    </>
  )
}
