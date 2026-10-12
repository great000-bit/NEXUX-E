import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type Choice = { value: string; label: string; hint?: string }

/**
 * A searchable multi-select that works with a thumb and with a keyboard (the ARIA combobox pattern): type to narrow the
 * list, arrow keys and Enter to choose, Escape to close. Chosen items are not shown here: the form shows them as cards.
 * The list is inline (not floating), so it can never be cut off by the card it sits in.
 */
export function SearchMultiSelect({
  label, choices, selected, onToggle, placeholder, noResults, otherLabel, onOther, searchChoices, disabled,
}: {
  label: string
  choices: readonly Choice[]
  selected: readonly string[]
  onToggle: (value: string) => void
  placeholder: string
  noResults: string
  /** The "Other (specify)" row. Omit it and there is no such row. */
  otherLabel?: string
  onOther?: () => void
  /** Narrows the list as the person types. Defaults to a plain match on the label. */
  searchChoices?: (query: string) => Choice[]
  disabled?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const shown = useMemo(() => {
    const found = searchChoices ? searchChoices(query) : choices.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    return found.slice(0, 60)
  }, [choices, query, searchChoices])

  // The "Other" row counts as the last option, so the keyboard reaches it.
  const rows = shown.length + (otherLabel ? 1 : 0)

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (index: number) => {
    if (index < shown.length) onToggle(shown[index].value)
    else onOther?.()
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(rows - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      if (open && rows > 0) {
        e.preventDefault()
        choose(active)
      }
    } else if (e.key === 'Escape') {
      if (open || query) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery('')
      }
    }
  }

  const listId = `${id}-list`
  return (
    <div>
      <label htmlFor={`${id}-input`} className="field-label">{label}</label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows > 0 ? `${id}-opt-${active}` : undefined}
        className="input"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="mt-2 max-h-60 overflow-y-auto rounded-[var(--radius-md)] border border-line bg-white"
        >
          {shown.map((c, i) => {
            const on = selected.includes(c.value)
            return (
              <li
                key={c.value}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={on}
                className={`flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2.5 text-[0.95rem] text-ink-900 ${i === active ? 'bg-green-50' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded border-2 ${on ? 'border-green-700 bg-green-700 text-white' : 'border-ink-300'}`}>
                  {on && (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-semibold leading-snug">{c.label}</span>
                  {c.hint && <span className="block text-sm text-ink-500">{c.hint}</span>}
                </span>
              </li>
            )
          })}
          {shown.length === 0 && <li role="presentation" className="px-3 py-3 text-sm text-ink-500">{noResults}</li>}
          {otherLabel && (
            <li
              id={`${id}-opt-${shown.length}`}
              data-index={shown.length}
              role="option"
              aria-selected={false}
              className={`flex min-h-11 cursor-pointer items-center border-t border-line px-3 py-2.5 text-[0.95rem] font-bold text-green-800 ${active === shown.length ? 'bg-green-50' : ''}`}
              onMouseEnter={() => setActive(shown.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(shown.length)}
            >
              {otherLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
