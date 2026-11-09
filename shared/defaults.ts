import type { SettingsText, StoreSettings } from './types.js'

export const DEFAULT_SETTINGS: StoreSettings = {
  businessName: 'Moussa Store',
  logoUrl: '',
  description:
    'Quality televisions, electronics, kitchen appliances and household products. Order easily on WhatsApp with flexible payment options.',
  whatsappNumber: '',
  phone: '',
  email: '',
  address: '',
  facebookUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
  currency: 'FCFA',
  promoBanner: 'Flexible payment available: start with 30% or 40% and take your product home today!',
  heroTitle: 'Your Favourite Products, Now Within Reach!',
  heroSubtitle:
    'Discover quality electronics, kitchen appliances and household products. Get in touch with us on WhatsApp and explore our flexible payment options.',
  flexiblePaymentInfo:
    'Pay 30% or 40% upfront and take your product home after the initial payment. The balance can be settled over a maximum of three months. All arrangements are discussed and agreed directly with us on WhatsApp.',
  installmentPercents: [30, 40],
  installmentMonths: 3,
  metaPixelId: '',
  siteUrl: '',
  translations: {},
}

/**
 * French and Arabic versions of the default texts above. They are only used while the English text is still the
 * default (see withDefaultTranslations), so they can never contradict wording the owner has changed.
 */
export const DEFAULT_TRANSLATIONS: Record<'fr' | 'ar', SettingsText> = {
  fr: {
    promoBanner: "Paiement flexible disponible : commencez avec 30 % ou 40 % et repartez avec votre produit dès aujourd'hui !",
    heroTitle: 'Vos produits préférés, enfin à portée de main !',
    heroSubtitle:
      "Découvrez des appareils électroniques, de l'électroménager et des articles pour la maison de qualité. Contactez-nous sur WhatsApp et découvrez nos facilités de paiement.",
    description:
      "Téléviseurs, appareils électroniques, électroménager et articles pour la maison de qualité. Commandez facilement sur WhatsApp avec des facilités de paiement.",
    flexiblePaymentInfo:
      "Versez 30 % ou 40 % d'avance et repartez avec votre produit après le premier versement. Le solde peut être réglé sur trois mois au maximum. Toutes les modalités sont discutées et convenues directement avec nous sur WhatsApp.",
  },
  ar: {
    promoBanner: 'الدفع المرن متاح: ابدأ بدفع 30% أو 40% وخذ منتجك إلى منزلك اليوم!',
    heroTitle: 'منتجاتك المفضلة، أصبحت في متناول يدك!',
    heroSubtitle:
      'اكتشف إلكترونيات وأجهزة مطبخ ومنتجات منزلية عالية الجودة. تواصل معنا عبر واتساب واطّلع على خيارات الدفع المرنة لدينا.',
    description:
      'تلفزيونات وإلكترونيات وأجهزة مطبخ ومنتجات منزلية عالية الجودة. اطلب بسهولة عبر واتساب مع خيارات دفع مرنة.',
    flexiblePaymentInfo:
      'ادفع 30% أو 40% مقدمًا وخذ منتجك إلى منزلك بعد الدفعة الأولى. يمكن تسديد الباقي خلال ثلاثة أشهر كحد أقصى. تتم مناقشة جميع الترتيبات والاتفاق عليها مباشرة معنا عبر واتساب.',
  },
}

const TEXT_KEYS = ['promoBanner', 'heroTitle', 'heroSubtitle', 'description', 'flexiblePaymentInfo'] as const

/** Fills in the built-in French/Arabic text for any default English text the owner has not changed or translated. */
export function withDefaultTranslations(settings: StoreSettings): StoreSettings {
  const translations: StoreSettings['translations'] = { fr: { ...settings.translations.fr }, ar: { ...settings.translations.ar } }
  for (const lang of ['fr', 'ar'] as const) {
    for (const key of TEXT_KEYS) {
      const entry = translations[lang]!
      if (!entry[key]?.trim() && settings[key] === DEFAULT_SETTINGS[key]) entry[key] = DEFAULT_TRANSLATIONS[lang][key]
    }
  }
  return { ...settings, translations }
}
