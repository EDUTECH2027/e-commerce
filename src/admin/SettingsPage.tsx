import { useState, type FormEvent } from 'react'
import { isValidWhatsAppNumber } from '../../shared/phone'
import type { AdminUser, SettingsText, StoreSettings } from '../../shared/types'
import { ExternalIcon, TrashIcon } from '../components/Icons'
import { useSetSettings, useSettings } from '../context/SettingsContext'
import { api, ApiError } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { generalMessage, waLink } from '../lib/whatsapp'
import { useAuth } from './auth'
import { existingImages, Field, ImageUploader, Section, TranslationFields, uploadPending, useUi, type ImageItem, type TranslationField } from './ui'

const SETTINGS_TRANSLATION_FIELDS: TranslationField<SettingsText>[] = [
  { key: 'promoBanner', label: 'Top announcement bar', max: 200 },
  { key: 'heroTitle', label: 'Main headline', max: 120 },
  { key: 'heroSubtitle', label: 'Supporting text', multiline: true, max: 400 },
  { key: 'description', label: 'Business description', multiline: true, max: 500 },
  { key: 'flexiblePaymentInfo', label: 'Flexible payment explanation', multiline: true, max: 800 },
]

function StoreSettingsForm() {
  const current = useSettings()
  const setSettings = useSetSettings()
  const { toast } = useUi()
  const [s, setS] = useState<StoreSettings>(current)
  const [percents, setPercents] = useState(current.installmentPercents.join(', '))
  const [logo, setLogo] = useState<ImageItem[]>(() => existingImages(current.logoUrl ? [current.logoUrl] : []))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS((x) => ({ ...x, [k]: v }))
  const text = (k: keyof StoreSettings) => ({
    value: s[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const list = percents.split(/[,\s]+/).filter(Boolean).map(Number)
    const next: Record<string, string> = {}
    if (!list.length || list.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) next.installmentPercents = 'Enter whole percentages between 1 and 99, e.g. 30, 40.'
    if (s.whatsappNumber.trim() && !isValidWhatsAppNumber(s.whatsappNumber)) next.whatsappNumber = 'Enter the number with its country code, e.g. 237670000000.'
    if (Object.keys(next).length) {
      setErrors(next)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const { urls, items } = await uploadPending(logo)
      setLogo(items)
      const saved = await api.put<StoreSettings>('/api/admin/settings', { ...s, installmentPercents: list, logoUrl: urls[0] ?? '' })
      setSettings(saved)
      setS(saved)
      toast('Settings saved.')
    } catch (err) {
      const e2 = err as ApiError
      setErrors(e2.fields ?? {})
      toast(e2.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const testLink = s.whatsappNumber && isValidWhatsAppNumber(s.whatsappNumber) ? waLink(s, generalMessage('en')) : null

  return (
    <form onSubmit={submit} noValidate className="space-y-6 pb-24">
      <Section title="Business">
        <Field label="Business name" htmlFor="businessName" error={errors.businessName}>
          <input id="businessName" className="input" maxLength={80} {...text('businessName')} />
        </Field>
        <div>
          <p className="label">Logo</p>
          <div className="max-w-[10rem]"><ImageUploader single items={logo} onChange={setLogo} /></div>
          <p className="hint">Shown in the header. A wide logo on a transparent or white background works best.</p>
        </div>
        <Field label="Business description" hint="Used in the footer and when your store is shared." htmlFor="description" error={errors.description}>
          <textarea id="description" className="input" rows={3} maxLength={500} {...text('description')} />
        </Field>
      </Section>

      <Section title="WhatsApp &amp; contact" description="Customers reach you on this WhatsApp number. You can change it at any time; no code changes needed.">
        <Field label="WhatsApp number" htmlFor="whatsappNumber" error={errors.whatsappNumber} hint="Include the country code, digits only. Example for Cameroon: 237670000000.">
          <input id="whatsappNumber" className="input" inputMode="tel" placeholder="237670000000" {...text('whatsappNumber')} />
        </Field>
        {testLink && (
          <a href={testLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary !min-h-9 w-fit !px-3">
            <ExternalIcon width={16} height={16} /> Test this number on WhatsApp
          </a>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone number" htmlFor="phone" error={errors.phone}>
            <input id="phone" className="input" inputMode="tel" {...text('phone')} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <input id="email" type="email" className="input" {...text('email')} />
          </Field>
        </div>
        <Field label="Business address" htmlFor="address" error={errors.address}>
          <input id="address" className="input" maxLength={200} {...text('address')} />
        </Field>
      </Section>

      <Section title="Social media" description="Leave empty to hide an icon.">
        <Field label="Facebook page" htmlFor="facebookUrl" error={errors.facebookUrl}>
          <input id="facebookUrl" type="url" className="input" placeholder="https://facebook.com/yourpage" {...text('facebookUrl')} />
        </Field>
        <Field label="Instagram" htmlFor="instagramUrl" error={errors.instagramUrl}>
          <input id="instagramUrl" type="url" className="input" placeholder="https://instagram.com/yourpage" {...text('instagramUrl')} />
        </Field>
        <Field label="TikTok" htmlFor="tiktokUrl" error={errors.tiktokUrl}>
          <input id="tiktokUrl" type="url" className="input" placeholder="https://tiktok.com/@yourpage" {...text('tiktokUrl')} />
        </Field>
      </Section>

      <Section title="Homepage messages">
        <Field label="Top announcement bar" hint="A short message shown above the menu. Leave empty to hide it." htmlFor="promoBanner" error={errors.promoBanner}>
          <input id="promoBanner" className="input" maxLength={200} {...text('promoBanner')} />
        </Field>
        <Field label="Main headline" htmlFor="heroTitle" error={errors.heroTitle}>
          <input id="heroTitle" className="input" maxLength={120} {...text('heroTitle')} />
        </Field>
        <Field label="Supporting text" htmlFor="heroSubtitle" error={errors.heroSubtitle}>
          <textarea id="heroSubtitle" className="input" rows={3} maxLength={400} {...text('heroSubtitle')} />
        </Field>
      </Section>

      <Section title="Translations" description="The homepage messages, description and payment explanation in French and Arabic. Visitors choose their language in the site header.">
        <TranslationFields<SettingsText>
          fields={SETTINGS_TRANSLATION_FIELDS}
          value={s.translations}
          onChange={(v) => set('translations', v)}
          base={{ promoBanner: s.promoBanner, heroTitle: s.heroTitle, heroSubtitle: s.heroSubtitle, description: s.description, flexiblePaymentInfo: s.flexiblePaymentInfo }}
        />
      </Section>

      <Section title="Flexible payment" description="This is information only. Payments are never processed on the website.">
        <Field label="Explanation shown to customers" htmlFor="flexiblePaymentInfo" error={errors.flexiblePaymentInfo}>
          <textarea id="flexiblePaymentInfo" className="input" rows={4} maxLength={800} {...text('flexiblePaymentInfo')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Initial payment options (%)" htmlFor="installmentPercents" error={errors.installmentPercents} hint="Separate with commas, e.g. 30, 40">
            <input id="installmentPercents" className="input" value={percents} onChange={(e) => setPercents(e.target.value)} />
          </Field>
          <Field label="Maximum repayment period (months)" htmlFor="installmentMonths" error={errors.installmentMonths}>
            <input id="installmentMonths" type="number" min={1} max={12} className="input" value={s.installmentMonths} onChange={(e) => set('installmentMonths', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Currency label" htmlFor="currency" error={errors.currency}>
          <input id="currency" className="input sm:max-w-[10rem]" maxLength={10} {...text('currency')} />
        </Field>
      </Section>

      <Section title="Advertising &amp; tracking" description="Optional. Prepare your store for Facebook and Instagram ads.">
        <Field label="Meta Pixel ID" htmlFor="metaPixelId" error={errors.metaPixelId} hint="Find it in Meta Events Manager. Once saved, the store reports page views, product views and WhatsApp clicks.">
          <input id="metaPixelId" className="input sm:max-w-sm" inputMode="numeric" placeholder="123456789012345" {...text('metaPixelId')} />
        </Field>
        <Field label="Website address" htmlFor="siteUrl" error={errors.siteUrl} hint="Your public domain, e.g. https://www.mystore.com. Used in WhatsApp product links and link previews. Leave empty to detect it automatically.">
          <input id="siteUrl" type="url" className="input" placeholder="https://www.mystore.com" {...text('siteUrl')} />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl justify-end">
          <button type="submit" className="btn btn-primary min-w-40" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { toast } = useUi()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/auth/password', { currentPassword: current, newPassword: next })
      toast('Password changed.')
      setCurrent('')
      setNext('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <Section title="My account" description="Change your sign-in password.">
        <Field label="Current password" htmlFor="curpw">
          <input id="curpw" type="password" autoComplete="current-password" className="input sm:max-w-sm" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="newpw" hint="At least 10 characters." error={error}>
          <input id="newpw" type="password" autoComplete="new-password" className="input sm:max-w-sm" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary w-fit" disabled={busy || !current || next.length < 10}>{busy ? 'Saving…' : 'Change password'}</button>
      </Section>
    </form>
  )
}

function Team() {
  const { user } = useAuth()
  const { toast, confirm } = useUi()
  const { data, reload } = useAsync(() => api.get<AdminUser[]>('/api/admin/users'), 'users')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/api/admin/users', { email, password, role: 'editor' })
      toast('Team member added.')
      setEmail('')
      setPassword('')
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const remove = async (u: AdminUser) => {
    if (!(await confirm(`Remove ${u.email}?`, { confirmLabel: 'Remove', danger: true }))) return
    try {
      await api.del(`/api/admin/users/${u.id}`)
      reload()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <Section title="Team" description="Editors can manage products and categories but cannot change store settings or team members.">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {data?.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 truncate font-medium">{u.email}</span>
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 capitalize">{u.role}</span>
              {u.id !== user?.id && (
                <button type="button" onClick={() => remove(u)} aria-label={`Remove ${u.email}`} className="text-slate-400 hover:text-red-600">
                  <TrashIcon width={16} height={16} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input aria-label="Editor email" type="email" required className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input aria-label="Temporary password" type="password" required minLength={10} autoComplete="new-password" className="input" placeholder="Password (10+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" className="btn btn-primary">Add editor</button>
        {error && <p role="alert" className="text-xs font-medium text-red-600 sm:col-span-3">{error}</p>}
      </form>
    </Section>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Settings</h1>
        <p className="text-sm text-muted">{isOwner ? 'Everything about your store, in one place.' : 'Only the store owner can change store settings.'}</p>
      </div>
      {isOwner && <StoreSettingsForm />}
      <PasswordForm />
      {isOwner && <Team />}
    </div>
  )
}
