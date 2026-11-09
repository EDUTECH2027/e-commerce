import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './context/SettingsContext.tsx'
import { I18nProvider } from './i18n/I18nContext.tsx'
import { captureUtm } from './lib/tracking.ts'

// Remember ad-campaign parameters (utm_*, fbclid) from the landing URL before anything navigates.
captureUtm()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
