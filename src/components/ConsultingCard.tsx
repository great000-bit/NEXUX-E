import { useState } from 'react'
import { Notice } from './ui'
import { RadioList } from './fields'
import { call } from '../lib/portal'
import { CONSULTING } from '../lib/options'
import { useMessages } from '../i18n/I18nProvider'

/** The expert says whether they can take on consulting work. Optional, and done after registering, never during it. */
export function ConsultingCard({ value, token, onChanged, onSessionEnded }: { value: string | null | undefined; token: string; onChanged: () => void; onSessionEnded: () => void }) {
  const m = useMessages()
  const t = m.dashboard.consulting
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const choose = async (next: string) => {
    setBusy(true)
    setSaved(false)
    const res = await call('set_consulting', { value: next }, token)
    setBusy(false)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      return setError(res.message)
    }
    setError(null)
    setSaved(true)
    onChanged()
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="consulting-title">
      <h2 id="consulting-title" className="text-xl font-semibold text-green-900">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-700">{t.help}</p>
      {error && <div className="mt-3"><Notice title={t.title}>{error}</Notice></div>}
      <div className="mt-3" aria-busy={busy}>
        <RadioList
          fieldKey="consulting"
          legend={t.title}
          options={CONSULTING}
          labelFor={(v) => (m.options.consulting as Record<string, string>)[v] ?? v}
          value={value ?? ''}
          onChange={(v) => void choose(v)}
        />
      </div>
      <p className="mt-2 text-sm font-semibold text-green-800" role="status" aria-live="polite">
        {saved ? t.saved : !value ? t.notSet : ''}
      </p>
    </section>
  )
}
