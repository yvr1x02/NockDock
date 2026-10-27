import type { ReactNode } from 'react'
import { CLAUDE_LABEL, api, useDock } from '../lib/dock'
import { accountOf, badgeStyle } from '../lib/accounts'
import { ago, initials, opened } from '../lib/time'
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
    refreshGit
  } = useDock()
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
    ? `${v.latest.state === 'READY' ? t('ok') : v.latest.state === 'ERROR' ? t('errore') : t('in corso')} · ${ago(v.latest.createdAt)}`
    : t('deploy e QR')

  // Pulsanti scelti nelle impostazioni, poi i link del progetto fino a riempire la griglia (8 posti)
  const acts = config.projectActions
  const used = 1 + Object.values(acts).filter(Boolean).length
  const links = (sel.links ?? []).filter((l) => l.url).slice(0, Math.max(0, 8 - used))

  const g = git[sel.id]
  const d = dev[sel.id]
  const note = state.projects[sel.id]?.note
  const after = (): void => refreshGit(sel.id)

  return (
    <div className="flex h-full gap-3">
      {/* Lista */}
      <div className="flex w-[248px] shrink-0 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col gap-[5px] overflow-y-auto">
          {config.projects.map((p) => {
            const active = p.id === sel.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProject(p.id)}
                className={`flex h-[50px] shrink-0 items-center gap-3 rounded-xl border px-3 text-left ${
                  active ? 'border-accent bg-raised' : 'border-transparent'
                }`}
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-xs font-bold"
                  style={badgeStyle(accountOf(config, p.account).color)}
                >
                  {initials(p.name)}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="truncate text-xs text-muted">
                    {accountOf(config, p.account).name} · {git[p.id]?.branch || '—'}
                  </span>
                </span>
                {p.id === state.lastProjectId && (
                  <span className="ml-auto flex h-[22px] shrink-0 items-center rounded-full bg-line px-2 text-[11px] font-semibold">
                    {t('ultimo')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => run(api.openFolder(sel.id), t('Cartella di {name} aperta', { name: sel.name }))}
          className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl border border-dashed border-dash px-3 text-sm font-medium"
        >
          <Icon name="folder" size={18} className="text-muted" />
          {t('Apri la cartella')}
        </button>
      </div>

      {/* Dettaglio */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="m-0 text-2xl font-bold tracking-tight">{sel.name}</h1>
            <span className="truncate font-mono text-[13px] text-muted">{sel.path}</span>
          </div>
          <span
            className="flex h-7 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold"
            style={badgeStyle(accountOf(config, sel.account).color)}
          >
            {accountOf(config, sel.account).name}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <Stat label={t('Branch')} mono>
            {g?.branch || '—'}
          </Stat>
          <Stat label={t('Ultimo commit')}>{g?.commits[0] ? ago(g.commits[0].date) : '—'}</Stat>
          <Stat label={t('Dev server')}>
            <span className="flex items-center gap-1.5">
              <Dot color={d?.running ? 'ok' : d?.exitedWithError ? 'err' : 'muted'} />
              {d?.running
                ? t('attivo · :{port}', { port: d.port })
                : d?.exitedWithError
                  ? t('errore')
                  : t('fermo')}
            </span>
          </Stat>
          <Stat label={t('Ultima apertura')}>{opened(state.projects[sel.id]?.lastOpenedAt)}</Stat>
        </div>

        <div className="grid grid-cols-3 gap-4 rounded-xl bg-raised px-3.5 py-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-muted">
              {t('Non committate ·')}{' '}
              {g?.ok ? (g.files.length ? t('{length} file', { length: g.files.length }) : t('nessuna')) : '—'}
            </span>
            {g?.ok === false && <span className="text-[13px] text-err">{t('Repo non trovato')}</span>}
            {g?.files.slice(0, 3).map((f) => (
              <span key={f.path} className="flex gap-2 truncate font-mono text-xs">
                <span className={`w-3 shrink-0 ${KIND_COLOR[f.kind] ?? 'text-warn'}`}>{f.kind}</span>
                {f.path}
              </span>
            ))}
            {g && g.files.length > 3 && (
              <span className="text-xs text-muted">
                {t('e altri')} {g.files.length - 3}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-muted">{t('Ultimi commit')}</span>
            {g?.commits.slice(0, 3).map((c) => (
              <span key={c.date + c.msg} className="flex justify-between gap-2 text-[13px]">
                <span className="truncate">{c.msg}</span>
                <span className="shrink-0 text-muted">{ago(c.date)}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openPanel({ note: sel.id })}
            className="-my-1 flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-dashed border-dash px-2.5 py-2 text-left"
          >
            <span className="text-xs text-muted">{t('Nota per la prossima volta')}</span>
            <span className={`line-clamp-3 text-[13px] leading-snug ${note ? '' : 'text-muted'}`}>
              {note || t('Tocca per lasciarti una nota')}
            </span>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-2.5">
          <button
            type="button"
            onClick={() =>
              run(api.openVsCode(sel.id), t('Apertura di {name} in VS Code', { name: sel.name }), after)
            }
            className="flex items-center gap-3 rounded-[14px] bg-accent px-4 text-left text-base font-bold text-on-accent"
          >
            <Icon name="code" size={22} />
            {t('Apri in VS Code')}
          </button>
          {acts.dev && (
            <Action
              icon="play"
              label={t('Dev server')}
              sub={d?.running ? t('attivo · :{port}', { port: d.port }) : t('fermo')}
              subClass={d?.running ? 'text-ok' : undefined}
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
            <Action
              icon="phone"
              label={t('Sul telefono')}
              sub={t('QR del dev server')}
              onClick={() => openPanel('telefono')}
            />
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
          {acts.github && (
            <Action
              icon="branch"
              label={t('GitHub')}
              onClick={() => run(api.openLink(sel.id, 'github'), t('Repo aperto nel browser'))}
            />
          )}
          {acts.vercel && (
            <Action
              icon="triangle"
              label={t('Vercel')}
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
          {acts.supabase && (
            <Action
              icon="database"
              label={t('Supabase')}
              onClick={() => run(api.openLink(sel.id, 'supabase'), t('Supabase aperto nel browser'))}
            />
          )}
          {acts.claude && (
            <Action
              icon="sparkle"
              label={t('Claude Code')}
              sub={cState ? t(CLAUDE_LABEL[cState]) : t('nuova sessione')}
              subClass={cState === 'waiting' ? 'text-warn' : cState === 'working' ? 'text-ok' : undefined}
              highlight={cState === 'working'}
              onClick={() =>
                run(api.openClaude(sel.id), t('Claude Code avviato in {path}', { path: sel.path }))
              }
            />
          )}
          {links.map((l) => (
            <Action
              key={l.url}
              icon="open"
              label={l.label || hostOf(l.url)}
              sub={hostOf(l.url)}
              onClick={() =>
                run(
                  api.openUrl(l.url, sel.account),
                  t('{name} aperto nel browser', { name: l.label || hostOf(l.url) })
                )
              }
            />
          ))}
        </div>
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

function Stat({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] rounded-xl bg-raised px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className={`truncate text-[13px] ${mono ? 'font-mono' : ''}`}>{children}</span>
    </div>
  )
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
      className={`flex min-w-0 items-center gap-3 rounded-[14px] border bg-raised px-3.5 text-left text-sm font-medium ${
        props.highlight ? 'border-ok' : 'border-line-strong'
      }`}
    >
      <Icon name={props.icon} size={20} className="text-soft" />
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate">{props.label}</span>
        {props.sub && (
          <span className={`truncate text-xs ${props.subClass ?? 'text-muted'}`}>{props.sub}</span>
        )}
      </span>
    </button>
  )
}
