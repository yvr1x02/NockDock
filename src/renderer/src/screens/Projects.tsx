import { useState } from 'react'
import { CLAUDE_LABEL, api, useDock, type Problem } from '../lib/dock'
import { accountOf } from '../lib/accounts'
import { ago, opened } from '../lib/time'
import { Dot } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'
import { t } from '../lib/i18n'

const KIND_COLOR: Record<string, string> = {
  A: 'text-ok',
  '?': 'text-ok',
  D: 'text-err',
  M: 'text-warn',
  R: 'text-warn'
}

export function Projects() {
  const {
    config,
    state,
    git,
    dev,
    claude,
    vercel,
    selId,
    selectProject,
    run,
    openPanel,
    openSettings,
    refreshGit,
    problems
  } = useDock()
  const [info, setInfo] = useState(false)
  const sel = config.projects.find((p) => p.id === selId) ?? config.projects[0]
  if (!sel)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span className="text-[22px] font-bold">{t('Nessun progetto, per ora')}</span>
        <button
          type="button"
          onClick={() => openSettings('progetti')}
          className="h-[52px] rounded-[14px] bg-accent px-5 text-base font-bold text-on-accent"
        >
          {t('Aggiungi progetti')}
        </button>
      </div>
    )
  const cState = claude[sel.id]?.state
  const v = vercel[sel.id]
  const vercelSub = v?.latest
    ? `${v.latest.state === 'READY' ? t('online') : v.latest.state === 'ERROR' ? t('errore') : t('in corso')} · ${ago(v.latest.createdAt)}`
    : undefined

  // Pulsanti scelti nelle impostazioni; i link del progetto vanno in fondo come etichette
  const acts = config.projectActions
  const links = (sel.links ?? []).filter((l) => l.url)

  const g = git[sel.id]
  const d = dev[sel.id]
  const note = state.projects[sel.id]?.note
  const after = (): void => refreshGit(sel.id)
  const problemOf = (id: string): Problem | undefined => problems.find((p) => p.projectId === id)

  const meta = [
    g?.branch || '—',
    g?.commits[0] ? t('commit {ago}', { ago: ago(g.commits[0].date) }) : null
  ].filter(Boolean)

  return (
    <div className="flex h-full gap-3">
      {/* Lista: nome, colore dell'account e un pallino se c'è qualcosa da sistemare */}
      <div className="flex w-[248px] shrink-0 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {config.projects.map((p) => {
            const active = p.id === sel.id
            const pr = problemOf(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  selectProject(p.id)
                  setInfo(false)
                }}
                className={`flex h-14 shrink-0 items-center gap-3 rounded-[14px] border px-3.5 text-left ${
                  active ? 'border-accent bg-card' : 'border-transparent'
                }`}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: accountOf(config, p.account).color }}
                />
                <span className={`min-w-0 flex-1 truncate text-base ${active ? 'font-semibold' : ''}`}>
                  {p.name}
                </span>
                {pr && <Dot color={pr.level} />}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => run(api.openFolder(sel.id), t('Cartella di {name} aperta', { name: sel.name }))}
          className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl border border-dashed border-dash px-3.5 text-sm text-muted"
        >
          <Icon name="folder" size={18} />
          {t('Apri la cartella')}
        </button>
      </div>

      {/* Dettaglio */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-[18px] border border-line bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className="m-0 truncate text-[30px] leading-tight font-bold tracking-tight">{sel.name}</h1>
            <span className="truncate text-sm text-muted">
              {meta.join(' · ')}
              {d?.running && (
                <span className="text-ok">
                  {' · '}
                  {t('server :{port}', { port: d.port })}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setInfo((x) => !x)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${
              info
                ? 'border-line-strong bg-raised'
                : g?.ok && g.files.length
                  ? 'border-warn-line bg-warn-bg text-warn-soft'
                  : 'border-line-strong bg-raised text-soft'
            }`}
          >
            {info
              ? t('Pulsanti')
              : g?.ok === false
                ? t('Repo non trovato')
                : g?.files.length
                  ? t('{n} da committare', { n: g.files.length })
                  : t('Dettagli')}
          </button>
        </div>

        {info ? (
          /* File, commit e nota: a un tocco, per non affollare la schermata */
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-raised p-3.5">
              <span className="text-xs text-muted">
                {t('Non committate ·')}{' '}
                {g?.ok
                  ? g.files.length
                    ? t('{length} file', { length: g.files.length })
                    : t('nessuna')
                  : '—'}
              </span>
              {g?.files.slice(0, 8).map((f) => (
                <span key={f.path} className="flex gap-2 truncate font-mono text-xs">
                  <span className={`w-3 shrink-0 ${KIND_COLOR[f.kind] ?? 'text-warn'}`}>{f.kind}</span>
                  {f.path}
                </span>
              ))}
              {g && g.files.length > 8 && (
                <span className="text-xs text-muted">
                  {t('e altri')} {g.files.length - 8}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-raised p-3.5">
              <span className="text-xs text-muted">{t('Ultimi commit')}</span>
              {g?.commits.slice(0, 6).map((c) => (
                <span key={c.date + c.msg} className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate">{c.msg}</span>
                  <span className="shrink-0 text-muted">{ago(c.date)}</span>
                </span>
              ))}
              <span className="mt-auto text-xs text-muted">
                {t('Ultima apertura')} · {opened(state.projects[sel.id]?.lastOpenedAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openPanel({ note: sel.id })}
              className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-dashed border-dash p-3.5 text-left"
            >
              <span className="text-xs text-muted">{t('Nota per la prossima volta')}</span>
              <span className={`text-sm leading-snug ${note ? '' : 'text-muted'}`}>
                {note || t('Tocca per lasciarti una nota')}
              </span>
            </button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                run(api.openVsCode(sel.id), t('Apertura di {name} in VS Code', { name: sel.name }), after)
              }
              className="flex flex-col items-start justify-between rounded-2xl bg-accent p-4 text-left text-on-accent"
            >
              <Icon name="code" size={26} />
              <span className="text-lg font-bold">VS Code</span>
            </button>
            {acts.claude && (
              <Action
                icon="sparkle"
                label="Claude"
                sub={cState ? t(CLAUDE_LABEL[cState]) : undefined}
                subClass={cState === 'waiting' ? 'text-warn' : cState === 'working' ? 'text-ok' : undefined}
                highlight={cState === 'working'}
                onClick={() =>
                  run(api.openClaude(sel.id), t('Claude Code avviato in {path}', { path: sel.path }))
                }
              />
            )}
            {acts.dev && (
              <Action
                icon="play"
                label={t('Server')}
                sub={d?.running ? t('attivo') : d?.exitedWithError ? t('errore') : undefined}
                subClass={d?.running ? 'text-ok' : d?.exitedWithError ? 'text-err' : undefined}
                highlight={d?.running}
                onClick={() =>
                  d?.running
                    ? api
                        .devStop(sel.id)
                        .then(() => run(Promise.resolve({ ok: true }), t('Dev server fermato')))
                    : api
                        .devStart(sel.id)
                        .then(() =>
                          run(
                            Promise.resolve({ ok: true }),
                            t('Dev server avviato · {p0}', { p0: sel.devCommand ?? t('pnpm dev') })
                          )
                        )
                }
              />
            )}
            {acts.phone && (
              <Action icon="phone" label={t('Telefono')} onClick={() => openPanel('telefono')} />
            )}
            {acts.terminal && (
              <Action
                icon="terminal"
                label={t('Terminale')}
                onClick={() =>
                  run(api.openTerminal(sel.id), t('Terminale aperto in {path}', { path: sel.path }))
                }
              />
            )}
            {acts.vercel && (
              <Action
                icon="triangle"
                label="Vercel"
                sub={vercelSub}
                subClass={
                  v?.latest?.state === 'ERROR'
                    ? 'text-err'
                    : v?.latest?.state === 'READY'
                      ? 'text-ok'
                      : undefined
                }
                onClick={() => openPanel('vercel')}
              />
            )}
            {acts.github && (
              <Action
                icon="branch"
                label="GitHub"
                onClick={() => run(api.openLink(sel.id, 'github'), t('Repo aperto nel browser'))}
              />
            )}
            {acts.supabase && (
              <Action
                icon="database"
                label="Supabase"
                onClick={() => run(api.openLink(sel.id, 'supabase'), t('Supabase aperto nel browser'))}
              />
            )}
          </div>
        )}

        {links.length > 0 && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="mr-1 text-[13px] text-muted">{t('Link')}</span>
            {links.slice(0, 5).map((l) => (
              <button
                key={l.url}
                type="button"
                onClick={() =>
                  run(
                    api.openUrl(l.url, sel.account),
                    t('{name} aperto nel browser', { name: l.label || hostOf(l.url) })
                  )
                }
                className="h-9 shrink-0 rounded-full border border-line bg-raised px-3.5 text-sm"
              >
                {l.label || hostOf(l.url)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Action(props: {
  icon: IconName
  label: string
  sub?: string
  subClass?: string
  highlight?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex min-w-0 flex-col items-start justify-between rounded-2xl border bg-raised p-4 text-left ${
        props.highlight ? 'border-ok-line' : 'border-line-strong'
      }`}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <Icon name={props.icon} size={26} className={props.highlight ? 'text-ok' : 'text-soft'} />
        {props.sub && (
          <span className={`truncate text-[13px] ${props.subClass ?? 'text-muted'}`}>{props.sub}</span>
        )}
      </span>
      <span className="truncate text-lg font-semibold">{props.label}</span>
    </button>
  )
}
