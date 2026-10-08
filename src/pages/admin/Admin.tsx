import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from '../../lib/supabase'
import { Notice, Spinner } from '../../components/ui'
import { TextField } from '../../components/fields'
import AdminArea from './AdminArea'

export default function Admin() {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(isConfigured ? undefined : null)
  const [adminCheck, setAdminCheck] = useState<{ uid: string; ok: boolean } | null>(null)

  useEffect(() => {
    document.title = 'Admin | NEXUS-E'
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!cancelled) setAdminCheck({ uid, ok: !error && data === true })
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  const gate: 'loading' | 'signed-out' | 'denied' | 'ok' =
    session === undefined ? 'loading'
    : session === null ? 'signed-out'
    : adminCheck?.uid !== session.user.id ? 'loading'
    : adminCheck.ok ? 'ok' : 'denied'

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-md">
        <Notice tone="info" title="Supabase is not configured">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, then reload. See .env.example.
        </Notice>
      </div>
    )
  }
  if (gate === 'loading') {
    return <div className="grid place-items-center py-24 text-green-800"><Spinner label="Checking sign-in" className="h-8 w-8" /></div>
  }
  if (gate === 'signed-out') return <Login />
  if (gate === 'denied') {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold text-green-900">No admin access</h1>
        <p className="mt-2 text-ink-700">
          You are signed in as {session?.user.email}, but this account is not on the admin list. Ask the project owner
          to add your email.
        </p>
        <button className="btn btn-ghost mt-6" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    )
  }
  return <AdminArea email={session?.user.email ?? ''} onSignOut={() => supabase.auth.signOut()} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) setError('Those details did not match an admin account. Check them and try again.')
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold text-green-900">Admin sign in</h1>
      <p className="mt-2 text-ink-700">Authorised administrators only.</p>
      <form onSubmit={submit} noValidate className="card mt-6 space-y-5 p-6">
        {error && <Notice>{error}</Notice>}
        <TextField fieldKey="admin_email" label="Email" required type="email" autoComplete="username" value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? (<><Spinner label="Signing in" /> Signing in</>) : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor="admin-password" className="field-label">
        Password<span className="ml-1 text-danger-600" aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <input
          id="admin-password"
          className="input pr-20"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-bold text-green-800 hover:bg-green-50"
          aria-pressed={show}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
