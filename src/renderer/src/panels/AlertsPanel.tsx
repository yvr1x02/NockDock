import { useDock } from '../lib/dock'
import { Dot, Panel } from '../components/ui'
import { t } from '../lib/i18n'

export function AlertsPanel() {
  const { problems, openPanel, selectProject } = useDock()
  return (
    <Panel title={t('Avvisi')} onClose={() => openPanel(null)}>
      <div className="flex h-full flex-col gap-2.5 overflow-y-auto">
        {problems.map((pr) => (
          <div key={pr.title} className="flex items-center gap-3.5 rounded-[14px] bg-raised px-4 py-3.5">
            <Dot color="err" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{pr.title}</span>
              <span className="truncate text-[13px] text-muted">{pr.detail}</span>
            </span>
            <button
              type="button"
              onClick={() => selectProject(pr.projectId, true)}
              className="h-11 shrink-0 rounded-xl border border-line-strong bg-line px-4 text-sm font-semibold"
            >
              {t('Apri progetto')}
            </button>
          </div>
        ))}
        {problems.length === 0 && (
          <span className="text-base font-semibold text-ok">
            {t('Tutto ok: i repo sono raggiungibili e nessun dev server è andato in errore.')}
          </span>
        )}
        <span className="mt-auto text-[13px] text-dim">
          {t('Nella prossima versione arrivano qui anche deploy Vercel, CI di GitHub e Claude Code.')}
        </span>
      </div>
    </Panel>
  )
}
