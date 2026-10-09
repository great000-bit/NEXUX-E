import '../i18n/enSite'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TextField } from '../components/fields'
import { Notice, Spinner } from '../components/ui'
import { usePageInfo } from '../lib/pageInfo'
import { call, getSession, saveSession } from '../lib/portal'
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESEND_AFTER_SECONDS = 30

type Step = 'email' | 'code'

export default function Verify() {
  const t = useMessages().verify
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [codeError, setCodeError] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sessionMessage = (location.state as { message?: string } | null)?.message

  usePageInfo({ title: t.pageTitle, noindex: true })

  // Someone who is already signed in goes straight to their dashboard.
  useEffect(() => {
    if (getSession()) navigate('/verify/dashboard', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    const clean = email.trim()
    if (!EMAIL_RE.test(clean)) {
      setEmailError(t.emailInvalid)
      document.getElementById('field-verify_email')?.focus()
      return
    }
    setEmailError(undefined)
    setBusy(true)
    const res = await call<{ message: string }>('request_code', { email: clean })
    setBusy(false)
    if (!res.ok) {
      setEmailError(res.message)
      return
    }
    // The same message is shown whether or not the address is registered.
    setNotice(t.codeSent)
    setStep('code')
    setCode('')
    setCodeError(undefined)
    setWait(RESEND_AFTER_SECONDS)
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\s+/g, '')
    if (!/^\d{6}$/.test(digits)) {
      setCodeError(t.codeInvalid)
      document.getElementById('field-verify_code')?.focus()
      return
    }
    setCodeError(undefined)
    setBusy(true)
    const res = await call<{ token: string; expires_at: string }>('verify_code', { email: email.trim(), code: digits })
    setBusy(false)
    if (!res.ok) {
      setCodeError(res.message)
      document.getElementById('field-verify_code')?.focus()
      return
    }
    saveSession({ token: res.token, expiresAt: res.expires_at })
    navigate('/verify/dashboard', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">{t.eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-semibold text-green-900 outline-none">
        {step === 'email' ? t.titleEmail : t.titleCode}
      </h1>
      <p className="mt-3 text-ink-700">
        {step === 'email' ? t.introEmail : t.introCode}
      </p>

      {sessionMessage && step === 'email' && (
        <div className="mt-5">
          <Notice tone="info">{sessionMessage}</Notice>
        </div>
      )}

      {step === 'email' ? (
        <form onSubmit={requestCode} noValidate className="card mt-6 space-y-5 p-5 sm:p-6">
          <TextField
            fieldKey="verify_email"
            label={t.emailLabel}
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(v) => {
              setEmail(v)
              if (emailError) setEmailError(undefined)
            }}
            error={emailError}
          />
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? (<><Spinner label={t.sending} /> {t.sendingCode}</>) : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate className="card mt-6 space-y-5 p-5 sm:p-6">
          {notice && <Notice tone="info">{notice}</Notice>}
          <TextField
            fieldKey="verify_code"
            label={t.codeLabel}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(v) => {
              setCode(v.replace(/[^\d\s]/g, '').slice(0, 7))
              if (codeError) setCodeError(undefined)
            }}
            error={codeError}
          />
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? (<><Spinner label={t.checking} /> {t.checkingCode}</>) : t.signIn}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className="rounded-full px-1 font-bold text-green-800 underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
              disabled={wait > 0 || busy}
              onClick={() => requestCode()}
            >
              {wait > 0 ? fmt(t.newCodeIn, { seconds: wait }) : t.newCode}
            </button>
            <button
              type="button"
              className="rounded-full px-1 font-semibold text-ink-700 underline underline-offset-4"
              onClick={() => {
                setStep('email')
                setNotice(null)
              }}
            >
              {t.differentEmail}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-sm text-ink-500">
        {t.notRegistered} <Link to="/register" className="font-bold text-green-800 underline underline-offset-4">{t.registerFirst}</Link>. {t.phoneOnly}
      </p>
    </div>
  )
}
