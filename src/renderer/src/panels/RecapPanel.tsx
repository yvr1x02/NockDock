import { useEffect, useState } from 'react'
import type { RecapProject } from '@shared/types'
import { api, useDock } from '../lib/dock'
import { ago } from '../lib/time'
import { Panel } from '../components/ui'
import { t, locale } from '../lib/i18n'

export function RecapPanel() {
  const { state, openPanel, say } = useDock()
  const [recap, setRecap] = useState<RecapProject[] | null>(null)

  useEffect(() => {
    api.getRecap().then(setRecap)
  }, [])

  const today = new Date().toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })
  const commits = recap?.reduce((n, p) => n + p.commits.length, 0) ?? 0
  const dirty = recap?.reduce((n, p) => n + p.dirtyFiles, 0) ?? 0

  return (
    <Panel title={t('Recap di fine giornata · {today}', { today })} onClose={() => openPanel(null)}>
      {!recap ? (
        <span className="text-muted">{t('Leggo i repo…')}</span>
      ) : (
        <div className="grid h-full grid-cols-2 gap-4">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex gap-2">
              <Stat n={commits} label={t('commit')} />
              <Stat n={recap.length} label={t('progetti toccati')} />
              <Stat n={dirty} label={t('file da committare')} />
            </div>
            <span className="text-[13px] font-semibold text-muted">{t('Cosa hai fatto oggi')}</span>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
              {recap.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5 rounded-xl bg-raised px-3.5 py-3">
                  <span className="flex justify-between gap-2">
                    <span className="text-[15px] font-semibold">{p.name}</span>
                    <span className={`text-xs ${p.dirtyFiles ? 'text-warn' : 'text-ok'}`}>
                      {p.dirtyFiles
                        ? t('{dirtyFiles} file non committati', { dirtyFiles: p.dirtyFiles })
                        : t('tutto committato')}
                    </span>
                  </span>
                  {p.commits.map((c) => (
                    <span key={c.date + c.msg} className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{c.msg}</span>
                      <span className="shrink-0 text-muted">{ago(c.date)}</span>
                    </span>
                  ))}
                  {p.commits.length === 0 && (
                    <span className="text-[13px] text-muted">{t('Aperto oggi, nessun commit')}</span>
                  )}
                </div>
              ))}
              {recap.length === 0 && (
                <span className="text-sm text-muted">
                  {t('Oggi nessun commit e nessun progetto aperto dal dock.')}
                </span>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-2.5">
            <span className="text-[13px] font-semibold text-muted">{t('Note per domani')}</span>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
              {recap.map((p) => {
                const note = state.projects[p.id]?.note
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPanel({ note: p.id })}
                    className="flex shrink-0 flex-col gap-1 rounded-xl border border-dashed border-dash px-3.5 py-3 text-left"
                  >
                    <span className="text-xs text-muted">{p.name}</span>
                    <span className={`text-sm leading-snug ${note ? '' : 'text-muted'}`}>
                      {note || t('Tocca per scrivere la nota')}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                openPanel(null)
                say(t('Giornata chiusa: domani ritrovi le note nel riquadro Riprendi'))
              }}
              className="h-14 shrink-0 rounded-[14px] bg-accent text-base font-bold text-on-accent"
            >
              {t('Salva e chiudi la giornata')}
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-1 flex-col gap-0.5 rounded-xl bg-raised px-3 py-2.5">
      <span className="text-[22px] font-bold">{n}</span>
      <span className="text-xs text-muted">{label}</span>
    </span>
  )
}
