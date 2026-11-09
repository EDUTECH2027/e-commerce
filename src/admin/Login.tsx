import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from './auth'
import { Field } from './ui'

export default function Login() {
  const { user, login } = useAuth()
  const { businessName } = useSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/admin" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7 animate-fade-up" noValidate>
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-800 text-xl font-extrabold text-white">
            {businessName.charAt(0).toUpperCase()}
          </span>
          <h1 className="mt-3 text-xl font-extrabold text-brand-900">Store admin</h1>
          <p className="text-sm text-muted">Sign in to manage {businessName}</p>
        </div>
        <div className="space-y-4">
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
