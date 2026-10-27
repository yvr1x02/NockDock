import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { t } from '../lib/i18n'

export function Card({
  title,
  className = '',
  children
}: {
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col gap-2.5 rounded-2xl border border-line bg-card p-4 ${className}`}
    >
      {title && <h2 className="m-0 text-[13px] font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  )
}

export function Dot({ color }: { color: 'ok' | 'warn' | 'err' | 'muted' }) {
  const bg = { ok: 'bg-ok', warn: 'bg-warn', err: 'bg-err', muted: 'bg-dim' }[color]
  return <span className={`inline-block size-2 shrink-0 rounded-full ${bg}`} />
}

export function Panel({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-scrim">
      <div
        role="dialog"
        aria-label={title}
        className="flex h-[520px] w-[900px] flex-col gap-4 rounded-[20px] border border-panel-line bg-panel p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Chiudi')}
            className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-raised"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function Toast({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      role="status"
      className={`absolute bottom-[84px] left-1/2 z-30 max-w-[900px] -translate-x-1/2 truncate rounded-full px-5 py-3 text-sm font-semibold ${
        error ? 'bg-err text-ground' : 'bg-ink text-ground'
      }`}
    >
      {text}
    </div>
  )
}
