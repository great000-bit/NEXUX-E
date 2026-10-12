import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { SearchMultiSelect, type Choice } from './SearchMultiSelect'
import { Spinner } from './ui'
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'
import {
  AFFILIATION_LIMITS, AFFILIATION_TYPES, entryKey, kindOf, MAX_AFFILIATIONS, MEMBERSHIP_CATEGORIES,
  newEntry, searchInstitutions, type AffiliationEntry, type AffiliationKind, type Institution,
} from '../lib/institutions'
import { fetchInstitutions } from '../lib/institutionsApi'

/**
 * "Add memberships and affiliations (optional)": collapsed, so the first 90 seconds of registering are not slowed down.
 * The list of institutions is fetched only when the section is opened. Everything is self-declared, membership numbers
 * and licence details are private, and showing any of it on the public profile needs its own tick.
 */
export function AffiliationsSection({
  entries, onEntries, isPublic, onPublic, error,
}: {
  entries: AffiliationEntry[]
  onEntries: (next: AffiliationEntry[]) => void
  isPublic: boolean
  onPublic: (v: boolean) => void
  error?: string
}) {
  const m = useMessages()
  const t = m.register.fields.aff
  const id = useId()
  // Someone who restored a draft with entries, or has an error to fix, sees the section open.
  const [open, setOpen] = useState(entries.length > 0 || Boolean(error))
  const [list, setList] = useState<Institution[] | null>(null)
  const [failed, setFailed] = useState(false)

  // State changes only when the answer arrives, never synchronously inside an effect.
  const load = useCallback(() => {
    void fetchInstitutions().then((r) => {
      if (r.ok) {
        setList(r.items)
        setFailed(false)
      } else setFailed(true)
    })
  }, [])
  useEffect(() => {
    if (open && list === null && !failed) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const professional = useMemo(() => (list ?? []).filter((i) => kindOf(i.category) === 'professional'), [list])
  const ngos = useMemo(() => (list ?? []).filter((i) => kindOf(i.category) === 'ngo'), [list])
  const chosen = useMemo(() => new Set(entries.map(entryKey)), [entries])
  const atLimit = entries.length >= MAX_AFFILIATIONS

  const toggle = (kind: AffiliationKind, institution: Institution) => {
    const key = institution.id
    if (chosen.has(key)) onEntries(entries.filter((e) => entryKey(e) !== key))
    else if (!atLimit) onEntries([...entries, newEntry(kind, institution)])
  }
  const update = (key: string, patch: Partial<AffiliationEntry>) =>
    onEntries(entries.map((e) => (entryKey(e) === key ? { ...e, ...patch } : e)))
  const remove = (key: string) => onEntries(entries.filter((e) => entryKey(e) !== key))
  const addOther = (kind: AffiliationKind, name: string) => {
    const entry = newEntry(kind, null, name)
    if (entry.name.length < 2 || chosen.has(entryKey(entry)) || atLimit) return false
    onEntries([...entries, entry])
    return true
  }

  const choices = (items: Institution[]): Choice[] =>
    items.map((i) => ({ value: i.id, label: i.name, hint: i.country && i.country !== 'Pan-African' ? (m.options.countries as Record<string, string>)[i.country] ?? i.country : i.country ?? undefined }))
  const search = (items: Institution[]) => (q: string) => choices(searchInstitutions(items, q))

  return (
    <div id="field-affiliations" tabIndex={-1} className="rounded-[var(--radius-lg)] border border-line">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-start font-bold text-green-900"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {t.toggle}
          {entries.length > 0 && <span className="ms-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{fmt(t.count, { n: entries.length })}</span>}
        </span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 flex-none transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={`${id}-panel`} className="space-y-6 border-t border-line px-4 pb-5 pt-4">
          <p className="text-sm text-ink-700">{t.intro}</p>
          {error && <p className="field-error" role="alert">{error}</p>}

          {list === null && !failed && (
            <div className="flex items-center gap-2 text-sm text-ink-700"><Spinner label={t.loading} /> {t.loading}</div>
          )}
          {failed && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-700">
              <span>{t.loadFailed}</span>
              <button type="button" className="font-bold text-green-800 underline underline-offset-4" onClick={() => { setFailed(false); load() }}>{t.retry}</button>
            </div>
          )}

          {(list !== null || failed) && (
            <>
              <Group
                kind="professional" title={t.professionalTitle} help={t.professionalHelp} searchLabel={t.professionalSearch}
                items={professional} choices={choices(professional)} search={search(professional)}
                entries={entries.filter((e) => e.kind === 'professional')} chosen={chosen} atLimit={atLimit}
                onToggle={(i) => toggle('professional', i)} onAddOther={(n) => addOther('professional', n)}
                onUpdate={update} onRemove={remove}
              />
              <Group
                kind="ngo" title={t.ngoTitle} help={t.ngoHelp} searchLabel={t.ngoSearch}
                items={ngos} choices={choices(ngos)} search={search(ngos)}
                entries={entries.filter((e) => e.kind === 'ngo')} chosen={chosen} atLimit={atLimit}
                onToggle={(i) => toggle('ngo', i)} onAddOther={(n) => addOther('ngo', n)}
                onUpdate={update} onRemove={remove}
              />
              {atLimit && <p className="text-sm font-semibold text-ink-700">{t.limit}</p>}
              <p className="text-xs text-ink-500">{t.notListed}</p>
            </>
          )}

          <p className="rounded-[var(--radius-md)] bg-blue-100 px-4 py-3 text-sm text-blue-700">{m.register.fields.membershipNote}</p>

          <label className="choice" data-checked={isPublic}>
            <input type="checkbox" className="sr-only" checked={isPublic} onChange={(e) => onPublic(e.target.checked)} />
            <span className="choice-mark choice-check" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-[0.95rem] font-semibold leading-snug">{t.consent}</span>
              <span className="block text-sm text-ink-500">{t.consentHint}</span>
            </span>
          </label>
          <p className="text-xs text-ink-500">{t.selfDeclared}</p>
        </div>
      )}
    </div>
  )
}

function Group({
  kind, title, help, searchLabel, items, choices, search, entries, chosen, onToggle, onAddOther, onUpdate, onRemove,
}: {
  kind: AffiliationKind
  title: string
  help: string
  searchLabel: string
  items: Institution[]
  choices: Choice[]
  search: (q: string) => Choice[]
  entries: AffiliationEntry[]
  chosen: Set<string>
  atLimit: boolean
  onToggle: (i: Institution) => void
  onAddOther: (name: string) => boolean
  onUpdate: (key: string, patch: Partial<AffiliationEntry>) => void
  onRemove: (key: string) => void
}) {
  const m = useMessages()
  const t = m.register.fields.aff
  const [other, setOther] = useState(false)
  const [typed, setTyped] = useState('')
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const submitOther = () => {
    if (onAddOther(typed)) {
      setTyped('')
      setOther(false)
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold text-green-900">{title}</legend>
      <p className="-mt-1 text-sm text-ink-500">{help}</p>
      <SearchMultiSelect
        label={searchLabel}
        choices={choices}
        selected={[...chosen]}
        onToggle={(value) => {
          const i = byId.get(value)
          if (i) onToggle(i)
        }}
        placeholder={t.searchPlaceholder}
        noResults={t.noResults}
        otherLabel={t.otherOption}
        onOther={() => setOther(true)}
        searchChoices={search}
      />

      {other && (
        <div className="rounded-[var(--radius-md)] bg-green-50 p-3">
          <label htmlFor={`other-${kind}`} className="field-label">{t.otherLabel}</label>
          <div className="flex gap-2">
            <input
              id={`other-${kind}`}
              className="input min-w-0 flex-1"
              value={typed}
              maxLength={AFFILIATION_LIMITS.name}
              placeholder={t.otherPlaceholder}
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitOther()
                }
              }}
            />
            <button type="button" className="btn btn-primary flex-none !px-5" onClick={submitOther} disabled={typed.trim().length < 2}>{t.otherAdd}</button>
          </div>
          <p className="field-hint">{t.otherHint}</p>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="space-y-3" aria-label={t.selected}>
          {entries.map((e) => {
            const key = entryKey(e)
            return (
              <li key={key} className="rounded-[var(--radius-md)] border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold text-ink-900">
                    {e.name}
                    {e.other && <span className="ms-2 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-bold text-[#7a4b00]">{t.pending}</span>}
                  </p>
                  <button type="button" className="inline-flex min-h-11 min-w-11 flex-none items-center justify-center rounded-full text-ink-500 hover:bg-line" onClick={() => onRemove(key)} aria-label={fmt(t.remove, { name: e.name })}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" /></svg>
                  </button>
                </div>
                {kind === 'professional' ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`cat-${key}`} className="field-label">{t.category}</label>
                      <select id={`cat-${key}`} className="input" value={e.membership_category} onChange={(ev) => onUpdate(key, { membership_category: ev.target.value })}>
                        <option value="">{t.categoryPlaceholder}</option>
                        {MEMBERSHIP_CATEGORIES.map((c) => <option key={c} value={c}>{(m.options.membershipCategories as Record<string, string>)[c] ?? c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`num-${key}`} className="field-label">{t.number}</label>
                      <input id={`num-${key}`} className="input" value={e.membership_number} maxLength={AFFILIATION_LIMITS.membership_number} autoComplete="off" onChange={(ev) => onUpdate(key, { membership_number: ev.target.value })} />
                      <p className="field-hint">{t.numberHint}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`lic-${key}`} className="field-label">{t.licence}</label>
                      <input id={`lic-${key}`} className="input" value={e.licence_status} maxLength={AFFILIATION_LIMITS.licence_status} autoComplete="off" onChange={(ev) => onUpdate(key, { licence_status: ev.target.value })} />
                      <p className="field-hint">{t.licenceHint}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <label htmlFor={`type-${key}`} className="field-label">{t.affiliationType}</label>
                    <select id={`type-${key}`} className="input" value={e.affiliation_type || 'member'} onChange={(ev) => onUpdate(key, { affiliation_type: ev.target.value })}>
                      {AFFILIATION_TYPES.map((a) => <option key={a} value={a}>{(m.options.affiliationTypes as Record<string, string>)[a] ?? a}</option>)}
                    </select>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </fieldset>
  )
}
