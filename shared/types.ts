import type { TranslatedLang } from './lang.js'

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface ProductText {
  name: string
  shortDescription: string
  description: string
}
export interface CategoryText {
  name: string
}
export interface SettingsText {
  description: string
  promoBanner: string
  heroTitle: string
  heroSubtitle: string
  flexiblePaymentInfo: string
}
/** Optional owner-entered translations; missing or empty fields fall back to the base (English) text. */
export type Translations<T> = Partial<Record<TranslatedLang, Partial<T>>>

export interface Spec {
  label: string
  value: string
}

export interface Category {
  id: number
  name: string
  slug: string
  image: string | null
  visible: boolean
  sortOrder: number
  translations: Translations<CategoryText>
  productCount?: number
}

export interface Product {
  id: number
  slug: string
  name: string
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  categoryTranslations: Translations<CategoryText>
  price: number
  promoPrice: number | null
  shortDescription: string
  description: string
  specs: Spec[]
  colors: string[]
  images: string[]
  stockStatus: StockStatus
  active: boolean
  featured: boolean
  bestSeller: boolean
  flexiblePayment: boolean
  translations: Translations<ProductText>
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  categoryId: number | null
  price: number
  promoPrice: number | null
  shortDescription: string
  description: string
  specs: Spec[]
  colors: string[]
  images: string[]
  stockStatus: StockStatus
  active: boolean
  featured: boolean
  bestSeller: boolean
  flexiblePayment: boolean
  translations: Translations<ProductText>
}

export interface StoreSettings {
  businessName: string
  logoUrl: string
  description: string
  whatsappNumber: string
  phone: string
  email: string
  address: string
  facebookUrl: string
  instagramUrl: string
  tiktokUrl: string
  currency: string
  promoBanner: string
  heroTitle: string
  heroSubtitle: string
  flexiblePaymentInfo: string
  installmentPercents: number[]
  installmentMonths: number
  metaPixelId: string
  siteUrl: string
  translations: Translations<SettingsText>
}

export type PublicSettings = StoreSettings

export interface HomeData {
  categories: Category[]
  featured: Product[]
  newArrivals: Product[]
  bestSellers: Product[]
  offers: Product[]
  flexible: Product[]
}

export interface ProductList {
  items: Product[]
  total: number
}

export interface AdminUser {
  id: number
  email: string
  role: 'owner' | 'editor'
}

export interface AdminStats {
  totalProducts: number
  activeProducts: number
  outOfStock: number
  totalCategories: number
  featuredProducts: number
  recent: Product[]
  whatsappClicks30d: number
  topClicked: { productId: number; name: string; clicks: number }[]
  topSources: { source: string; clicks: number }[]
}
