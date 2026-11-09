/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import { LANG_LABEL, TRANSLATED_LANGS, type TranslatedLang } from '../../shared/lang'
import type { Translations } from '../../shared/types'
import { api } from '../lib/api'
import { CheckIcon, CloseIcon, ImageIcon, PlusIcon } from '../components/Icons'
import { thumb } from '../lib/img'

/* ---------------- Toasts + confirm dialog ---------------- */

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}
interface ConfirmState {
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}
interface UiCtx {
  toast: (message: string, type?: Toast['type']) => void
  confirm: (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>
}

const UiContext = createContext<UiCtx | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<ConfirmState | null>(null)
  const nextId = useRef(1)

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 7000 : 3500)
  }, [])

  const confirm = useCallback<UiCtx['confirm']>(
    (message, opts) =>
      new Promise((resolve) =>
        setDialog({ message, confirmLabel: opts?.confirmLabel ?? 'Confirm', danger: opts?.danger ?? false, resolve }),
      ),
    [],
  )
  const close = (ok: boolean) => {
    dialog?.resolve(ok)
    setDialog(null)
  }

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift animate-fade-up ${t.type === 'error' ? 'bg-red-600' : 'bg-brand-900'}`}
          >
            {t.type === 'success' ? <CheckIcon width={18} height={18} /> : <CloseIcon width={18} height={18} />}
            {t.message}
          </div>
        ))}
      </div>
      {dialog && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4" onClick={() => close(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Please confirm"
            className="card w-full max-w-sm p-6 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && close(false)}
          >
            <p className="text-base font-semibold text-ink">{dialog.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                Cancel
              </button>
              <button type="button" autoFocus className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi(): UiCtx {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used inside UiProvider')
  return ctx
}

/* ---------------- Form primitives ---------------- */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-700' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-brand-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

/* ---------------- Image uploader ---------------- */

export interface ImageItem {
  key: string
  /** Already-stored image (path under /uploads). */
  url?: string
  /** Newly chosen file, uploaded only when the form is saved. */
  file?: File
  /** What to show: the stored thumbnail or a local blob preview. */
  preview: string
}

let keySeq = 0
export const existingImages = (urls: string[]): ImageItem[] =>
  urls.map((url) => ({ key: `u${keySeq++}`, url, preview: thumb(url) }))

/** Uploads the new files in one request and returns the final ordered list of stored URLs. */
export async function uploadPending(items: ImageItem[]): Promise<{ urls: string[]; items: ImageItem[] }> {
  const files = items.filter((i) => i.file).map((i) => i.file as File)
  const uploaded = files.length ? await api.upload(files) : []
  let n = 0
  const resolved = items.map((i) => (i.file ? { key: i.key, url: uploaded[n++], preview: thumb(uploaded[n - 1]) } : i))
  return { urls: resolved.map((i) => i.url as string), items: resolved }
}

export function ImageUploader({ items, onChange, max = 8, single = false, label }: {
  items: ImageItem[]
  onChange: (items: ImageItem[]) => void
  max?: number
  single?: boolean
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState('')
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Free blob URLs when the component goes away.
  useEffect(
    () => () => {
      for (const i of itemsRef.current) if (i.file) URL.revokeObjectURL(i.preview)
    },
    [],
  )

  const add = (list: FileList | File[]) => {
    setProblem('')
    const files = Array.from(list)
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length < files.length) setProblem('Only image files (JPG, PNG, WebP) can be added.')
    const tooBig = images.filter((f) => f.size > 10 * 1024 * 1024)
    if (tooBig.length) setProblem('Each image must be smaller than 10 MB.')
    const ok = images.filter((f) => f.size <= 10 * 1024 * 1024)
    const fresh = ok.map<ImageItem>((file) => ({ key: `n${keySeq++}`, file, preview: URL.createObjectURL(file) }))
    if (single) {
      for (const i of items) if (i.file) URL.revokeObjectURL(i.preview)
      onChange(fresh.slice(0, 1))
      return
    }
    const room = max - items.length
    if (fresh.length > room) setProblem(`You can add up to ${max} images.`)
    onChange([...items, ...fresh.slice(0, Math.max(room, 0))])
  }

  const remove = (key: string) => {
    const gone = items.find((i) => i.key === key)
    if (gone?.file) URL.revokeObjectURL(gone.preview)
    onChange(items.filter((i) => i.key !== key))
  }
  const move = (index: number, dir: -1 | 1) => {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    add(e.dataTransfer.files)
  }

  return (
    <div>
      {label && <p className="label">{label}</p>}
      <ul className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
        {items.map((it, i) => (
          <li key={it.key} className="group relative overflow-hidden rounded-xl border border-line bg-surface">
            <img src={it.preview} alt={`Image ${i + 1}`} className="aspect-square w-full object-contain p-1.5" />
            {!single && i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-brand-800 px-2 py-0.5 text-[10px] font-bold text-white">MAIN</span>}
            {it.file && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">NEW</span>}
            <button type="button" onClick={() => remove(it.key)} aria-label={`Remove image ${i + 1}`} className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-red-600 shadow hover:bg-white">
              <CloseIcon width={14} height={14} />
            </button>
            {!single && items.length > 1 && (
              <div className="absolute right-1.5 bottom-1.5 flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier" className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-xs font-bold shadow disabled:opacity-30">
                  ‹
                </button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move later" className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-xs font-bold shadow disabled:opacity-30">
                  ›
                </button>
              </div>
            )}
          </li>
        ))}
        {(single ? items.length === 0 : items.length < max) && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-semibold transition ${dragging ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-muted hover:border-brand-400 hover:text-brand-700'}`}
            >
              {items.length === 0 ? <ImageIcon width={24} height={24} /> : <PlusIcon width={24} height={24} />}
              {single ? 'Choose image' : 'Add images'}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={!single}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) add(e.target.files)
          e.target.value = ''
        }}
      />
      {problem && <p className="mt-2 text-xs font-medium text-red-600" role="alert">{problem}</p>}
      {!single && <p className="hint">The first image is the main photo shown on cards and in link previews. Images are optimised automatically.</p>}
    </div>
  )
}

/* ---------------- Translation editor ---------------- */

export interface TranslationField<T> {
  key: keyof T & string
  label: string
  multiline?: boolean
  max: number
}

/**
 * Tabs for the French and Arabic versions of owner-entered text. Empty fields fall back to the base (English)
 * text on the storefront, which is shown as the placeholder.
 */
export function TranslationFields<T extends object>({ fields, value, onChange, base }: {
  fields: TranslationField<T>[]
  value: Translations<T>
  onChange: (v: Translations<T>) => void
  base: Partial<Record<keyof T & string, string>>
}) {
  const [tab, setTab] = useState<TranslatedLang>('fr')
  const uid = useId()
  const current = (value[tab] ?? {}) as Partial<Record<string, string>>
  const set = (key: string, text: string) => onChange({ ...value, [tab]: { ...(value[tab] ?? {}), [key]: text } })

  return (
    <div>
      <div role="tablist" aria-label="Translation language" className="mb-4 flex gap-2">
        {TRANSLATED_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={tab === l}
            onClick={() => setTab(l)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === l ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-white hover:border-brand-300'}`}
          >
            {LANG_LABEL[l]}
            {fields.some((f) => (value[l] as Partial<Record<string, string>> | undefined)?.[f.key]?.trim()) && (
              <span aria-label="has translation" className="ms-1.5 text-emerald-500">●</span>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-4" role="tabpanel">
        {fields.map((f) => {
          const id = `${uid}-${tab}-${f.key}`
          const shared = {
            id,
            lang: tab,
            dir: (tab === 'ar' ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
            maxLength: f.max,
            placeholder: base[f.key] ?? '',
            value: current[f.key] ?? '',
            onChange: (e: { target: { value: string } }) => set(f.key, e.target.value),
          }
          return (
            <div key={f.key}>
              <label className="label" htmlFor={id}>{f.label}</label>
              {f.multiline ? <textarea className="input min-h-28" rows={4} {...shared} /> : <input className="input" {...shared} />}
            </div>
          )
        })}
      </div>
      <p className="hint">Leave a field empty to show the English text to {LANG_LABEL[tab]}-speaking visitors.</p>
    </div>
  )
}
