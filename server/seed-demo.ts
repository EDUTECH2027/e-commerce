/**
 * Optional demo content for trying the store out:  npm run seed:demo
 * Creates sample products with generated illustrations. Delete them from the admin dashboard
 * before going live. Does nothing if the catalogue already contains products.
 */
import { ensureReady } from './bootstrap.js'
import { queryOne } from './db.js'
import { listCategories } from './lib/categories.js'
import { processImage } from './lib/images.js'
import { createProduct } from './lib/products.js'
import { getSettings, saveSettings } from './lib/settings.js'
import type { ProductInput } from '../shared/types.js'

await ensureReady()

if (((await queryOne<{ n: number }>('SELECT COUNT(*)::int AS n FROM products'))?.n ?? 0) > 0) {
  console.log('Products already exist – demo seed skipped.')
  process.exit(0)
}

type Kind = 'tv' | 'fridge' | 'blender' | 'pot' | 'speaker' | 'headphones' | 'fan' | 'kettle'

const PALETTES: Record<Kind, [string, string]> = {
  tv: ['#dbeafe', '#bfdbfe'],
  fridge: ['#e0f2fe', '#bae6fd'],
  blender: ['#fef3c7', '#fde68a'],
  pot: ['#fee2e2', '#fecaca'],
  speaker: ['#ede9fe', '#ddd6fe'],
  headphones: ['#fce7f3', '#fbcfe8'],
  fan: ['#dcfce7', '#bbf7d0'],
  kettle: ['#ffedd5', '#fed7aa'],
}

const art: Record<Kind, string> = {
  tv: `<rect x="170" y="280" width="660" height="400" rx="22" fill="#0f172a"/><rect x="190" y="300" width="620" height="360" rx="10" fill="#1e3a8a"/><path d="M190 560 L420 420 L560 520 L680 440 L810 540 V660 H190Z" fill="#3b82f6" opacity=".55"/><circle cx="700" cy="380" r="34" fill="#fde68a"/><rect x="440" y="680" width="120" height="40" fill="#334155"/><rect x="350" y="720" width="300" height="22" rx="11" fill="#475569"/>`,
  fridge: `<rect x="320" y="130" width="360" height="740" rx="26" fill="#f8fafc" stroke="#94a3b8" stroke-width="8"/><line x1="320" y1="400" x2="680" y2="400" stroke="#94a3b8" stroke-width="8"/><rect x="345" y="220" width="16" height="120" rx="8" fill="#64748b"/><rect x="345" y="450" width="16" height="200" rx="8" fill="#64748b"/><rect x="340" y="150" width="320" height="30" rx="8" fill="#e2e8f0"/>`,
  blender: `<path d="M360 170 H640 L600 560 H400Z" fill="#fff" opacity=".85" stroke="#94a3b8" stroke-width="8"/><path d="M385 380 H615 L600 560 H400Z" fill="#fb923c" opacity=".7"/><rect x="340" y="140" width="320" height="42" rx="14" fill="#334155"/><path d="M400 560 H600 L640 760 H360Z" fill="#475569"/><circle cx="500" cy="660" r="30" fill="#f1f5f9"/><rect x="380" y="780" width="240" height="40" rx="16" fill="#1e293b"/>`,
  pot: `<ellipse cx="500" cy="330" rx="260" ry="46" fill="#94a3b8"/><path d="M240 330 H760 V640 Q760 760 640 760 H360 Q240 760 240 640Z" fill="#475569"/><rect x="130" y="380" width="120" height="34" rx="17" fill="#1e293b"/><rect x="750" y="380" width="120" height="34" rx="17" fill="#1e293b"/><ellipse cx="500" cy="320" rx="230" ry="30" fill="#cbd5e1"/><path d="M280 470 H720" stroke="#64748b" stroke-width="10" opacity=".5"/>`,
  speaker: `<rect x="300" y="150" width="400" height="700" rx="48" fill="#1e1b4b"/><circle cx="500" cy="340" r="95" fill="#312e81" stroke="#818cf8" stroke-width="8"/><circle cx="500" cy="340" r="40" fill="#6366f1"/><circle cx="500" cy="640" r="150" fill="#312e81" stroke="#818cf8" stroke-width="8"/><circle cx="500" cy="640" r="70" fill="#6366f1"/>`,
  headphones: `<path d="M290 560 V470 Q290 250 500 250 Q710 250 710 470 V560" fill="none" stroke="#1e293b" stroke-width="44" stroke-linecap="round"/><rect x="240" y="500" width="130" height="230" rx="56" fill="#be185d"/><rect x="630" y="500" width="130" height="230" rx="56" fill="#be185d"/><rect x="262" y="540" width="40" height="150" rx="20" fill="#831843"/><rect x="698" y="540" width="40" height="150" rx="20" fill="#831843"/>`,
  fan: `<circle cx="500" cy="380" r="230" fill="none" stroke="#475569" stroke-width="10"/><circle cx="500" cy="380" r="150" fill="none" stroke="#94a3b8" stroke-width="6"/><g fill="#16a34a" opacity=".85"><ellipse cx="500" cy="270" rx="46" ry="105"/><ellipse cx="595" cy="435" rx="46" ry="105" transform="rotate(120 595 435)"/><ellipse cx="405" cy="435" rx="46" ry="105" transform="rotate(-120 405 435)"/></g><circle cx="500" cy="380" r="34" fill="#1e293b"/><rect x="480" y="610" width="40" height="190" fill="#475569"/><rect x="360" y="790" width="280" height="40" rx="20" fill="#334155"/>`,
  kettle: `<path d="M330 300 H670 L710 740 Q712 790 660 790 H340 Q288 790 290 740Z" fill="#cbd5e1" stroke="#64748b" stroke-width="8"/><path d="M670 380 Q840 380 840 520 Q840 640 690 640" fill="none" stroke="#1e293b" stroke-width="38" stroke-linecap="round"/><path d="M330 330 Q250 300 215 230" fill="none" stroke="#94a3b8" stroke-width="40" stroke-linecap="round"/><rect x="400" y="230" width="200" height="74" rx="26" fill="#475569"/><rect x="330" y="740" width="340" height="30" rx="15" fill="#334155"/>`,
}

async function image(kind: Kind, label: string): Promise<string> {
  const [a, b] = PALETTES[kind]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="1000" height="1000" fill="url(#g)"/>
    <ellipse cx="500" cy="880" rx="300" ry="26" fill="#0f172a" opacity=".12"/>
    ${art[kind]}
    <text x="500" y="960" font-family="Arial, sans-serif" font-size="30" fill="#475569" text-anchor="middle" opacity=".7">${label}</text>
  </svg>`
  return processImage(Buffer.from(svg))
}

const cats = Object.fromEntries((await listCategories({ visibleOnly: false })).map((c) => [c.name, c.id]))

interface Demo extends Partial<ProductInput> {
  name: string
  cat: string
  price: number
  kind: Kind
  short: string
}

const demos: Demo[] = [
  { name: 'Samsung 55-inch Smart 4K TV', cat: 'Televisions', price: 300000, kind: 'tv', short: '55" Crystal UHD, HDR, built-in streaming apps.', featured: true, bestSeller: true, colors: ['Black'], specs: [{ label: 'Screen size', value: '55 inches' }, { label: 'Resolution', value: '4K Ultra HD (3840 x 2160)' }, { label: 'Smart TV', value: 'Yes – Netflix, YouTube, Prime Video' }, { label: 'Ports', value: '3 x HDMI, 2 x USB' }, { label: 'Warranty', value: '12 months' }] },
  { name: 'LG 43-inch Full HD Smart TV', cat: 'Televisions', price: 185000, promoPrice: 165000, kind: 'tv', short: '43" Full HD with WebOS and Wi-Fi.', featured: true, specs: [{ label: 'Screen size', value: '43 inches' }, { label: 'Resolution', value: 'Full HD (1920 x 1080)' }, { label: 'Smart TV', value: 'WebOS' }] },
  { name: 'Hisense 32-inch HD TV', cat: 'Televisions', price: 95000, kind: 'tv', short: 'Compact 32" HD television, ideal for bedrooms.', stockStatus: 'low_stock' },
  { name: 'Double-Door Refrigerator 400L', cat: 'Refrigerators', price: 420000, kind: 'fridge', short: 'Frost-free, energy efficient, large capacity.', featured: true, bestSeller: true, colors: ['Silver', 'White'], specs: [{ label: 'Capacity', value: '400 litres' }, { label: 'Type', value: 'Double door, frost-free' }, { label: 'Energy rating', value: 'A+' }] },
  { name: 'Top-Freezer Fridge 200L', cat: 'Refrigerators', price: 175000, promoPrice: 155000, kind: 'fridge', short: 'Reliable everyday fridge with freezer compartment.' },
  { name: 'Powerful Blender 1.5L', cat: 'Kitchen Appliances', price: 28000, kind: 'blender', short: '600W blender for smoothies, sauces and more.', bestSeller: true, colors: ['Black', 'Red'] },
  { name: 'Electric Kettle 1.8L', cat: 'Kitchen Appliances', price: 12500, promoPrice: 9900, kind: 'kettle', short: 'Fast-boil stainless steel kettle with auto shut-off.', bestSeller: true },
  { name: 'Non-Stick Cooking Pot Set (5 pcs)', cat: 'Kitchen Utensils', price: 35000, kind: 'pot', short: 'Durable non-stick pots with glass lids.', featured: true, flexiblePayment: false },
  { name: 'Bluetooth Party Speaker', cat: 'Electronics', price: 45000, kind: 'speaker', short: 'Deep bass, 10-hour battery, USB and Bluetooth.', stockStatus: 'low_stock', colors: ['Black'] },
  { name: 'Wireless Headphones', cat: 'Accessories', price: 18000, promoPrice: 14500, kind: 'headphones', short: 'Comfortable over-ear wireless headphones.', flexiblePayment: false },
  { name: 'Standing Fan 18-inch', cat: 'Household Equipment', price: 22000, kind: 'fan', short: 'Quiet, 3-speed fan with adjustable height.', bestSeller: true },
  { name: 'Portable Fan (Out of stock demo)', cat: 'Household Equipment', price: 15000, kind: 'fan', short: 'Rechargeable portable fan.', stockStatus: 'out_of_stock', flexiblePayment: false },
]

// name -> [French name, French short description, Arabic name, Arabic short description]
const TR: Record<string, [string, string, string, string]> = {
  'Samsung 55-inch Smart 4K TV': ['Téléviseur Samsung Smart 4K 55 pouces', 'Crystal UHD 55", HDR, applications de streaming intégrées.', 'تلفاز سامسونج ذكي 4K مقاس 55 بوصة', 'شاشة Crystal UHD مقاس 55 بوصة، HDR، تطبيقات بث مدمجة.'],
  'LG 43-inch Full HD Smart TV': ['Téléviseur LG Smart Full HD 43 pouces', '43" Full HD avec WebOS et Wi-Fi.', 'تلفاز إل جي ذكي Full HD مقاس 43 بوصة', 'شاشة 43 بوصة Full HD مع WebOS وواي فاي.'],
  'Hisense 32-inch HD TV': ['Téléviseur Hisense HD 32 pouces', 'Téléviseur HD compact de 32", idéal pour les chambres.', 'تلفاز هايسنس HD مقاس 32 بوصة', 'تلفاز HD صغير الحجم مقاس 32 بوصة، مثالي لغرف النوم.'],
  'Double-Door Refrigerator 400L': ['Réfrigérateur double porte 400 L', 'No frost, économe en énergie, grande capacité.', 'ثلاجة بابين 400 لتر', 'نظام بدون تجمد، موفرة للطاقة، سعة كبيرة.'],
  'Top-Freezer Fridge 200L': ['Réfrigérateur 200 L avec congélateur', 'Réfrigérateur fiable au quotidien avec compartiment congélateur.', 'ثلاجة 200 لتر مع فريزر علوي', 'ثلاجة موثوقة للاستخدام اليومي مع حجرة تجميد.'],
  'Powerful Blender 1.5L': ['Blender puissant 1,5 L', 'Blender 600 W pour smoothies, sauces et plus encore.', 'خلاط قوي سعة 1.5 لتر', 'خلاط 600 واط للعصائر والصلصات وغيرها.'],
  'Electric Kettle 1.8L': ['Bouilloire électrique 1,8 L', 'Bouilloire inox à ébullition rapide avec arrêt automatique.', 'غلاية كهربائية 1.8 لتر', 'غلاية ستانلس ستيل سريعة الغليان مع إيقاف تلقائي.'],
  'Non-Stick Cooking Pot Set (5 pcs)': ['Set de casseroles antiadhésives (5 pièces)', 'Casseroles antiadhésives durables avec couvercles en verre.', 'طقم أواني طهي غير لاصقة (5 قطع)', 'أواني متينة غير لاصقة مع أغطية زجاجية.'],
  'Bluetooth Party Speaker': ['Enceinte de soirée Bluetooth', "Basses profondes, 10 h d'autonomie, USB et Bluetooth.", 'مكبر صوت بلوتوث للحفلات', 'باس عميق، بطارية تدوم 10 ساعات، USB وبلوتوث.'],
  'Wireless Headphones': ['Casque sans fil', 'Casque circum-aural sans fil confortable.', 'سماعات رأس لاسلكية', 'سماعات لاسلكية مريحة تغطي الأذنين.'],
  'Standing Fan 18-inch': ['Ventilateur sur pied 18 pouces', 'Ventilateur silencieux à 3 vitesses, hauteur réglable.', 'مروحة واقفة 18 بوصة', 'مروحة هادئة بثلاث سرعات وارتفاع قابل للتعديل.'],
  'Portable Fan (Out of stock demo)': ['Ventilateur portable (démo rupture de stock)', 'Ventilateur portable rechargeable.', 'مروحة محمولة (مثال لنفاد المخزون)', 'مروحة محمولة قابلة للشحن.'],
}
const FR_BODY = '\n\nUn excellent ajout à votre maison. Contactez-nous sur WhatsApp pour confirmer la disponibilité, la livraison et nos facilités de paiement.'
const AR_BODY = '\n\nإضافة رائعة لمنزلك. تواصل معنا عبر واتساب لتأكيد التوفر والتوصيل وخيارات الدفع المرنة.'

for (const d of demos) {
  const img = await image(d.kind, d.name.length > 34 ? d.name.slice(0, 33) + '…' : d.name)
  const [frName, frShort, arName, arShort] = TR[d.name] ?? [d.name, d.short, d.name, d.short]
  await createProduct({
    name: d.name,
    categoryId: cats[d.cat] ?? null,
    price: d.price,
    promoPrice: d.promoPrice ?? null,
    shortDescription: d.short,
    description:
      `${d.short}\n\nA great addition to your home. Contact us on WhatsApp to confirm availability, delivery and our flexible payment options.`,
    specs: d.specs ?? [],
    colors: d.colors ?? [],
    images: [img],
    stockStatus: d.stockStatus ?? 'in_stock',
    active: true,
    featured: d.featured ?? false,
    bestSeller: d.bestSeller ?? false,
    flexiblePayment: d.flexiblePayment ?? true,
    translations: {
      fr: { name: frName, shortDescription: frShort, description: frShort + FR_BODY },
      ar: { name: arName, shortDescription: arShort, description: arShort + AR_BODY },
    },
  })
}

const settings = await getSettings()
if (!settings.whatsappNumber) await saveSettings({ ...settings, whatsappNumber: '237670000000', phone: '+237 670 00 00 00', address: 'Douala, Cameroon' })
console.log(`Created ${demos.length} demo products (demo WhatsApp number 237670000000 – change it in Settings).`)
process.exit(0)
