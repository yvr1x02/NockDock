import { useEffect, useState } from 'react'
import type { SystemStats } from '@shared/types'
import { CLAUDE_LABEL, api, lastProjectId, projectById, useDock } from '../lib/dock'
import { useMedia } from '../lib/media'
import { ago } from '../lib/time'
import { Dot } from '../components/ui'
import { Icon } from '../components/Icon'
import { t } from '../lib/i18n'

const box = 'flex min-h-0 min-w-0 flex-col rounded-[18px] border border-line bg-card'
const eyebrow = 'text-[13px] font-semibold uppercase tracking-[0.04em] text-muted'

export function Home() {
  const { config, state, git, claude, problems, run, openPanel, openSettings, selectProject } = useDock()
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

  // Riquadri accesi nelle impostazioni
  const show = config.home
  const bottom = (show.recent && recent.length > 0) || show.resources

  return (
    <div
      className="grid h-full gap-3"
      style={{
        gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)',
        gridTemplateRows: bottom ? 'minmax(0, 1fr) 76px' : 'minmax(0, 1fr)'
      }}
    >
      {/* Riprendi */}
      <section className={`${box} gap-3.5 p-5`}>
        {last ? (
          <>
            <div className="flex flex-col gap-1">
              <span className={eyebrow}>{t('Riprendi')}</span>
              <span className="truncate text-[32px] leading-tight font-bold tracking-tight">{last.name}</span>
              <span className="text-sm text-muted">
                {g?.branch || '—'}
                {g?.ok && g.files.length > 0 && (
                  <span className="text-warn-soft">
                    {' · '}
                    {t('{n} da committare', { n: g.files.length })}
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openPanel({ note: last.id })}
              className="flex min-h-0 flex-1 flex-col gap-1 rounded-[14px] border border-dashed border-dash bg-raised px-4 py-3 text-left"
            >
              <span className="text-xs text-muted">{t('Nota')}</span>
              <span className={`text-base leading-snug ${note ? '' : 'text-muted'}`}>
                {note || t('Tocca per lasciarti una nota')}
              </span>
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() =>
                  run(api.openVsCode(last.id), t('Apertura di {name} in VS Code', { name: last.name }))
                }
                className="flex h-14 flex-[2] items-center justify-center gap-2.5 rounded-[14px] bg-accent text-[17px] font-bold text-on-accent"
              >
                <Icon name="code" size={22} />
                VS Code
              </button>
              <button
                type="button"
                onClick={() =>
                  run(api.openClaude(last.id), t('Claude Code avviato in {path}', { path: last.path }))
                }
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-[14px] border bg-raised text-base font-semibold ${
                  lastClaude === 'waiting'
                    ? 'border-warn'
                    : lastClaude === 'working'
                      ? 'border-ok'
                      : 'border-line-strong'
                }`}
              >
                Claude
                {lastClaude && (
                  <span
                    className={`text-[11px] font-normal ${lastClaude === 'waiting' ? 'text-warn' : lastClaude === 'working' ? 'text-ok' : 'text-muted'}`}
                  >
                    {t(CLAUDE_LABEL[lastClaude])}
                  </span>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-3">
            <span className="text-[26px] font-bold">{t('Nessun progetto, per ora')}</span>
            <span className="text-sm text-muted">
              {t('Cerca i tuoi repo in una cartella o aggiungili uno alla volta.')}
            </span>
            <button
              type="button"
              onClick={() => openSettings('progetti')}
              className="h-14 rounded-[14px] bg-accent px-5 text-base font-bold text-on-accent"
            >
              {t('Aggiungi progetti')}
            </button>
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-col gap-3">
        {/* Da sistemare: al massimo due, gli altri nel pannello */}
        {show.alerts && (
          <section className={`${box} flex-1 gap-2 p-4`}>
            <span className={eyebrow}>{t('Da sistemare')}</span>
            {problems.slice(0, 2).map((pr) => (
              <button
                key={pr.title}
                type="button"
                onClick={() => selectProject(pr.projectId, true)}
                className="flex shrink-0 items-center gap-2.5 rounded-xl bg-raised p-3 text-left text-[15px]"
              >
                <Dot color={pr.level} />
                <span className="min-w-0 flex-1 truncate">{pr.title}</span>
              </button>
            ))}
            {problems.length === 0 && (
              <span className="flex flex-1 items-center justify-center text-[15px] font-semibold text-ok">
                {t('Tutto ok')}
              </span>
            )}
            {problems.length > 2 && (
              <button
                type="button"
                onClick={() => openPanel('avvisi')}
                className="mt-auto text-left text-[13px] font-semibold text-muted"
              >
                {t('Altri {n}', { n: problems.length - 2 })}
              </button>
            )}
          </section>
        )}
        <MusicCard grow={!show.alerts} />
      </div>

      {bottom && (
        <div className="col-span-2 flex min-w-0 gap-2.5">
          {show.recent &&
            recent.map(({ p, at }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProject(p.id, true)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[14px] border border-line bg-card px-4 text-[15px] font-semibold"
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-[13px] font-normal text-muted">{at ? ago(at) : t('mai')}</span>
              </button>
            ))}
          {show.resources && <Resources onOpen={() => openSettings('sistema')} />}
        </div>
      )}
    </div>
  )
}

/** Musica in riproduzione con il tasto play/pausa */
function MusicCard({ grow }: { grow: boolean }) {
  const { say } = useDock()
  const { playing, track, press } = useMedia((r) => {
    if (!r.ok) say(r.error, true)
  })
  return (
    <section
      className={`${box} ${grow ? 'flex-1' : 'h-28 shrink-0'} flex-row items-center gap-3.5 px-4 py-3.5`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted">{track ? t('In riproduzione') : t('Musica')}</span>
        <span className="truncate text-base font-semibold">
          {track?.title || t('Niente in riproduzione')}
        </span>
        {track?.artist && <span className="truncate text-[13px] text-muted">{track.artist}</span>}
      </div>
      <button
        type="button"
        aria-label={playing ? t('Pausa') : t('Riproduci')}
        onClick={() => press('playpause')}
        className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
      >
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </button>
    </section>
  )
}

function Resources({ onOpen }: { onOpen: () => void }) {
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
      className="flex w-[220px] shrink-0 items-center justify-around rounded-[14px] border border-line bg-card font-mono text-sm"
    >
      <span>
        <span className="text-muted">CPU</span> {s?.cpu ?? 0}%
      </span>
      <span>
        <span className="text-muted">RAM</span> {s?.ram ?? 0}%
      </span>
    </button>
  )
}
