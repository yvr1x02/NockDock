import { useEffect, useState } from 'react'
import type { StreakInfo, SystemStats } from '@shared/types'
import { CLAUDE_LABEL, api, lastProjectId, projectById, useDock } from '../lib/dock'
import { accountName } from '../lib/accounts'
import { ago, opened } from '../lib/time'
import { Card, Dot } from '../components/ui'
import { Icon } from '../components/Icon'
import { t } from '../lib/i18n'

export function Home() {
  const { config, state, git, claude, problems, run, openPanel, openSettings, selectProject, setTab } =
    useDock()
  const lastId = lastProjectId(config, state)
  const lastClaude = lastId ? claude[lastId]?.state : undefined
  const last = lastId ? projectById(config, lastId) : undefined
  const g = lastId ? git[lastId] : undefined
  const note = lastId ? state.projects[lastId]?.note : undefined

  const recent = config.projects
    .filter((p) => p.id !== lastId)
    .map((p) => ({ p, at: state.projects[p.id]?.lastOpenedAt ?? '' }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)

  // Riquadri accesi nelle impostazioni: la griglia si adatta a quelli che restano
  const show = config.home
  const sideColumn = show.streak || show.recap
  const bottom = [show.recent, show.resources, sideColumn].filter(Boolean).length

  return (
    <div className={`flex h-full flex-col gap-3`}>
      <div
        className={`grid min-h-0 gap-3 ${show.alerts ? 'grid-cols-3' : 'grid-cols-1'} ${bottom ? 'flex-[1.15]' : 'flex-1'}`}
      >
        {/* Riprendi */}
        <Card className={`gap-2.5 ${show.alerts ? 'col-span-2' : ''}`}>
          {last ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="m-0 text-[13px] font-semibold text-muted">
                    {t('Riprendi da dove avevi lasciato')}
                  </h2>
                  <span className="text-[22px] font-bold tracking-tight">{last.name}</span>
                  <span className="text-xs text-muted">
                    {accountName(config, last.account)} · {g?.branch || '—'} {t('· aperto')}{' '}
                    {opened(state.projects[last.id]?.lastOpenedAt)}
                  </span>
                </div>
                {g?.ok && (
                  <span className="flex h-[26px] shrink-0 items-center rounded-full bg-line px-2.5 text-xs font-semibold text-warn-soft">
                    {g.files.length
                      ? t('{length} file non committati', { length: g.files.length })
                      : t('tutto committato')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => openPanel({ note: last.id })}
                className="flex min-h-0 flex-1 flex-col gap-1 rounded-xl border border-dashed border-dash bg-raised px-3.5 py-2.5 text-left"
              >
                <span className="text-xs text-muted">{t('Nota per la prossima volta')}</span>
                <span className={`text-[15px] leading-snug ${note ? '' : 'text-muted'}`}>
                  {note || t('Tocca per lasciarti una nota')}
                </span>
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    run(api.openVsCode(last.id), t('Apertura di {name} in VS Code', { name: last.name }))
                  }
                  className="flex h-[52px] flex-[2] items-center justify-center gap-2.5 rounded-[14px] bg-accent text-base font-bold text-on-accent"
                >
                  <Icon name="code" size={22} />
                  {t('Apri in VS Code')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(api.openClaude(last.id), t('Claude Code avviato in {path}', { path: last.path }))
                  }
                  className={`flex h-[52px] flex-1 flex-col items-center justify-center rounded-[14px] border bg-raised text-sm font-semibold ${
                    lastClaude === 'waiting'
                      ? 'border-warn'
                      : lastClaude === 'working'
                        ? 'border-ok'
                        : 'border-line-strong'
                  }`}
                >
                  {t('Claude Code')}
                  {lastClaude && (
                    <span
                      className={`text-[11px] font-normal ${lastClaude === 'waiting' ? 'text-warn' : lastClaude === 'working' ? 'text-ok' : 'text-muted'}`}
                    >
                      {t(CLAUDE_LABEL[lastClaude])}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => selectProject(last.id, true)}
                  className="h-[52px] flex-1 rounded-[14px] border border-line-strong bg-raised text-sm font-semibold"
                >
                  {t('Altri progetti')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center gap-3">
              <span className="text-[22px] font-bold">{t('Nessun progetto, per ora')}</span>
              <span className="text-sm text-muted">
                {t('Cerca i tuoi repo in una cartella o aggiungili uno alla volta.')}
              </span>
              <button
                type="button"
                onClick={() => openSettings('progetti')}
                className="h-[52px] rounded-[14px] bg-accent px-5 text-base font-bold text-on-accent"
              >
                {t('Aggiungi progetti')}
              </button>
            </div>
          )}
        </Card>

        {/* Da sistemare */}
        {show.alerts && (
          <Card title={t('Da sistemare')} className="gap-2">
            {problems.slice(0, 3).map((pr) => (
              <button
                key={pr.title}
                type="button"
                onClick={() => selectProject(pr.projectId, true)}
                className="flex shrink-0 items-start gap-2.5 rounded-xl bg-raised px-3 py-2 text-left"
              >
                <span className="mt-1.5">
                  <Dot color={pr.level} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">{pr.title}</span>
                  <span className="truncate text-xs text-muted">{pr.detail}</span>
                </span>
              </button>
            ))}
            {problems.length === 0 && (
              <span className="flex flex-1 items-center justify-center text-[15px] font-semibold text-ok">
                {t('Tutto ok')}
              </span>
            )}
            {problems.length > 3 && (
              <button
                type="button"
                onClick={() => openPanel('avvisi')}
                className="mt-auto text-left text-xs font-semibold text-muted"
              >
                {t('e altri')} {problems.length - 3} {t('· vedi tutti')}
              </button>
            )}
          </Card>
        )}
      </div>

      {bottom > 0 && (
        <div
          className="grid min-h-0 flex-1 gap-3"
          style={{ gridTemplateColumns: `repeat(${bottom}, minmax(0, 1fr))` }}
        >
          {/* Recenti */}
          {show.recent && (
            <Card title={t('Aperti di recente')} className="gap-2">
              {recent.map(({ p, at }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProject(p.id, true)}
                  className="flex h-11 shrink-0 items-center justify-between gap-2 rounded-xl bg-raised px-3 text-left text-sm"
                >
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted">{at ? ago(at) : t('mai')}</span>
                </button>
              ))}
            </Card>
          )}

          {show.resources && <ResourcesCard onOpen={() => setTab('sistema')} />}

          {/* Serie e recap */}
          {sideColumn && (
            <div className="flex min-h-0 flex-col gap-3">
              {show.streak && <StreakCard />}
              {show.recap && (
                <button
                  type="button"
                  onClick={() => openPanel('recap')}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl border border-accent bg-accent-tint px-4 text-left ${show.streak ? 'h-16' : 'flex-1'}`}
                >
                  <span className="text-accent-text">
                    <Icon name="sunset" size={22} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{t('Recap di fine giornata')}</span>
                    <span className="text-xs text-soft">{t('commit di oggi e note per domani')}</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResourcesCard({ onOpen }: { onOpen: () => void }) {
  const [s, setS] = useState<SystemStats | null>(null)
  useEffect(() => {
    const tick = (): void => void api.getSystem().then(setS)
    tick()
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }, [])
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 text-left"
    >
      <span className="text-[13px] font-semibold text-muted">{t('Risorse del PC')}</span>
      {[
        ['CPU', s?.cpu ?? 0],
        ['RAM', s?.ram ?? 0]
      ].map(([label, v]) => (
        <span key={label} className="flex w-full flex-col gap-1.5">
          <span className="flex justify-between text-sm">
            <span>{label}</span>
            <span className="font-mono">{v}%</span>
          </span>
          <span className="h-2 w-full overflow-hidden rounded bg-line">
            <span className="block h-full rounded bg-accent" style={{ width: `${v}%` }} />
          </span>
        </span>
      ))}
    </button>
  )
}

/** Serie di giorni con almeno un commit e livello del personaggio. */
function StreakCard() {
  const { git } = useDock()
  const [s, setS] = useState<StreakInfo | null>(null)
  // Si aggiorna quando cambiano i commit dei repo
  const lastCommits = Object.values(git)
    .map((g) => g.commits[0]?.date ?? '')
    .sort()
    .pop()
  useEffect(() => {
    api.getStreak().then(setS)
  }, [lastCommits])

  if (!s) return <div className="min-h-0 flex-1 rounded-2xl border border-line bg-card" />
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-2xl border border-line bg-card px-4">
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[26px] leading-none font-bold">{s.streak}</span>
          <span className="text-[13px] text-muted">
            {s.streak === 1 ? t('giorno di fila') : t('giorni di fila')}
          </span>
        </span>
        <span className={`text-xs font-semibold ${s.committedToday ? 'text-ok' : 'text-warn'}`}>
          {s.committedToday ? t('oggi fatto') : s.streak ? t('manca il commit di oggi') : ''}
        </span>
      </span>
      <span className="flex items-center justify-between text-xs">
        <span className="font-semibold text-accent-text">
          {t('Liv.')} {s.level} · {t(s.title)}
        </span>
        <span className="font-mono text-muted">
          {s.totalCommits}/{s.nextAt}
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.round(s.progress * 100)}%` }}
        />
      </span>
    </div>
  )
}
