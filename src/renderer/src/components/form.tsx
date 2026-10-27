import type { ReactNode } from 'react'
import { COLOR_PRESETS } from '../lib/accounts'
import { t } from '../lib/i18n'

const inputCls =
  'h-11 w-full min-w-0 rounded-lg border border-line-strong bg-ground px-3 text-sm text-ink outline-none placeholder:text-dim focus:border-accent'

/** Riga di un modulo: etichetta e spiegazione sopra, controllo sotto */
export function Field({
  label,
  hint,
  children,
  className = '',
  group = false
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  /** true quando dentro ci sono più controlli: niente <label>, che li unirebbe in uno */
  group?: boolean
}) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-soft">{label}</span>
      {children}
      {hint && <span className="text-xs leading-snug text-muted">{hint}</span>}
    </Tag>
  )
}

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  type?: 'text' | 'password'
  label?: string
}) {
  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      aria-label={props.label}
      spellCheck={false}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={`${inputCls} ${props.mono ? 'font-mono text-[13px]' : ''}`}
    />
  )
}

export function NumberInput(props: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  placeholder?: string
  label?: string
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={props.label}
      value={props.value ?? ''}
      min={props.min}
      max={props.max}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className={`${inputCls} font-mono`}
    />
  )
}

/** Interruttore grande, comodo col dito */
export function Toggle({
  checked,
  onChange,
  label,
  sub
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-line-strong bg-raised px-4 py-2.5 text-left"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {sub && <span className="text-xs leading-snug text-muted">{sub}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-ink transition-[left] ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  )
}

/** Scelta tra poche opzioni, a pulsanti */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label
}: {
  options: { value: T; label: string; sub?: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-11 flex-col justify-center rounded-lg border px-3.5 py-1.5 text-left text-sm font-semibold ${
              on ? 'border-accent bg-accent-tint text-accent-text' : 'border-line-strong bg-raised'
            }`}
          >
            {o.label}
            {o.sub && <span className="text-[11px] font-normal text-muted">{o.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ColorChoice({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const custom = !COLOR_PRESETS.some((c) => c.color === value.toLowerCase())
  return (
    <div role="radiogroup" aria-label={t('Colore')} className="flex flex-wrap items-center gap-2">
      {COLOR_PRESETS.map((c) => {
        const on = c.color === value.toLowerCase()
        return (
          <button
            key={c.color}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(c.name)}
            title={t(c.name)}
            onClick={() => onChange(c.color)}
            className={`size-10 rounded-full border-[3px] ${on ? 'border-ink' : 'border-transparent'}`}
            style={{ background: c.color }}
          />
        )
      })}
      {/* Colore libero: il selettore di Windows */}
      <label
        title={t('Altro colore')}
        className={`relative flex h-10 items-center gap-2 rounded-full border-[3px] pr-3 pl-1 text-xs font-semibold ${
          custom ? 'border-ink' : 'border-line-strong'
        }`}
      >
        <span
          className="size-7 rounded-full"
          style={{
            background: custom
              ? value
              : 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)'
          }}
        />
        {custom ? value.toUpperCase() : t('Altro colore')}
        <input
          type="color"
          aria-label={t('Altro colore')}
          value={custom ? value : '#b3202f'}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

/** Titolo di un blocco dentro una sezione */
export function Group({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[15px] font-bold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function SmallButton({
  children,
  onClick,
  primary,
  danger,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${
        primary
          ? 'bg-accent font-bold text-on-accent'
          : danger
            ? 'border border-line-strong bg-raised text-err'
            : 'border border-line-strong bg-raised'
      }`}
    >
      {children}
    </button>
  )
}
