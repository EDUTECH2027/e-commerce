import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { computeInstallments } from '../../shared/installments'
import type { Category, Product, ProductInput, ProductText, Spec, Translations } from '../../shared/types'
import { CloseIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { useSettings } from '../context/SettingsContext'
import { api, ApiError } from '../lib/api'
import { formatPrice, parseAmount } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { existingImages, Field, ImageUploader, Section, Toggle, TranslationFields, uploadPending, useUi, type ImageItem, type TranslationField } from './ui'

interface FormState {
  name: string
  categoryId: string
  price: string
  promoPrice: string
  shortDescription: string
  description: string
  specs: Spec[]
  colors: string[]
  stockStatus: ProductInput['stockStatus']
  active: boolean
  featured: boolean
  bestSeller: boolean
  flexiblePayment: boolean
  translations: Translations<ProductText>
}

const PRODUCT_TRANSLATION_FIELDS: TranslationField<ProductText>[] = [
  { key: 'name', label: 'Product name', max: 160 },
  { key: 'shortDescription', label: 'Short description', max: 300 },
  { key: 'description', label: 'Detailed description', multiline: true, max: 10000 },
]

const EMPTY: FormState = {
  name: '',
  categoryId: '',
  price: '',
  promoPrice: '',
  shortDescription: '',
  description: '',
  specs: [],
  colors: [],
  stockStatus: 'in_stock',
  active: true,
  featured: false,
  bestSeller: false,
  flexiblePayment: true,
  translations: {},
}

const fromProduct = (p: Product): FormState => ({
  name: p.name,
  categoryId: p.categoryId ? String(p.categoryId) : '',
  price: String(p.price),
  promoPrice: p.promoPrice ? String(p.promoPrice) : '',
  shortDescription: p.shortDescription,
  description: p.description,
  specs: p.specs,
  colors: p.colors,
  stockStatus: p.stockStatus,
  active: p.active,
  featured: p.featured,
  bestSeller: p.bestSeller,
  flexiblePayment: p.flexiblePayment,
  translations: p.translations,
})

function ColorsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-1.5 pl-3 text-sm font-semibold text-brand-800">
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-brand-100">
              <CloseIcon width={12} height={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        className="input mt-2"
        placeholder="Type a colour and press Enter (e.g. Black)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        maxLength={40}
        aria-label="Add colour"
      />
    </div>
  )
}

function Form({ initial, id }: { initial: Product | null; id: number | null }) {
  const navigate = useNavigate()
  const { toast } = useUi()
  const settings = useSettings()
  const [f, setF] = useState<FormState>(initial ? fromProduct(initial) : EMPTY)
  const [images, setImages] = useState<ImageItem[]>(() => existingImages(initial?.images ?? []))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { data: categories } = useAsync(() => api.get<Category[]>('/api/admin/categories'), 'cats')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setF((s) => ({ ...s, [key]: value }))
    // Editing a field clears its message; the two prices are validated against each other.
    setErrors((e) => {
      const rest: Record<string, string> = { ...e }
      delete rest[key]
      if (key === 'price') delete rest.promoPrice
      return rest
    })
  }
  const price = parseAmount(f.price)
  const promo = parseAmount(f.promoPrice)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (f.name.trim().length < 2) next.name = 'Enter a product name.'
    if (!price) next.price = 'Enter the price.'
    if (price && promo && promo >= price) next.promoPrice = 'The promotional price must be lower than the regular price.'
    if (Object.keys(next).length) {
      setErrors(next)
      document.getElementById(`field-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const uploaded = await uploadPending(images)
      setImages(uploaded.items) // so a retry after a failed save does not upload twice
      const body: ProductInput = {
        name: f.name.trim(),
        categoryId: f.categoryId ? Number(f.categoryId) : null,
        price: price as number,
        promoPrice: promo,
        shortDescription: f.shortDescription.trim(),
        description: f.description.trim(),
        specs: f.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label && s.value),
        colors: f.colors,
        images: uploaded.urls,
        stockStatus: f.stockStatus,
        active: f.active,
        featured: f.featured,
        bestSeller: f.bestSeller,
        flexiblePayment: f.flexiblePayment,
        translations: f.translations,
      }
      if (id) await api.put(`/api/admin/products/${id}`, body)
      else await api.post('/api/admin/products', body)
      toast(id ? 'Product updated.' : 'Product added.')
      navigate('/admin/products')
    } catch (err) {
      const e2 = err as ApiError
      setErrors(e2.fields ?? {})
      toast(e2.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const plans = price ? computeInstallments(promo && promo < price ? promo : price, settings.installmentPercents) : []

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl space-y-6 pb-24">
      <div>
        <Link to="/admin/products" className="text-sm font-semibold text-brand-700">← Products</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-900">{id ? 'Edit product' : 'Add a product'}</h1>
      </div>

      <Section title="Basic information">
        <Field label="Product name" htmlFor="field-name" error={errors.name}>
          <input id="field-name" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={160} placeholder="e.g. Samsung 55-inch Smart TV" />
        </Field>
        <Field label="Category" htmlFor="field-categoryId" error={errors.categoryId}>
          <select id="field-categoryId" className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">No category</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.visible ? '' : ' (hidden)'}</option>
            ))}
          </select>
        </Field>
        <Field label="Short description" hint={`${f.shortDescription.length}/300 – shown on product cards and link previews.`} htmlFor="field-shortDescription" error={errors.shortDescription}>
          <input id="field-shortDescription" className="input" value={f.shortDescription} maxLength={300} onChange={(e) => set('shortDescription', e.target.value)} />
        </Field>
        <Field label="Detailed description" hint="Leave a blank line between paragraphs." htmlFor="field-description" error={errors.description}>
          <textarea id="field-description" className="input min-h-36" rows={6} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </Section>

      <Section title="Pricing" description={`Prices are in ${settings.currency}. Use whole numbers.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Regular price" htmlFor="field-price" error={errors.price} hint={price ? formatPrice(price, settings.currency) : undefined}>
            <input id="field-price" className="input" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^\d\s]/g, ''))} placeholder="300000" />
          </Field>
          <Field label="Promotional price (optional)" htmlFor="field-promoPrice" error={errors.promoPrice} hint={promo ? formatPrice(promo, settings.currency) : 'Leave empty when there is no promotion.'}>
            <input id="field-promoPrice" className="input" inputMode="numeric" value={f.promoPrice} onChange={(e) => set('promoPrice', e.target.value.replace(/[^\d\s]/g, ''))} placeholder="270000" />
          </Field>
        </div>
        <Toggle checked={f.flexiblePayment} onChange={(v) => set('flexiblePayment', v)} label="Show flexible payment information" description="Displays the deposit breakdown on this product and the “Flexible Payment Available” label." />
        {f.flexiblePayment && plans.length > 0 && (
          <div className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
            <p className="font-semibold">Customers will see:</p>
            <ul className="mt-1 space-y-0.5">
              {plans.map((p) => (
                <li key={p.percent}>
                  {p.percent}% → {formatPrice(p.initial, settings.currency)} first, {formatPrice(p.remaining, settings.currency)} remaining
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Photos" description="Add several angles. You will see a preview before saving.">
        <ImageUploader items={images} onChange={setImages} max={8} />
        {errors.images && <p className="text-xs font-medium text-red-600" role="alert">{errors.images}</p>}
      </Section>

      <Section title="Details">
        <div>
          <p className="label">Technical specifications</p>
          <div className="space-y-2">
            {f.specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label="Specification name" className="input" placeholder="e.g. Screen size" value={s.label} onChange={(e) => set('specs', f.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={80} />
                <input aria-label="Specification value" className="input" placeholder="e.g. 55 inches" value={s.value} onChange={(e) => set('specs', f.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} maxLength={300} />
                <button type="button" aria-label="Remove specification" onClick={() => set('specs', f.specs.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-slate-500 hover:border-red-300 hover:text-red-600">
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost mt-2 !min-h-9 !px-3" onClick={() => set('specs', [...f.specs, { label: '', value: '' }])}>
            <PlusIcon width={16} height={16} /> Add specification
          </button>
        </div>
        <div>
          <p className="label">Available colours / variations</p>
          <ColorsInput value={f.colors} onChange={(v) => set('colors', v)} />
        </div>
      </Section>

      <Section title="Translations (optional)" description="Show this product in French and Arabic. Specifications and colours are shown as typed above.">
        <TranslationFields<ProductText>
          fields={PRODUCT_TRANSLATION_FIELDS}
          value={f.translations}
          onChange={(v) => set('translations', v)}
          base={{ name: f.name, shortDescription: f.shortDescription, description: f.description }}
        />
      </Section>

      <Section title="Availability &amp; visibility">
        <Field label="Stock status" htmlFor="field-stock">
          <select id="field-stock" className="input sm:max-w-xs" value={f.stockStatus} onChange={(e) => set('stockStatus', e.target.value as FormState['stockStatus'])}>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Limited stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </Field>
        <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Visible in the store" description="Turn off to hide this product without deleting it." />
        <Toggle checked={f.featured} onChange={(v) => set('featured', v)} label="Featured product" description="Appears in “Featured products” on the homepage." />
        <Toggle checked={f.bestSeller} onChange={(v) => set('bestSeller', v)} label="Best seller" description="Appears in “Best sellers” on the homepage." />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-4xl justify-end gap-3">
          <Link to="/admin/products" className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary min-w-36" disabled={saving}>
            {saving ? 'Saving…' : id ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function ProductForm() {
  const params = useParams()
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null
  const { data, loading, error } = useAsync(
    () => (id ? api.get<Product>(`/api/admin/products/${id}`) : Promise.resolve(null)),
    `product-${id}`,
  )

  if (params.id && !id) return <p className="text-muted">Product not found.</p>
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (loading) return <div className="mx-auto max-w-4xl space-y-4">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-48" />)}</div>
  return <Form key={id ?? 'new'} initial={data ?? null} id={id} />
}
