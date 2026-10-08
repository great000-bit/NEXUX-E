import { useId, type ReactNode } from 'react'

/** The DOM id of a field. The error summary links to it, and focus moves to it. */
export const fieldId = (key: string) => `field-${key}`

type BaseProps = {
  /** Matches a key in FIELD_INFO. Becomes the element id. */
  fieldKey: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  /** Replaces the default Optional tag, for fields that are required as a group. */
  tag?: string
  /** Show the invalid style even though the message sits elsewhere (for example a shared message). */
  invalid?: boolean
}

function Wrap({
  id,
  label,
  required,
  hint,
  error,
  tag,
  children,
}: Pick<BaseProps, 'label' | 'required' | 'hint' | 'error' | 'tag'> & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">*</span>
        ) : (
          <span className="ml-2 text-xs font-medium text-ink-500">{tag ?? 'Optional'}</span>
        )}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  )
}

const describe = (id: string, hint?: string, error?: string) =>
  error ? `${id}-err` : hint ? `${id}-hint` : undefined

export function TextField(
  props: BaseProps & {
    value: string
    onChange: (v: string) => void
    type?: 'text' | 'email' | 'tel' | 'url' | 'date'
    autoComplete?: string
    inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric'
    placeholder?: string
  },
) {
  const { fieldKey, value, onChange, type = 'text', autoComplete, inputMode, placeholder, invalid, ...rest } = props
  const id = fieldId(fieldKey)
  const bad = Boolean(rest.error) || Boolean(invalid)
  return (
    <Wrap id={id} {...rest}>
      <input
        id={id}
        name={fieldKey}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-required={rest.required || undefined}
        aria-invalid={bad ? true : undefined}
        aria-describedby={describe(id, rest.hint, rest.error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  )
}

export function TextAreaField(
  props: BaseProps & {
    value: string
    onChange: (v: string) => void
    rows?: number
    maxLength?: number
    placeholder?: string
  },
) {
  const { fieldKey, value, onChange, rows = 6, maxLength, placeholder, invalid, ...rest } = props
  const id = fieldId(fieldKey)
  const bad = Boolean(rest.error) || Boolean(invalid)
  return (
    <Wrap id={id} {...rest}>
      <textarea
        id={id}
        name={fieldKey}
        className="input"
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-required={rest.required || undefined}
        aria-invalid={bad ? true : undefined}
        aria-describedby={describe(id, rest.hint, rest.error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  )
}

export function SelectField(
  props: BaseProps & {
    value: string
    onChange: (v: string) => void
    options: readonly string[]
    placeholder?: string
    autoComplete?: string
  },
) {
  const { fieldKey, value, onChange, options, placeholder = 'Select', autoComplete, invalid, ...rest } = props
  const id = fieldId(fieldKey)
  const bad = Boolean(rest.error) || Boolean(invalid)
  return (
    <Wrap id={id} {...rest}>
      <div className="relative">
        <select
          id={id}
          name={fieldKey}
          className="input appearance-none pr-10"
          value={value}
          autoComplete={autoComplete}
          aria-required={rest.required || undefined}
          aria-invalid={bad ? true : undefined}
          aria-describedby={describe(id, rest.hint, rest.error)}
          onChange={(e) => onChange(e.target.value)}
          style={{ color: value ? undefined : '#66746b' }}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} style={{ color: 'var(--color-ink-900)' }}>{o}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Wrap>
  )
}

/** Single-choice list shown as accessible radio cards. */
export function RadioList({
  fieldKey, legend, required, hint, error, options, value, onChange, columns = 1,
}: {
  fieldKey: string
  legend: string
  required?: boolean
  hint?: string
  error?: string
  options: readonly string[] | readonly { value: string; label: string; sub?: string }[]
  value: string
  onChange: (v: string) => void
  columns?: 1 | 2
}) {
  const name = useId()
  const id = fieldId(fieldKey)
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o, sub: undefined } : { sub: undefined, ...o }))
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      data-invalid={error ? true : undefined}
      className="group-field"
      aria-describedby={error ? `${id}-err` : undefined}
    >
      <legend className="field-label">
        {legend}
        {required ? <span className="ml-1 text-danger-600" aria-hidden="true">*</span> : null}
      </legend>
      {hint && <p className="field-hint -mt-1 mb-2">{hint}</p>}
      <div className={`grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {opts.map((o) => (
          <label key={o.value} className="choice" data-checked={value === o.value} data-error={error ? true : undefined}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.value}
              aria-invalid={error ? true : undefined}
              onChange={() => onChange(o.value)}
            />
            <span className="choice-mark choice-radio" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-[0.95rem] font-semibold leading-snug">{o.label}</span>
              {o.sub && <span className="block text-sm text-ink-500">{o.sub}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </fieldset>
  )
}

/** Multi-choice list with an optional maximum. */
export function CheckList({
  fieldKey, legend, required, hint, error, options, values, onChange, max, columns = 1,
}: {
  fieldKey: string
  legend: string
  required?: boolean
  hint?: string
  error?: string
  options: readonly string[]
  values: string[]
  onChange: (v: string[]) => void
  max?: number
  columns?: 1 | 2
}) {
  const id = fieldId(fieldKey)
  const atMax = max !== undefined && values.length >= max
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((x) => x !== o) : atMax ? values : [...values, o])
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      data-invalid={error ? true : undefined}
      className="group-field"
      aria-describedby={error ? `${id}-err` : undefined}
    >
      <legend className="field-label">
        {legend}
        {required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">*</span>
        ) : (
          <span className="ml-2 text-xs font-medium text-ink-500">Optional</span>
        )}
      </legend>
      {(hint || max) && (
        <p className="field-hint -mt-1 mb-2" aria-live="polite">
          {hint}
          {max ? ` ${values.length} of ${max} selected.` : ''}
        </p>
      )}
      <div className={`grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {options.map((o) => {
          const checked = values.includes(o)
          const disabled = !checked && atMax
          return (
            <label key={o} className="choice" data-checked={checked} data-disabled={disabled}>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(o)}
              />
              <span className="choice-mark choice-check" aria-hidden="true" />
              <span className="flex-1 text-[0.95rem] font-semibold leading-snug">{o}</span>
            </label>
          )
        })}
      </div>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </fieldset>
  )
}

export function ConsentBox({
  fieldKey, checked, onChange, error, children,
}: {
  fieldKey: string
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: ReactNode
}) {
  const id = fieldId(fieldKey)
  return (
    <div>
      <label className="choice" data-checked={checked} data-error={!!error}>
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="choice-mark choice-check" aria-hidden="true" />
        <span className="flex-1 text-[0.95rem] leading-snug">{children}</span>
      </label>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  )
}
