import { useState, type FormEvent } from 'react'
import type { Category, CategoryText, Translations } from '../../shared/types'
import { EditIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { thumb } from '../lib/img'
import { existingImages, Field, ImageUploader, Toggle, TranslationFields, uploadPending, useUi, type ImageItem } from './ui'

function CategoryDialog({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi()
  const [name, setName] = useState(category?.name ?? '')
  const [visible, setVisible] = useState(category?.visible ?? true)
  const [translations, setTranslations] = useState<Translations<CategoryText>>(category?.translations ?? {})
  const [images, setImages] = useState<ImageItem[]>(() => existingImages(category?.image ? [category.image] : []))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Enter a category name.')
    setSaving(true)
    setError('')
    try {
      const { urls } = await uploadPending(images)
      const body = { name: name.trim(), visible, image: urls[0] ?? null, translations }
      if (category) await api.put(`/api/admin/categories/${category.id}`, body)
      else await api.post('/api/admin/categories', body)
      toast(category ? 'Category updated.' : 'Category created.')
      onSaved()
    } catch (err) {
      setError((err as ApiError).fields?.name ?? (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-label={category ? 'Edit category' : 'New category'}
        className="card w-full max-w-md space-y-5 p-6 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 className="text-lg font-extrabold text-brand-900">{category ? 'Edit category' : 'New category'}</h2>
        <Field label="Name" htmlFor="cat-name" error={error}>
          <input id="cat-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <div>
          <p className="label">Image (optional)</p>
          <div className="max-w-[9rem]"><ImageUploader single items={images} onChange={setImages} /></div>
        </div>
        <div>
          <p className="label">Translations (optional)</p>
          <TranslationFields<CategoryText> fields={[{ key: 'name', label: 'Name', max: 60 }]} value={translations} onChange={setTranslations} base={{ name }} />
        </div>
        <Toggle checked={visible} onChange={setVisible} label="Visible in the store" description="Hidden categories and their products are not shown to customers." />
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

export default function Categories() {
  const { toast, confirm } = useUi()
  const { data, loading, error, reload } = useAsync(() => api.get<Category[]>('/api/admin/categories'), 'categories')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const remove = async (c: Category) => {
    if (!(await confirm(`Delete the category “${c.name}”?`, { confirmLabel: 'Delete', danger: true }))) return
    try {
      await api.del(`/api/admin/categories/${c.id}`)
      toast('Category deleted.')
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const toggle = async (c: Category) => {
    try {
      await api.put(`/api/admin/categories/${c.id}`, { name: c.name, image: c.image, visible: !c.visible, translations: c.translations })
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900">Categories</h1>
          <p className="text-sm text-muted">Organise your catalogue. Customers can filter products by category.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon width={18} height={18} /> New category
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}

      <div className="card overflow-hidden">
        {loading && !data ? (
          <div className="p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton mb-3 h-14" />)}</div>
        ) : data?.length === 0 ? (
          <p className="px-6 py-14 text-center text-muted">No categories yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data?.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 font-extrabold text-brand-700">
                  {c.image ? <img src={thumb(c.image)} alt="" className="h-full w-full object-cover" /> : c.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{c.productCount ?? 0} active product{c.productCount === 1 ? '' : 's'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={c.visible}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${c.visible ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-500 ring-slate-400/30'}`}
                >
                  {c.visible ? 'Visible' : 'Hidden'}
                </button>
                <button type="button" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:text-brand-700">
                  <EditIcon width={16} height={16} />
                </button>
                <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:border-red-300 hover:text-red-600">
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <CategoryDialog
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
