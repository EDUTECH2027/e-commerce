import { NavLink, Outlet } from 'react-router-dom'
import { BoxIcon, ExternalIcon, GridIcon, HomeIcon, LogoutIcon, SettingsIcon } from '../components/Icons'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from './auth'

const links = [
  { to: '/admin', label: 'Dashboard', icon: <HomeIcon />, end: true },
  { to: '/admin/products', label: 'Products', icon: <BoxIcon /> },
  { to: '/admin/categories', label: 'Categories', icon: <GridIcon /> },
  { to: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { businessName } = useSettings()

  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
      isActive ? 'bg-white/15 text-white' : 'text-brand-200 hover:bg-white/10 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="bg-brand-900 text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-6 lg:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-extrabold text-brand-900">
              {businessName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{businessName}</p>
              <p className="text-xs text-brand-300">Admin</p>
            </div>
          </div>
          <nav aria-label="Admin" className="no-scrollbar -mx-1 hidden gap-1 lg:flex lg:flex-col">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={item}>
                {l.icon} {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch">
            <a href="/" target="_blank" rel="noopener noreferrer" className={item({ isActive: false }) + ' max-lg:!px-3'}>
              <ExternalIcon /> <span className="max-sm:sr-only">View store</span>
            </a>
            <button type="button" onClick={logout} className={item({ isActive: false }) + ' max-lg:!px-3'}>
              <LogoutIcon /> <span className="max-sm:sr-only">Sign out</span>
            </button>
            <p className="hidden truncate px-3.5 text-xs text-brand-300 lg:block">{user?.email} · {user?.role}</p>
          </div>
        </div>
        <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2 lg:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={item}>
              {l.icon} {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
