import { z } from 'zod'
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from '../shared/phone.ts'
import { isStoredImageUrl } from './lib/images.ts'

const imageUrl = z.string().refine(isStoredImageUrl, 'Invalid image reference.')
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Must start with http:// or https://')

const str = (max: number) => z.string().trim().max(max)
const translationsOf = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ fr: z.object(shape).partial().optional(), ar: z.object(shape).partial().optional() }).default({})

const productTranslations = translationsOf({ name: str(160), shortDescription: str(300), description: str(10_000) })
const categoryTranslations = translationsOf({ name: str(60) })
const settingsTranslations = translationsOf({
  description: str(500),
  promoBanner: str(200),
  heroTitle: str(120),
  heroSubtitle: str(400),
  flexiblePaymentInfo: str(800),
})

export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a product name.').max(160),
    categoryId: z.number().int().positive().nullable(),
    price: z.number().int('Use whole numbers.').min(1, 'Enter a price.').max(1_000_000_000),
    promoPrice: z.number().int().min(1).max(1_000_000_000).nullable(),
    shortDescription: z.string().trim().max(300).default(''),
    description: z.string().trim().max(10_000).default(''),
    specs: z
      .array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) }))
      .max(40),
    colors: z.array(z.string().trim().min(1).max(40)).max(20),
    images: z.array(imageUrl).max(10),
    stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
    active: z.boolean(),
    featured: z.boolean(),
    bestSeller: z.boolean(),
    flexiblePayment: z.boolean(),
    translations: productTranslations,
  })
  .refine((p) => p.promoPrice === null || p.promoPrice < p.price, {
    message: 'The promotional price must be lower than the regular price.',
    path: ['promoPrice'],
  })

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Enter a category name.').max(60),
  image: imageUrl.nullable(),
  visible: z.boolean(),
  translations: categoryTranslations,
})

export const patchProductSchema = z
  .object({
    active: z.boolean(),
    featured: z.boolean(),
    bestSeller: z.boolean(),
    stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
  })
  .partial()

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1, 'Enter your business name.').max(80),
  logoUrl: z.string().refine((v) => v === '' || isStoredImageUrl(v), 'Invalid logo.'),
  description: z.string().trim().max(500),
  whatsappNumber: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidWhatsAppNumber(v), 'Enter a valid WhatsApp number with country code, e.g. 237670000000.')
    .transform((v) => (v === '' ? '' : normalizeWhatsAppNumber(v))),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(120).refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email.'),
  address: z.string().trim().max(200),
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  currency: z.string().trim().min(1).max(10),
  promoBanner: z.string().trim().max(200),
  heroTitle: z.string().trim().min(1).max(120),
  heroSubtitle: z.string().trim().max(400),
  flexiblePaymentInfo: z.string().trim().max(800),
  installmentPercents: z.array(z.number().int().min(1).max(99)).min(1).max(4),
  installmentMonths: z.number().int().min(1).max(12),
  metaPixelId: z.string().trim().refine((v) => v === '' || /^\d{5,20}$/.test(v), 'The Pixel ID is a number of 5–20 digits.'),
  siteUrl: optionalUrl.transform((v) => v.replace(/\/+$/, '')),
  translations: settingsTranslations,
})

export const loginSchema = z.object({ email: z.string().trim().email().max(120), password: z.string().min(1).max(200) })

export const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, 'Use at least 10 characters.').max(200),
})

export const newUserSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
  role: z.enum(['owner', 'editor']).default('editor'),
})

export const trackSchema = z.object({
  action: z.enum(['order', 'share', 'contact']),
  productId: z.number().int().positive().nullable().optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(150).optional(),
})
