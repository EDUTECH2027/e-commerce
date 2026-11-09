import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Categories from './Categories'
import Dashboard from './Dashboard'
import AdminLayout from './AdminLayout'
import Login from './Login'
import ProductForm from './ProductForm'
import ProductsList from './ProductsList'
import SettingsPage from './SettingsPage'
import { UiProvider } from './ui'
import { usePageMeta } from '../lib/hooks'

function Guard() {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  return <AdminLayout />
}

export default function AdminApp() {
  usePageMeta({ title: 'Store admin', noindex: true })
  return (
    <AuthProvider>
      <UiProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id" element={<ProductForm />} />
            <Route path="categories" element={<Categories />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </UiProvider>
    </AuthProvider>
  )
}
