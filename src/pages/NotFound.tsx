import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { usePageMeta } from '../lib/hooks'

export default function NotFound({ message }: { message?: string }) {
  const { t } = useI18n()
  usePageMeta({ title: t('nf.page'), noindex: true })
  return (
    <div className="container-page py-24 text-center">
      <p className="text-6xl font-black text-brand-100">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-brand-900">{t('nf.title')}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">{message ?? t('nf.text')}</p>
      <Link to="/products" className="btn btn-primary mt-6">{t('nf.cta')}</Link>
    </div>
  )
}
