import { useEffect, useState } from 'react'
import { HOME_CARDS, PROJECT_ACTIONS } from '@shared/types'
import type {
  AccountConfig,
  HomeCard,
  OptionalTab,
  ProjectAction,
  TabId,
  AudioApp,
  BrowserInfo,
  DisplayOption,
  DockConfig,
  ProjectConfig,
  ScannedRepo,
  SecretKey
} from '@shared/types'
import { api } from '../lib/dock'
import { COLOR_PRESETS, badgeStyle } from '../lib/accounts'
import {
  ColorChoice,
  Field,
  Group,
  NumberInput,
  Segmented,
  SmallButton,
  TextInput,
  Toggle
} from '../components/form'
import { Icon } from '../components/Icon'
import { t } from '../lib/i18n'

/** Modifica la bozza della configurazione (si salva solo con "Salva") */
export type Patch = (fn: (d: DockConfig) => DockConfig) => void

export interface SectionProps {
  draft: DockConfig
  patch: Patch
  /** Messaggio breve in basso (es. "Copiato") */
  say: (text: string, error?: boolean) => void
}

export function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'voce'
  )
}

function uniqueId(base: string, taken: string[]): string {
  let id = slug(base)
  for (let n = 2; taken.includes(id); n++) id = `${slug(base)}-${n}`
  return id
}

// ---------------------------------------------------------------- Generale

/** Scelta della lingua: automatica (quella di Windows), italiano o inglese */
export function LanguagePicker({ draft, patch }: Pick<SectionProps, 'draft' | 'patch'>) {
  return (
    <Segmented
      label={t('Lingua')}
      value={draft.language}
      onChange={(v) => patch((d) => ({ ...d, language: v }))}
      options={[
        { value: 'auto' as const, label: t('Automatica'), sub: t('come Windows') },
        { value: 'it' as const, label: 'Italiano' },
        { value: 'en' as const, label: 'English' }
      ]}
    />
  )
}

export function GeneralSection({ draft, patch }: SectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <Group title={t('Lingua')}>
        <LanguagePicker draft={draft} patch={patch} />
        <span className="text-xs text-muted">{t('La nuova lingua si vede dopo aver salvato.')}</span>
      </Group>
      <Group title={t('Avvio')}>
        <Toggle
          checked={draft.openAtLogin}
          onChange={(v) => patch((d) => ({ ...d, openAtLogin: v }))}
          label={t('Apri il dock all’accesso a Windows')}
          sub={t('Vale per l’app installata; durante lo sviluppo non si registra')}
        />
      </Group>
      <Group title={t('Touch')}>
        <Toggle
          checked={draft.restoreCursor}
          onChange={(v) => patch((d) => ({ ...d, restoreCursor: v }))}
          label={t('Rimetti il puntatore dove era dopo un tocco')}
          sub={t(
            'Windows sposta il mouse sul dock a ogni tocco: così torna sul monitor dove stavi lavorando'
          )}
        />
      </Group>
    </div>
  )
}

// ---------------------------------------------------------------- Aspetto

const TAB_LABEL: Record<TabId, string> = {
  home: 'Home',
  progetti: 'Progetti',
  scene: 'Giochi',
  postazione: 'Postazione',
  sistema: 'Sistema'
}
const HOME_LABEL: Record<HomeCard, [string, string]> = {
  alerts: ['Da sistemare', 'Gli avvisi: deploy in errore, Claude Code che aspetta, repo non trovati'],
  recent: ['Aperti di recente', 'Gli ultimi progetti aperti dal dock'],
  resources: ['Risorse del PC', 'CPU e RAM'],
  streak: ['Serie di commit e livello', 'Giorni di fila con almeno un commit'],
  recap: ['Recap di fine giornata', 'Il pulsante per chiudere la giornata']
}
const ACTION_LABEL: Record<ProjectAction, string> = {
  dev: 'Dev server',
  phone: 'Sul telefono',
  terminal: 'Terminale',
  github: 'GitHub',
  vercel: 'Vercel',
  supabase: 'Supabase',
  claude: 'Claude Code'
}

/** Scelta del tema: scuro, chiaro o come Windows */
export function ThemePicker({ draft, patch }: Pick<SectionProps, 'draft' | 'patch'>) {
  return (
    <Segmented
      label={t('Tema')}
      value={draft.theme}
      onChange={(v) => patch((d) => ({ ...d, theme: v }))}
      options={[
        { value: 'dark' as const, label: t('Scuro') },
        { value: 'light' as const, label: t('Chiaro') },
        { value: 'auto' as const, label: t('Come Windows') }
      ]}
    />
  )
}

/** Dopo quanti minuti senza tocchi parte l'orologio grande */
export function IdlePicker({ draft, patch }: Pick<SectionProps, 'draft' | 'patch'>) {
  return (
    <Segmented
      label={t('Schermata di riposo')}
      value={draft.idleMinutes}
      onChange={(v) => patch((d) => ({ ...d, idleMinutes: v }))}
      options={[
        { value: 0, label: t('Mai') },
        { value: 5, label: t('5 min') },
        { value: 10, label: t('10 min') },
        { value: 20, label: t('20 min') },
        { value: 30, label: t('30 min') },
        { value: 60, label: t('1 ora') }
      ]}
    />
  )
}

export function AppearanceSection({ draft, patch }: SectionProps) {
  const moveTab = (i: number, dir: -1 | 1): void =>
    patch((d) => {
      const order = [...d.tabOrder]
      const j = i + dir
      if (j < 0 || j >= order.length) return d
      ;[order[i], order[j]] = [order[j], order[i]]
      return { ...d, tabOrder: order }
    })
  return (
    <div className="flex flex-col gap-6">
      <Group title={t('Tema')}>
        <ThemePicker draft={draft} patch={patch} />
      </Group>
      <Group title={t('Schermata di riposo')}>
        <IdlePicker draft={draft} patch={patch} />
        <span className="text-xs text-muted">
          {t('Dopo quanto tempo senza tocchi compare l’orologio grande (con Yuyu, se è acceso).')}
        </span>
      </Group>
      <Group title={t('Schede')}>
        <p className="m-0 text-[13px] text-muted">
          {t(
            'Scegli l’ordine. Home, Progetti e Sistema restano sempre; Giochi e Postazione puoi nasconderle.'
          )}
        </p>
        <div className="flex flex-col gap-1.5">
          {draft.tabOrder.map((id, i) => {
            const optional = id === 'scene' || id === 'postazione'
            const visible = !optional || draft.tabs[id]
            return (
              <div
                key={id}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-line-strong bg-raised px-3"
              >
                <span className={`flex-1 text-sm font-semibold ${visible ? '' : 'text-dim line-through'}`}>
                  {t(TAB_LABEL[id])}
                </span>
                {optional && (
                  <button
                    type="button"
                    onClick={() =>
                      patch((d) => ({ ...d, tabs: { ...d.tabs, [id]: !d.tabs[id as OptionalTab] } }))
                    }
                    className="h-9 rounded-lg border border-line-strong px-3 text-xs font-semibold"
                  >
                    {visible ? t('Nascondi') : t('Mostra')}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t('Sposta su {name}', { name: t(TAB_LABEL[id]) })}
                  disabled={i === 0}
                  onClick={() => moveTab(i, -1)}
                  className="size-9 rounded-lg border border-line-strong text-sm font-bold"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('Sposta giù {name}', { name: t(TAB_LABEL[id]) })}
                  disabled={i === draft.tabOrder.length - 1}
                  onClick={() => moveTab(i, 1)}
                  className="size-9 rounded-lg border border-line-strong text-sm font-bold"
                >
                  ↓
                </button>
              </div>
            )
          })}
        </div>
      </Group>
      <Group title={t('Riquadri della Home')}>
        <p className="m-0 text-[13px] text-muted">{t('“Riprendi da dove avevi lasciato” resta sempre.')}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {HOME_CARDS.map((k) => (
            <Toggle
              key={k}
              checked={draft.home[k]}
              onChange={(v) => patch((d) => ({ ...d, home: { ...d.home, [k]: v } }))}
              label={t(HOME_LABEL[k][0])}
              sub={t(HOME_LABEL[k][1])}
            />
          ))}
        </div>
      </Group>
      <Group title={t('Pulsanti dei progetti')}>
        <p className="m-0 text-[13px] text-muted">
          {t('“Apri in VS Code” resta sempre. I link personalizzati si aggiungono in Progetti.')}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {PROJECT_ACTIONS.map((k) => (
            <Toggle
              key={k}
              checked={draft.projectActions[k]}
              onChange={(v) => patch((d) => ({ ...d, projectActions: { ...d.projectActions, [k]: v } }))}
              label={t(ACTION_LABEL[k])}
            />
          ))}
        </div>
      </Group>
    </div>
  )
}

// ---------------------------------------------------------------- Schermo

export function DisplaySection({ draft, patch }: SectionProps) {
  const [displays, setDisplays] = useState<DisplayOption[] | null>(null)
  useEffect(() => {
    api.listDisplays().then(setDisplays)
  }, [])
  const disp = draft.display
  const choose = (o: DisplayOption): void =>
    patch((d) => ({ ...d, display: { mode: 'display', displayId: o.id, width: o.width, height: o.height } }))

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-sm leading-relaxed text-soft">
        {t(
          'Scegli il monitor su cui vive il dock: lì l’app si apre a schermo intero, sempre in primo piano e senza rubare il focus alle altre finestre.'
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {displays?.map((o) => {
          const on = disp.mode === 'display' && disp.displayId === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o)}
              className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left ${
                on ? 'border-accent bg-accent-tint' : 'border-line-strong bg-raised'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-base font-bold">{o.label}</span>
                {on && <span className="text-xs font-semibold text-accent-text">{t('Dock')}</span>}
              </span>
              <span className="font-mono text-sm text-soft">
                {o.width}
                {t('×')}
                {o.height}
              </span>
              <span className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {o.primary && <Tag>{t('principale')}</Tag>}
                {o.touch && <Tag>{t('touch')}</Tag>}
                {o.current && <Tag>{t('il dock è qui')}</Tag>}
              </span>
            </button>
          )
        })}
        {displays === null && <span className="text-sm text-muted">{t('Cerco i monitor…')}</span>}
      </div>
      <Segmented
        label={t('Altre opzioni')}
        value={disp.mode === 'display' ? '' : disp.mode}
        onChange={(m) =>
          patch((d) => ({
            ...d,
            display: { mode: m as 'auto' | 'window', width: d.display.width, height: d.display.height }
          }))
        }
        options={[
          {
            value: 'auto',
            label: t('Automatico'),
            sub: t('cerca un monitor {width}×{height}', { width: disp.width, height: disp.height })
          },
          { value: 'window', label: t('Nessuno'), sub: t('finestra normale, per provarlo') }
        ]}
      />
      <p className="m-0 text-xs text-muted">
        {t(
          'Dopo aver salvato la finestra si sposta da sola. Se il touch finisce sul monitor sbagliato: Pannello di controllo → Impostazioni Tablet PC → Configura.'
        )}
      </p>
    </div>
  )
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-line px-2 py-0.5 text-soft">{children}</span>
}

// ---------------------------------------------------------------- Browser e account

const BROWSER_LABEL: Record<string, string> = {
  brave: 'Brave',
  chrome: 'Chrome',
  edge: 'Edge',
  default: 'Predefinito di Windows',
  custom: 'Altro'
}

export function AccountsSection({ draft, patch }: SectionProps) {
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([])
  useEffect(() => {
    api.detectBrowsers().then(setBrowsers)
  }, [])
  const current = browsers.find((b) => b.kind === draft.browser.kind)
  const profiles = current?.profiles ?? []
  const withProfiles = draft.browser.kind !== 'default'

  const setAccount = (id: string, fn: (a: AccountConfig) => AccountConfig): void =>
    patch((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? fn(a) : a)) }))

  const addAccount = (): void =>
    patch((d) => {
      const name = d.accounts.some((a) => a.id === 'lavoro')
        ? t('Account {p0}', { p0: d.accounts.length + 1 })
        : t('Lavoro')
      const used = d.accounts.map((a) => a.color)
      const color = COLOR_PRESETS.find((c) => !used.includes(c.color))?.color ?? COLOR_PRESETS[0].color
      const id = uniqueId(
        name,
        d.accounts.map((a) => a.id)
      )
      return { ...d, accounts: [...d.accounts, { id, name, color, browserProfile: '' }] }
    })

  const removeAccount = (id: string): void =>
    patch((d) => {
      const rest = d.accounts.filter((a) => a.id !== id)
      // I progetti dell'account tolto passano al primo
      return {
        ...d,
        accounts: rest,
        projects: d.projects.map((p) => (p.account === id ? { ...p, account: rest[0].id } : p))
      }
    })

  return (
    <div className="flex flex-col gap-6">
      <Group title={t('Browser per i link')}>
        <Segmented
          label={t('Browser')}
          value={draft.browser.kind}
          onChange={(kind) =>
            patch((d) => ({
              ...d,
              browser: {
                kind,
                path: browsers.find((b) => b.kind === kind)?.path ?? (kind === 'custom' ? d.browser.path : '')
              }
            }))
          }
          options={[
            ...browsers.map((b) => ({
              value: b.kind,
              label: b.name,
              sub: b.profiles.length === 1 ? t('1 profilo') : t('{n} profili', { n: b.profiles.length })
            })),
            { value: 'default' as const, label: t(BROWSER_LABEL.default), sub: t('senza profili') },
            { value: 'custom' as const, label: t(BROWSER_LABEL.custom), sub: t('basato su Chromium') }
          ]}
        />
        {draft.browser.kind === 'custom' && (
          <Field
            label={t('Percorso dell’eseguibile')}
            hint={t('Un browser basato su Chromium (es. Vivaldi, Opera)')}
          >
            <TextInput
              mono
              value={draft.browser.path}
              onChange={(v) => patch((d) => ({ ...d, browser: { ...d.browser, path: v } }))}
              placeholder={t('C:\\Program Files\\...\\browser.exe')}
            />
          </Field>
        )}
        {draft.browser.kind !== 'default' &&
          draft.browser.kind !== 'custom' &&
          !current &&
          browsers.length > 0 && (
            <span className="text-xs text-err">
              {t('Questo browser non risulta installato su questo PC.')}
            </span>
          )}
      </Group>

      <Group
        title={t('Account')}
        aside={
          draft.accounts.length < 4 && (
            <SmallButton onClick={addAccount}>
              <span className="flex items-center gap-2">
                <Icon name="user" size={16} /> {t('Aggiungi account')}
              </span>
            </SmallButton>
          )
        }
      >
        <p className="m-0 text-[13px] leading-snug text-muted">
          {t(
            'Ogni progetto appartiene a un account: quando lo apri il dock prende il suo colore, apre i link con il suo profilo del browser e usa il suo token Vercel.'
          )}
        </p>
        {draft.accounts.map((a) => (
          <div key={a.id} className="flex flex-col gap-3.5 rounded-xl border border-line-strong bg-card p-4">
            <div className="flex items-end gap-3">
              <Field label={t('Nome')} className="flex-1">
                <TextInput
                  value={a.name}
                  onChange={(v) => setAccount(a.id, (x) => ({ ...x, name: v }))}
                  label={t('Nome account {name}', { name: a.name })}
                />
              </Field>
              {draft.accounts.length > 1 && (
                <SmallButton danger onClick={() => removeAccount(a.id)}>
                  {t('Rimuovi')}
                </SmallButton>
              )}
            </div>
            <Field group label={t('Colore')}>
              <ColorChoice value={a.color} onChange={(v) => setAccount(a.id, (x) => ({ ...x, color: v }))} />
            </Field>
            {withProfiles && (
              <Field
                group

                label={t('Profilo di {p0}', { p0: t(BROWSER_LABEL[draft.browser.kind]) })}
                hint={
                  profiles.length ? undefined : t('Nome della cartella del profilo, es. Default o Profile 1')
                }
              >
                {profiles.length ? (
                  <Segmented
                    value={a.browserProfile}
                    onChange={(v) => setAccount(a.id, (x) => ({ ...x, browserProfile: v }))}
                    options={[
                      { value: '', label: t('Ultimo usato') },
                      ...profiles.map((p) => ({ value: p.dir, label: p.name, sub: p.dir }))
                    ]}
                  />
                ) : (
                  <TextInput
                    mono
                    value={a.browserProfile}
                    onChange={(v) => setAccount(a.id, (x) => ({ ...x, browserProfile: v }))}
                    placeholder={t('Default')}
                  />
                )}
              </Field>
            )}
            <Field
              label={t('Team Vercel (facoltativo)')}
              hint={t('Solo se i progetti di questo account stanno in un team: team_…')}
            >
              <TextInput
                mono
                value={a.vercelTeamId ?? ''}
                onChange={(v) => setAccount(a.id, (x) => ({ ...x, vercelTeamId: v.trim() || undefined }))}
                placeholder={t('team_…')}
              />
            </Field>
          </div>
        ))}
      </Group>
    </div>
  )
}

// ---------------------------------------------------------------- Progetti

function toProject(r: ScannedRepo, account: string, taken: string[]): ProjectConfig {
  return {
    id: uniqueId(r.id, taken),
    name: r.name,
    path: r.path,
    account,
    ...(r.devCommand ? { devCommand: r.devCommand } : {}),
    ...(r.devPort ? { devPort: r.devPort } : {}),
    ...(r.vercelProject ? { vercelProject: r.vercelProject } : {})
  }
}

/** Cerca i repo in una cartella e li aggiunge alla bozza */
export function ProjectImport({ draft, patch, say, onDone }: SectionProps & { onDone?: () => void }) {
  const [roots, setRoots] = useState<string[]>([])
  const [root, setRoot] = useState('')
  const [found, setFound] = useState<ScannedRepo[] | null>(null)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const existing = new Set(draft.projects.map((p) => p.path.toLowerCase()))
  const firstAccount = draft.accounts[0].id

  useEffect(() => {
    api.suggestRoots().then((r) => {
      setRoots(r)
      setRoot((cur) => cur || r[0] || '')
    })
  }, [])

  const scan = async (dir = root): Promise<void> => {
    if (!dir.trim()) return
    setBusy(true)
    const list = await api.scanFolder(dir.trim())
    setBusy(false)
    setFound(list)
    // Già selezionati tutti quelli nuovi, con il primo account
    setPicked(
      Object.fromEntries(
        list.filter((r) => !existing.has(r.path.toLowerCase())).map((r) => [r.path, firstAccount])
      )
    )
  }

  const add = (): void => {
    const chosen = (found ?? []).filter((r) => picked[r.path])
    patch((d) => {
      const taken = d.projects.map((p) => p.id)
      const added: ProjectConfig[] = []
      for (const r of chosen) {
        const p = toProject(r, picked[r.path], [...taken, ...added.map((x) => x.id)])
        added.push(p)
      }
      return { ...d, projects: [...d.projects, ...added] }
    })
    say(`${chosen.length} ${chosen.length === 1 ? t('progetto aggiunto') : t('progetti aggiunti')}`)
    setFound(null)
    onDone?.()
  }

  const count = Object.keys(picked).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-end gap-2">
        <Field label={t('Cartella dove tieni i repo')} className="flex-1">
          <TextInput mono value={root} onChange={setRoot} placeholder={t('C:\\dev')} />
        </Field>
        <SmallButton
          onClick={async () => {
            const dir = await api.pickFolder()
            if (dir) {
              setRoot(dir)
              scan(dir)
            }
          }}
        >
          {t('Scegli…')}
        </SmallButton>
        <SmallButton primary disabled={busy || !root.trim()} onClick={() => scan()}>
          {busy ? t('Cerco…') : t('Cerca')}
        </SmallButton>
      </div>
      {roots.length > 1 && !found && (
        <div className="flex flex-wrap gap-2">
          {roots.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRoot(r)
                scan(r)
              }}
              className="h-9 rounded-full border border-line-strong bg-raised px-3 font-mono text-xs"
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {found && (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {found.length === 0 && (
              <span className="text-sm text-muted">
                {t('Nessun repo git qui dentro (cerco fino a due livelli).')}
              </span>
            )}
            {found.map((r) => {
              const already = existing.has(r.path.toLowerCase())
              const acc = picked[r.path]
              return (
                <div
                  key={r.path}
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${
                    acc ? 'border-accent bg-raised' : 'border-line-strong bg-card'
                  } ${already ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!acc}
                    aria-label={t('Aggiungi {name}', { name: r.name })}
                    disabled={already}
                    onClick={() =>
                      setPicked((p) => {
                        const copy = { ...p }
                        if (copy[r.path]) delete copy[r.path]
                        else copy[r.path] = firstAccount
                        return copy
                      })
                    }
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ${
                      acc ? 'border-accent bg-accent text-on-accent' : 'border-dash'
                    }`}
                  >
                    {acc && <span className="text-base leading-none font-bold">✓</span>}
                  </button>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {r.name}
                      {r.framework && (
                        <span className="ml-2 text-xs font-normal text-muted">{r.framework}</span>
                      )}
                      {already && (
                        <span className="ml-2 text-xs font-normal text-muted">{t('già aggiunto')}</span>
                      )}
                    </span>
                    <span className="truncate font-mono text-[11px] text-muted">{r.path}</span>
                  </span>
                  {acc && draft.accounts.length > 1 && (
                    <span className="flex shrink-0 gap-1">
                      {draft.accounts.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setPicked((p) => ({ ...p, [r.path]: a.id }))}
                          className="h-9 rounded-lg border-2 px-2.5 text-xs font-semibold"
                          style={
                            acc === a.id
                              ? { ...badgeStyle(a.color), borderColor: a.color }
                              : { borderColor: 'transparent', color: 'var(--color-muted)' }
                          }
                        >
                          {a.name}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted">
              {t(
                'Comando del dev server, porta e progetto Vercel sono dedotti dal repo: puoi cambiarli dopo.'
              )}
            </span>
            <SmallButton primary disabled={!count} onClick={add}>
              {count
                ? t('Aggiungi {count} {p1}', { count, p1: count === 1 ? t('progetto') : t('progetti') })
                : t('Scegli i progetti')}
            </SmallButton>
          </div>
        </>
      )}
    </div>
  )
}

export function ProjectsSection(props: SectionProps) {
  const { draft, patch, say } = props
  const [sel, setSel] = useState(draft.projects[0]?.id ?? '')
  const [importing, setImporting] = useState(draft.projects.length === 0)
  const p = draft.projects.find((x) => x.id === sel)

  const setP = (fn: (x: ProjectConfig) => ProjectConfig): void =>
    patch((d) => ({ ...d, projects: d.projects.map((x) => (x.id === sel ? fn(x) : x)) }))

  const move = (dir: -1 | 1): void =>
    patch((d) => {
      const i = d.projects.findIndex((x) => x.id === sel)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.projects.length) return d
      const list = [...d.projects]
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...d, projects: list }
    })

  const addFolder = async (): Promise<void> => {
    const dir = await api.pickFolder()
    if (!dir) return
    const r = await api.inspectFolder(dir)
    if (!r) return say(t('Cartella non valida'), true)
    let newId = ''
    patch((d) => {
      const proj = toProject(
        r,
        d.accounts[0].id,
        d.projects.map((x) => x.id)
      )
      newId = proj.id
      return { ...d, projects: [...d.projects, proj] }
    })
    setTimeout(() => setSel(newId), 0)
  }

  if (importing)
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[15px] font-bold">{t('Cerca i progetti in una cartella')}</h3>
          {draft.projects.length > 0 && (
            <SmallButton onClick={() => setImporting(false)}>{t('Torna alla lista')}</SmallButton>
          )}
        </div>
        <ProjectImport {...props} onDone={() => setImporting(false)} />
      </div>
    )

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex w-[230px] shrink-0 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {draft.projects.map((x) => {
            const acc = draft.accounts.find((a) => a.id === x.account) ?? draft.accounts[0]
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setSel(x.id)}
                className={`flex h-12 shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left ${
                  x.id === sel ? 'border-accent bg-raised' : 'border-transparent'
                }`}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: acc.color }} />
                <span className="truncate text-sm font-semibold">{x.name || t('Senza nome')}</span>
              </button>
            )
          })}
        </div>
        <SmallButton onClick={() => setImporting(true)}>{t('Cerca in una cartella')}</SmallButton>
        <SmallButton onClick={addFolder}>{t('Aggiungi una cartella')}</SmallButton>
      </div>

      {p ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Nome')}>
              <TextInput value={p.name} onChange={(v) => setP((x) => ({ ...x, name: v }))} />
            </Field>
            <Field group label={t('Account')}>
              <Segmented
                value={p.account}
                onChange={(v) => setP((x) => ({ ...x, account: v }))}
                options={draft.accounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </Field>
          </div>
          <div className="flex items-end gap-2">
            <Field label={t('Cartella del repo')} className="flex-1">
              <TextInput mono value={p.path} onChange={(v) => setP((x) => ({ ...x, path: v }))} />
            </Field>
            <SmallButton
              onClick={async () => {
                const dir = await api.pickFolder()
                if (dir) setP((x) => ({ ...x, path: dir }))
              }}
            >
              {t('Scegli…')}
            </SmallButton>
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field
              label={t('Comando del dev server')}
              hint={t('In ascolto in rete per il QR del telefono: Next “-H 0.0.0.0”, Vite “--host”')}
            >
              <TextInput
                mono
                value={p.devCommand ?? ''}
                onChange={(v) => setP((x) => ({ ...x, devCommand: v || undefined }))}
                placeholder={t('pnpm dev --host')}
              />
            </Field>
            <Field label={t('Porta')}>
              <NumberInput
                value={p.devPort}
                min={1}
                max={65535}
                onChange={(v) => setP((x) => ({ ...x, devPort: v }))}
                placeholder="5173"
              />
            </Field>
          </div>
          <Field
            label={t('Progetto Vercel')}
            hint={t('Vuoto = lo trovo dal repo GitHub collegato a Vercel. Altrimenti nome o ID (prj_…)')}
          >
            <TextInput
              mono
              value={p.vercelProject ?? ''}
              onChange={(v) => setP((x) => ({ ...x, vercelProject: v.trim() || undefined }))}
              placeholder={t('nome-progetto')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Link dashboard Vercel')}>
              <TextInput
                mono
                value={p.vercelUrl ?? ''}
                onChange={(v) => setP((x) => ({ ...x, vercelUrl: v.trim() || undefined }))}
                placeholder={t('https://vercel.com/…')}
              />
            </Field>
            <Field label={t('Link dashboard Supabase')}>
              <TextInput
                mono
                value={p.supabaseUrl ?? ''}
                onChange={(v) => setP((x) => ({ ...x, supabaseUrl: v.trim() || undefined }))}
                placeholder={t('https://supabase.com/dashboard/project/…')}
              />
            </Field>
          </div>
          <Field
            group
            label={t('Link personalizzati')}
            hint={t(
              'Fino a 4 pulsanti in più nella pagina del progetto: Figma, Jira, il sito in produzione…'
            )}
          >
            <div className="flex flex-col gap-2">
              {(p.links ?? []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-[150px] shrink-0">
                    <TextInput
                      value={l.label}
                      label={t('Nome del link')}
                      placeholder={t('Nome')}
                      onChange={(v) =>
                        setP((x) => ({
                          ...x,
                          links: (x.links ?? []).map((y, j) => (j === i ? { ...y, label: v } : y))
                        }))
                      }
                    />
                  </div>
                  <TextInput
                    mono
                    value={l.url}
                    label={t('Indirizzo del link')}
                    placeholder="https://"
                    onChange={(v) =>
                      setP((x) => ({
                        ...x,
                        links: (x.links ?? []).map((y, j) => (j === i ? { ...y, url: v.trim() } : y))
                      }))
                    }
                  />
                  <SmallButton
                    danger
                    onClick={() => setP((x) => ({ ...x, links: (x.links ?? []).filter((_, j) => j !== i) }))}
                  >
                    {t('Rimuovi')}
                  </SmallButton>
                </div>
              ))}
              {(p.links ?? []).length < 4 && (
                <div>
                  <SmallButton
                    onClick={() =>
                      setP((x) => ({ ...x, links: [...(x.links ?? []), { label: '', url: 'https://' }] }))
                    }
                  >
                    {t('Aggiungi un link')}
                  </SmallButton>
                </div>
              )}
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <SmallButton onClick={() => move(-1)}>{t('Sposta su')}</SmallButton>
            <SmallButton onClick={() => move(1)}>{t('Sposta giù')}</SmallButton>
            <span className="flex-1" />
            <SmallButton
              danger
              onClick={() => {
                patch((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== sel) }))
                setSel(draft.projects.find((x) => x.id !== sel)?.id ?? '')
              }}
            >
              {t('Togli dal dock')}
            </SmallButton>
          </div>
          <span className="text-xs text-muted">
            {t('Togliere un progetto dal dock non tocca la cartella sul PC.')}
          </span>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          {t('Scegli un progetto a sinistra')}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Collegamenti

function SecretRow({
  k,
  label,
  hint,
  status,
  onSaved
}: {
  k: SecretKey
  label: string
  hint: string
  status: boolean
  onSaved: (s: Record<SecretKey, boolean>, removed: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const save = async (v: string): Promise<void> => {
    onSaved(await api.setSecret(k, v), !v.trim())
    setEditing(false)
    setValue('')
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-raised px-3.5 py-3">
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted">{hint}</span>
        </span>
        <span className={`shrink-0 text-xs font-semibold ${status ? 'text-ok' : 'text-dim'}`}>
          {status ? t('impostato') : t('non impostato')}
        </span>
      </span>
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save(value)
          }}
        >
          <TextInput
            type="password"
            mono
            value={value}
            onChange={setValue}
            placeholder={t('Incolla qui')}
            label={label}
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-bold text-on-accent"
          >
            {t('Salva')}
          </button>
        </form>
      ) : (
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-11 flex-1 rounded-lg border border-line-strong bg-line text-sm font-semibold"
          >
            {status ? t('Sostituisci') : t('Imposta')}
          </button>
          {status && (
            <button
              type="button"
              onClick={() => save('')}
              className="h-11 rounded-lg border border-line-strong bg-line px-4 text-sm font-semibold"
            >
              {t('Rimuovi')}
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export function LinksSection({ draft, patch, say }: SectionProps) {
  const [status, setStatus] = useState<Record<SecretKey, boolean>>({})
  const [hooks, setHooks] = useState<boolean | null>(null)
  useEffect(() => {
    api.secretsStatus().then(setStatus)
    api.claudeHooks().then(setHooks)
  }, [])
  const toggleHooks = async (on: boolean): Promise<void> => {
    const r = await api.setClaudeHooks(on)
    if (r.ok) setHooks(on)
    say(r.ok ? (on ? t('Claude Code collegato') : t('Claude Code scollegato')) : r.error, !r.ok)
  }
  const onSaved = (s: Record<SecretKey, boolean>, removed: boolean): void => {
    setStatus(s)
    say(removed ? t('Token rimosso') : t('Salvato, cifrato con il tuo account di Windows'))
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-5">
        <Group title={t('Vercel')}>
          <span className="text-xs text-muted">
            {t('Un token per account: vercel.com → Account Settings → Tokens')}
          </span>
          {draft.accounts.map((a) => (
            <SecretRow
              key={a.id}
              k={`vercel.${a.id}`}
              label={t('Token Vercel · {name}', { name: a.name })}
              hint={
                a.vercelTeamId
                  ? t('team {vercelTeamId}', { vercelTeamId: a.vercelTeamId })
                  : t('progetti fuori da un team')
              }
              status={!!status[`vercel.${a.id}`]}
              onSaved={onSaved}
            />
          ))}
        </Group>
        <Group title={t('Steam')}>
          <Field label={t('Cartella di Steam')} hint={t('Vuota = la trovo da solo')}>
            <TextInput
              mono
              value={draft.steamPath}
              onChange={(v) => patch((d) => ({ ...d, steamPath: v }))}
              placeholder={t('C:\\Program Files (x86)\\Steam')}
            />
          </Field>
        </Group>
      </div>

      <Group title={t('Claude Code')}>
        <p className="m-0 text-sm leading-relaxed text-soft">
          {t(
            'Collegalo per far sapere al dock (e a Yuyu) quando Claude lavora, aspetta te o ha finito. Nockdock aggiunge i suoi hook alle impostazioni di Claude Code e lascia il resto com’è.'
          )}
        </p>
        <span className={`text-sm font-semibold ${hooks ? 'text-ok' : 'text-muted'}`}>
          {hooks === null ? '…' : hooks ? t('Collegato') : t('Non collegato')}
        </span>
        <div className="flex gap-2">
          {hooks ? (
            <SmallButton onClick={() => void toggleHooks(false)}>{t('Scollega')}</SmallButton>
          ) : (
            <SmallButton primary onClick={() => void toggleHooks(true)}>
              {t('Collega Claude Code')}
            </SmallButton>
          )}
        </div>
        <span className="text-xs text-muted">
          {t('Vale per le sessioni di Claude Code aperte dopo il collegamento.')}
        </span>
      </Group>
    </div>
  )
}

// ---------------------------------------------------------------- Yuyu

export function YuyuSection({ draft, patch }: SectionProps) {
  const b = draft.buddy
  const set = (v: Partial<DockConfig['buddy']>): void => patch((d) => ({ ...d, buddy: { ...d.buddy, ...v } }))
  return (
    <div className="flex flex-col gap-6">
      <Toggle
        checked={b.enabled}
        onChange={(v) => set({ enabled: v })}
        label={t('Mostra Yuyu')}
        sub={t('Cammina nella barra in alto, reagisce a quello che fai e segue Claude Code')}
      />
      <Group title={t('Quando dorme')}>
        <div className="grid grid-cols-2 gap-4">
          <HourPicker
            label={t('Va a dormire alle')}
            value={b.sleepFrom}
            onChange={(v) => set({ sleepFrom: v })}
          />
          <HourPicker label={t('Si sveglia alle')} value={b.sleepTo} onChange={(v) => set({ sleepTo: v })} />
        </div>
        <span className="text-xs text-muted">
          {b.sleepFrom === b.sleepTo
            ? t('Con le due ore uguali non dorme mai.')
            : t('Mentre dorme non reagisce, tranne a Claude Code. Se lo tocchi si sveglia.')}
        </span>
      </Group>
    </div>
  )
}

function HourPicker({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Field group label={label}>
      <div className="flex items-center gap-2">
        <SmallButton onClick={() => onChange((value + 23) % 24)}>−</SmallButton>
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg bg-raised font-mono text-lg font-bold">
          {String(value).padStart(2, '0')}:00
        </span>
        <SmallButton onClick={() => onChange((value + 1) % 24)}>+</SmallButton>
      </div>
    </Field>
  )
}

// ---------------------------------------------------------------- Postazione

export function PostazioneSection({ draft, patch }: SectionProps) {
  const [apps, setApps] = useState<AudioApp[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.getAudio().then((a) => {
      if (a.ok) setApps(a.apps)
      else setError(a.error ?? t('Audio non disponibile'))
    })
  }, [])
  const hidden = new Set(draft.postazione.hiddenApps)
  const known = [
    ...(apps ?? []),
    ...draft.postazione.hiddenApps
      .filter((k) => !apps?.some((a) => a.key === k))
      .map((k) => ({ key: k, name: k, volume: 0, muted: false }))
  ]
  const toggle = (key: string): void =>
    patch((d) => {
      const list = d.postazione.hiddenApps
      return {
        ...d,
        postazione: { hiddenApps: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] }
      }
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm leading-relaxed text-soft">
        {t(
          'Nel mixer compaiono le app che in questo momento usano l’audio. Spegni quelle che non vuoi vedere (es. processi di servizio).'
        )}
      </p>
      {error && <span className="text-sm text-err">{error}</span>}
      <div className="grid grid-cols-2 gap-2.5">
        {known.map((a) => (
          <Toggle
            key={a.key}
            checked={!hidden.has(a.key)}
            onChange={() => toggle(a.key)}
            label={a.name}
            sub={a.key}
          />
        ))}
      </div>
      {apps?.length === 0 && (
        <span className="text-sm text-muted">{t('Nessuna app sta usando l’audio adesso.')}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Snippet

export function SnippetSection({ draft, patch }: SectionProps) {
  const set = (i: number, v: Partial<{ label: string; text: string }>): void =>
    patch((d) => ({ ...d, snippets: d.snippets.map((s, j) => (j === i ? { ...s, ...v } : s)) }))
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-soft">
        {t('Testi che copi spesso: in Sistema basta un tocco per averli negli appunti.')}
      </p>
      {draft.snippets.map((s, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-line-strong bg-card p-3">
          <div className="flex w-[220px] shrink-0 flex-col gap-2">
            <TextInput
              value={s.label}
              onChange={(v) => set(i, { label: v })}
              placeholder={t('Nome')}
              label={t('Nome dello snippet')}
            />
            <SmallButton
              danger
              onClick={() => patch((d) => ({ ...d, snippets: d.snippets.filter((_, j) => j !== i) }))}
            >
              {t('Elimina')}
            </SmallButton>
          </div>
          <textarea
            value={s.text}
            aria-label={t('Testo di {label}', { label: s.label })}
            onChange={(e) => set(i, { text: e.target.value })}
            className="min-h-[92px] flex-1 resize-none rounded-lg border border-line-strong bg-ground p-3 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      ))}
      <div>
        <SmallButton
          onClick={() =>
            patch((d) => ({ ...d, snippets: [...d.snippets, { label: t('Nuovo snippet'), text: '' }] }))
          }
        >
          {t('Aggiungi snippet')}
        </SmallButton>
      </div>
    </div>
  )
}
