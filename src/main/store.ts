import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { HOME_CARDS, PROJECT_ACTIONS, TAB_IDS } from '@shared/types'
import type { AccountConfig, AccountMode, DisplayConfig, DockConfig, DockState } from '@shared/types'

export const CONFIG_VERSION = 2

/** Colori pronti per gli account: il primo è quello di "Personale", il secondo di "Lavoro". */
export const ACCOUNT_COLORS = [
  '#b3202f',
  '#a98bff',
  '#2f80ed',
  '#1fa971',
  '#f2994a',
  '#e0559b',
  '#14b8c4',
  '#c9a227'
]

/** Configurazione di partenza per un utente nuovo: il setup guidato la completa. */
export const DEFAULT_CONFIG: DockConfig = {
  version: CONFIG_VERSION,
  language: 'auto',
  setupDone: false,
  projects: [],
  accounts: [{ id: 'personale', name: 'Personale', color: ACCOUNT_COLORS[0], browserProfile: '' }],
  browser: { kind: 'default', path: '' },
  display: { mode: 'auto', width: 1024, height: 600 },
  openAtLogin: true,
  tabs: { scene: true, postazione: true },
  tabOrder: [...TAB_IDS],
  theme: 'dark',
  idleMinutes: 10,
  home: { alerts: true, recent: true, resources: true, streak: true, recap: true },
  projectActions: {
    dev: true,
    phone: true,
    terminal: true,
    github: true,
    vercel: true,
    supabase: true,
    claude: true
  },
  buddy: { enabled: true, sleepFrom: 23, sleepTo: 7 },
  twitch: { clientId: '', channels: [] },
  steamPath: '',
  postazione: { hiddenApps: [] },
  snippets: []
}

export const DEFAULT_STATE: DockState = { mode: 'personale', projects: {} }

/** Formato della versione 0.1–0.4 (account fissi Personale/Lavoro e solo Brave) */
interface LegacyConfig {
  accounts?: Record<string, { braveProfile?: string; vercelTeamId?: string }>
  bravePath?: string
  dockDisplay?: { width: number; height: number }
}

const LEGACY_ACCOUNTS: Record<string, { name: string; color: string }> = {
  personale: { name: 'Personale', color: ACCOUNT_COLORS[0] },
  lavoro: { name: 'Lavoro', color: ACCOUNT_COLORS[1] }
}

const HEX = /^#[0-9a-f]{6}$/i
const int = (v: unknown, d: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d

export function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'progetto'
  )
}

function normalizeAccounts(raw: unknown): AccountConfig[] {
  let list: AccountConfig[] = []
  if (Array.isArray(raw)) {
    list = raw
      .filter((a): a is Partial<AccountConfig> => !!a && typeof a === 'object')
      .map((a, i) => ({
        id: slug(String(a.id || a.name || `account-${i + 1}`)),
        name: String(a.name || a.id || `Account ${i + 1}`).trim(),
        color: HEX.test(String(a.color))
          ? String(a.color).toLowerCase()
          : ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
        browserProfile: String(a.browserProfile ?? ''),
        ...(a.vercelTeamId ? { vercelTeamId: String(a.vercelTeamId) } : {})
      }))
  } else if (raw && typeof raw === 'object') {
    // Migrazione dal vecchio formato { personale: {...}, lavoro: {...} }
    list = Object.entries(raw as NonNullable<LegacyConfig['accounts']>).map(([id, a], i) => ({
      id,
      name: LEGACY_ACCOUNTS[id]?.name ?? id,
      color: LEGACY_ACCOUNTS[id]?.color ?? ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      browserProfile: a?.braveProfile ?? '',
      ...(a?.vercelTeamId ? { vercelTeamId: a.vercelTeamId } : {})
    }))
  }
  // id unici, almeno un account
  const seen = new Set<string>()
  list = list.filter((a) => !seen.has(a.id) && seen.add(a.id))
  return list.length ? list : DEFAULT_CONFIG.accounts.map((a) => ({ ...a }))
}

/** Unisce la configurazione letta con i valori predefiniti e migra i formati vecchi. */
type RawConfig = Partial<Omit<DockConfig, 'accounts'>> &
  Omit<LegacyConfig, 'accounts'> & { accounts?: unknown }

export function normalizeConfig(raw: unknown): DockConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as RawConfig
  const legacy = c.version === undefined && raw !== undefined
  const accounts = normalizeAccounts(c.accounts)
  const accountIds = new Set(accounts.map((a) => a.id))

  const browser: DockConfig['browser'] =
    c.browser && typeof c.browser === 'object'
      ? { kind: c.browser.kind ?? 'default', path: c.browser.path ?? '' }
      : c.bravePath
        ? { kind: 'brave', path: c.bravePath }
        : { ...DEFAULT_CONFIG.browser }

  const display: DisplayConfig = {
    ...DEFAULT_CONFIG.display,
    ...(c.dockDisplay ?? {}),
    ...(c.display ?? {})
  }
  if (!['auto', 'display', 'window'].includes(display.mode)) display.mode = 'auto'

  const projects = (Array.isArray(c.projects) ? c.projects : [])
    .filter((p) => p && typeof p.path === 'string')
    .map((p) => ({
      ...p,
      links: Array.isArray(p.links)
        ? p.links.filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url)).slice(0, 4)
        : undefined,
      id: p.id || slug(p.name || p.path),
      name: p.name || p.id || p.path,
      account: accountIds.has(p.account) ? p.account : accounts[0].id
    }))

  const rawBuddy = (c.buddy ?? {}) as Partial<DockConfig['buddy']> & { idleMinutes?: number }
  const buddy = {
    enabled: rawBuddy.enabled ?? DEFAULT_CONFIG.buddy.enabled,
    sleepFrom: rawBuddy.sleepFrom ?? DEFAULT_CONFIG.buddy.sleepFrom,
    sleepTo: rawBuddy.sleepTo ?? DEFAULT_CONFIG.buddy.sleepTo
  }
  // Fino alla 0.6 i minuti della schermata di riposo stavano dentro "buddy"
  const idleMinutes = int(c.idleMinutes ?? rawBuddy.idleMinutes, 10, 0, 240)
  // Ordine delle schede: ognuna una volta sola, quelle mancanti in fondo
  const order = (Array.isArray(c.tabOrder) ? c.tabOrder : []).filter(
    (t, i, a) => TAB_IDS.includes(t) && a.indexOf(t) === i
  )
  const tabOrder = [...order, ...TAB_IDS.filter((t) => !order.includes(t))]
  const bools = <K extends string>(keys: K[], raw: unknown): Record<K, boolean> =>
    Object.fromEntries(
      keys.map((k) => [k, (raw as Record<string, unknown> | undefined)?.[k] !== false])
    ) as Record<K, boolean>
  buddy.sleepFrom = int(buddy.sleepFrom, 23, 0, 23)
  buddy.sleepTo = int(buddy.sleepTo, 7, 0, 23)

  return {
    version: CONFIG_VERSION,
    language: c.language === 'it' || c.language === 'en' ? c.language : 'auto',
    // Chi aveva già una configurazione (versioni 0.1–0.4) non rifà il setup
    setupDone: legacy ? true : c.setupDone === true,
    projects,
    accounts,
    browser,
    display,
    openAtLogin: c.openAtLogin ?? DEFAULT_CONFIG.openAtLogin,
    tabs: { ...DEFAULT_CONFIG.tabs, ...(c.tabs ?? {}) },
    tabOrder,
    theme: c.theme === 'light' || c.theme === 'auto' ? c.theme : 'dark',
    idleMinutes,
    home: bools(HOME_CARDS, c.home),
    projectActions: bools(PROJECT_ACTIONS, c.projectActions),
    snippets: Array.isArray(c.snippets) ? c.snippets.filter((s) => s && s.label) : [],
    buddy,
    twitch: {
      ...DEFAULT_CONFIG.twitch,
      ...(c.twitch ?? {}),
      channels: Array.isArray(c.twitch?.channels) ? c.twitch.channels : []
    },
    steamPath: c.steamPath ?? '',
    postazione: {
      hiddenApps: Array.isArray(c.postazione?.hiddenApps) ? c.postazione.hiddenApps : []
    }
  }
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

export class Store {
  readonly configPath: string
  readonly statePath: string
  config: DockConfig
  state: DockState

  constructor(dir: string) {
    this.configPath = join(dir, 'config.json')
    this.statePath = join(dir, 'state.json')
    if (!existsSync(this.configPath)) writeJson(this.configPath, DEFAULT_CONFIG)
    const raw = readJson<DockConfig>(this.configPath)
    this.config = normalizeConfig(raw)
    // Riscrive subito i file vecchi nel formato nuovo, così config.json resta leggibile
    if (raw && raw.version !== CONFIG_VERSION) this.writeConfig(this.config)
    this.state = { ...DEFAULT_STATE, ...(readJson<DockState>(this.statePath) ?? {}) }
    this.fixMode()
  }

  /** Momento dell'ultima scrittura fatta dall'app, per non scambiarla per una modifica a mano */
  lastWrite = 0

  private writeConfig(cfg: DockConfig): void {
    this.lastWrite = Date.now()
    writeJson(this.configPath, cfg)
  }

  saveConfig(cfg: DockConfig): DockConfig {
    this.config = normalizeConfig({ ...cfg, version: CONFIG_VERSION })
    this.writeConfig(this.config)
    this.fixMode()
    return this.config
  }

  /** Se l'account attivo non esiste più, torna al primo */
  private fixMode(): void {
    if (!this.config.accounts.some((a) => a.id === this.state.mode)) {
      this.state.mode = this.config.accounts[0].id
      this.save()
    }
  }

  reloadConfig(): DockConfig {
    const raw = readJson<DockConfig>(this.configPath)
    if (raw) this.config = normalizeConfig(raw)
    this.fixMode()
    return this.config
  }

  project(id: string) {
    return this.config.projects.find((p) => p.id === id)
  }

  private save(): void {
    writeJson(this.statePath, this.state)
  }

  setMode(mode: AccountMode): DockState {
    if (!this.config.accounts.some((a) => a.id === mode)) return this.state
    this.state.mode = mode
    this.save()
    return this.state
  }

  setNote(projectId: string, note: string): DockState {
    const p = this.state.projects[projectId] ?? {}
    this.state.projects[projectId] = { ...p, note: note.trim() }
    this.save()
    return this.state
  }

  /** Segna il progetto come "ultimo aperto" e allinea l'account al suo. */
  touchProject(projectId: string): void {
    const cfg = this.project(projectId)
    const p = this.state.projects[projectId] ?? {}
    this.state.projects[projectId] = { ...p, lastOpenedAt: new Date().toISOString() }
    this.state.lastProjectId = projectId
    if (cfg) this.state.mode = cfg.account
    this.save()
  }
}
