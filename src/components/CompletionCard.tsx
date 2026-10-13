import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

export type Completion = { items: { key: string; done: boolean }[]; percent: number; complete: boolean }

/** The profile completion meter, with the next step spelled out. Everything beyond registering is optional and done later. */
export function CompletionCard({ completion }: { completion: Completion }) {
  const m = useMessages()
  const t = m.dashboard.completion
  const steps = t.steps as Record<string, string>
  const next = completion.items.find((i) => !i.done)
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="completion-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="completion-title" className="text-xl font-semibold text-green-900">{t.title}</h2>
        <p className="text-sm font-bold text-green-800">{fmt(t.percent, { n: completion.percent })}</p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-green-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.percent}
        aria-label={fmt(t.percent, { n: completion.percent })}
      >
        <div className="h-full rounded-full bg-lime-500 transition-[width]" style={{ width: `${completion.percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink-700">{t.intro}</p>
      <ol className="mt-4 space-y-2 text-sm">
        {completion.items.map((i) => (
          <li key={i.key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-xs font-bold ${i.done ? 'bg-green-800 text-white' : 'border border-line text-ink-500'}`}
            >
              {i.done && (
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className={i.done ? 'text-ink-500' : 'font-semibold text-ink-900'}>
              {steps[i.key] ?? i.key}
              <span className="sr-only"> {i.done ? t.done : ''}</span>
              {!i.done && next?.key === i.key && <span className="ms-2 rounded-full bg-lime-200 px-2 py-0.5 text-xs font-bold text-green-900">{t.next}</span>}
            </span>
          </li>
        ))}
      </ol>
      {completion.complete && <p className="mt-4 text-sm font-semibold text-green-800">{t.allDone}</p>}
    </section>
  )
}
