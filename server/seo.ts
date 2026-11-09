import type { Request } from 'express'
import { isLang, langDir, overlay, type Lang } from '../shared/lang.ts'
import type { Category, CategoryText, Product, ProductText, SettingsText, StoreSettings } from '../shared/types.ts'
import { PUBLIC_URL } from './config.ts'
import { getCategoryBySlug } from './lib/categories.ts'
import { ogImageUrl } from './lib/images.ts'
import { allPublicSlugs, getPublicProductBySlug } from './lib/products.ts'
import { getSettings } from './lib/settings.ts'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const effectivePrice = (p: Product) => (p.promoPrice !== null && p.promoPrice < p.price ? p.promoPrice : p.price)

/** The few sentences the server writes itself (everything else is owner content, translated via `overlay`). */
const TEXT: Record<Lang, {
  orderBlurb: string
  shop: (cat: string, shop: string) => string
  productNotFound: string
  categoryNotFound: string
  allProducts: string
}> = {
  en: {
    orderBlurb: 'Order on WhatsApp with flexible payment options.',
    shop: (c, s) => `Shop ${c} at ${s}. Order on WhatsApp with flexible payment options.`,
    productNotFound: 'Product not found',
    categoryNotFound: 'Category not found',
    allProducts: 'Shop all products',
  },
  fr: {
    orderBlurb: 'Commandez sur WhatsApp avec des facilités de paiement.',
    shop: (c, s) => `Découvrez ${c} chez ${s}. Commandez sur WhatsApp avec des facilités de paiement.`,
    productNotFound: 'Produit introuvable',
    categoryNotFound: 'Catégorie introuvable',
    allProducts: 'Tous les produits',
  },
  ar: {
    orderBlurb: 'اطلب عبر واتساب مع خيارات دفع مرنة.',
    shop: (c, s) => `تسوّق ${c} من ${s}. اطلب عبر واتساب مع خيارات دفع مرنة.`,
    productNotFound: 'المنتج غير موجود',
    categoryNotFound: 'الفئة غير موجودة',
    allProducts: 'جميع المنتجات',
  },
}

/** Price as shown to people: French groups with spaces, English/Arabic with commas (Latin digits). */
function money(n: number, currency: string, lang: Lang): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} ${currency}`
}

export function requestLang(req: Request): Lang {
  const q = req.query.lang
  return isLang(q) ? q : 'en'
}

export function baseUrl(req: Request, settings: StoreSettings): string {
  return settings.siteUrl || PUBLIC_URL || `${req.protocol}://${req.get('host')}`
}

interface Meta {
  title: string
  description: string
  url: string
  image?: string
  type: 'website' | 'product'
  noindex?: boolean
  jsonLd?: object
  price?: { amount: number; currency: string }
}

const OG_LOCALE: Record<Lang, string> = { en: 'en_US', fr: 'fr_FR', ar: 'ar_AR' }

function metaTags(m: Meta, siteName: string, lang: Lang): string {
  const tags = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
  ]
  if (m.image) {
    tags.push(
      `<meta property="og:image" content="${esc(m.image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:image" content="${esc(m.image)}" />`,
    )
  }
  if (m.price) {
    tags.push(
      `<meta property="product:price:amount" content="${m.price.amount}" />`,
      `<meta property="product:price:currency" content="${esc(m.price.currency)}" />`,
    )
  }
  if (m.noindex) tags.push('<meta name="robots" content="noindex, nofollow" />')
  if (m.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>`)
  return tags.join('\n    ')
}

export interface PageHead {
  status: number
  title: string
  tags: string
  lang: Lang
}

/**
 * Builds the <title> and social/SEO tags for a URL path so crawlers that don't run JavaScript still see them.
 * Add `?lang=fr` or `?lang=ar` to a link to get previews in that language (used for ads in those languages).
 */
export function pageHead(req: Request): PageHead {
  const raw = getSettings()
  const lang = requestLang(req)
  const s = overlay<StoreSettings & SettingsText>(raw, lang, raw.translations)
  const T = TEXT[lang]
  const base = baseUrl(req, raw)
  const abs = (u: string) => (u.startsWith('http') ? u : base + u)
  const langSuffix = lang === 'en' ? '' : `?lang=${lang}`
  const url = base + req.path + langSuffix
  const logoOg = raw.logoUrl ? abs(ogImageUrl(raw.logoUrl)) : undefined
  let status = 200
  let meta: Meta

  const product = /^\/products\/([^/]+)\/?$/.exec(req.path)
  const category = /^\/category\/([^/]+)\/?$/.exec(req.path)

  if (req.path.startsWith('/admin')) {
    meta = { title: `Admin – ${s.businessName}`, description: '', url, type: 'website', noindex: true }
  } else if (product) {
    const found = getPublicProductBySlug(decodeURIComponent(product[1]))
    if (found) {
      const p = overlay<Product & ProductText>(found, lang, found.translations)
      const price = effectivePrice(p)
      const blurb = p.shortDescription || p.description.replace(/\s+/g, ' ')
      const image = p.images[0] ? abs(ogImageUrl(p.images[0])) : logoOg
      const catName = overlay<Category & CategoryText>(
        { name: p.categoryName ?? '' } as Category & CategoryText,
        lang,
        p.categoryTranslations,
      ).name
      meta = {
        title: `${p.name} – ${money(price, s.currency, lang)} | ${s.businessName}`,
        description: clip(`${money(price, s.currency, lang)}. ${blurb || T.orderBlurb}`, 200),
        url,
        image,
        type: 'product',
        price: { amount: price, currency: 'XAF' },
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          description: clip(blurb, 300),
          image: p.images.map(abs),
          category: catName || undefined,
          inLanguage: lang,
          offers: {
            '@type': 'Offer',
            url,
            price,
            priceCurrency: 'XAF',
            availability:
              p.stockStatus === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          },
        },
      }
    } else {
      status = 404
      meta = { title: `${T.productNotFound} | ${s.businessName}`, description: s.description, url, type: 'website', noindex: true }
    }
  } else if (category) {
    const found = getCategoryBySlug(decodeURIComponent(category[1]))
    if (found && found.visible) {
      const c = overlay<Category & CategoryText>(found, lang, found.translations)
      meta = {
        title: `${c.name} | ${s.businessName}`,
        description: clip(T.shop(c.name, s.businessName), 200),
        url,
        image: c.image ? abs(ogImageUrl(c.image)) : logoOg,
        type: 'website',
      }
    } else {
      status = 404
      meta = { title: `${T.categoryNotFound} | ${s.businessName}`, description: s.description, url, type: 'website', noindex: true }
    }
  } else {
    const home = req.path === '/'
    const extraParams = Object.keys(req.query).filter((k) => k !== 'lang').length > 0
    meta = {
      title: home ? `${s.businessName} – ${s.heroTitle}` : `${T.allProducts} | ${s.businessName}`,
      description: clip(s.description || s.heroSubtitle, 200),
      url: home ? base + '/' + langSuffix : url,
      image: logoOg,
      type: 'website',
      // Search result pages are thin duplicates; keep them out of the index.
      noindex: !home && extraParams,
    }
  }
  return { status, title: meta.title, tags: metaTags(meta, s.businessName, lang), lang }
}

export function renderHtml(template: string, head: PageHead): string {
  return template
    .replace(/<html lang="en">/, `<html lang="${head.lang}" dir="${langDir(head.lang)}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${esc(head.title)}</title>`)
    .replace('<!--app-head-->', head.tags)
}

export function sitemap(req: Request): string {
  const base = baseUrl(req, getSettings())
  const urls = [`${base}/`, `${base}/products`]
  urls.push(...allPublicSlugs().map((p) => `${base}/products/${encodeURIComponent(p.slug)}`))
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') +
    '\n</urlset>\n'
  )
}

export function robots(req: Request): string {
  const base = baseUrl(req, getSettings())
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`
}
