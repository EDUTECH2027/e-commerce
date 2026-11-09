import { useEffect } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router-dom'
import { useLocalizedCategories, useI18n } from '../i18n/I18nContext'
import { trackPageView } from '../lib/tracking'
import { useCategories } from '../lib/useCategories'
import { Footer } from './Footer'
import { Header } from './Header'
import { FloatingWhatsApp } from './WhatsAppButton'

export function Layout() {
  const categories = useLocalizedCategories(useCategories())
  const { t } = useI18n()
  const { pathname } = useLocation()
  const onProductPage = !!useMatch('/products/:slug')

  // Single-page app: reset scroll and report a Pixel PageView on each navigation.
  useEffect(() => {
    window.scrollTo(0, 0)
    trackPageView()
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        {t('skip')}
      </a>
      <Header categories={categories} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer categories={categories} />
      <FloatingWhatsApp hideOnMobile={onProductPage} />
    </div>
  )
}
