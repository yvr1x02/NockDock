import type { LangSetting } from './i18n'

/** Identificativo di un account (es. "personale", "lavoro"): gli account li decide l'utente */
export type AccountMode = string

export interface ProjectConfig {
  /** Identificativo breve, senza spazi (es. "shop") */
  id: string
  name: string
  /** Cartella del repo sul PC (es. "C:\\dev\\acme-shop") */
  path: string
  /** id dell'account a cui appartiene il progetto */
  account: AccountMode
  /** Comando del dev server, già in ascolto in rete (es. "pnpm dev -H 0.0.0.0" per Next, "pnpm dev --host" per Vite) */
  devCommand?: string
  /** Porta del dev server, usata per localhost e per il QR del telefono */
  devPort?: number
  /** Link del progetto su Vercel e Supabase (dashboard) */
  vercelUrl?: string
  supabaseUrl?: string
  /** Nome o ID del progetto su Vercel, per leggere i deploy (serve il token dell'account) */
  vercelProject?: string
  /** Pulsanti in più nella pagina del progetto (es. Figma, Jira, il sito in produzione) */
  links?: ProjectLink[]
}

export interface ProjectLink {
  label: string
  url: string
}

export interface AccountConfig {
  id: AccountMode
  /** Nome mostrato (es. "Personale") */
  name: string
  /** Colore d'accento dell'interfaccia quando l'account è attivo (#rrggbb) */
  color: string
  /** Cartella del profilo del browser (es. "Default", "Profile 1"); vuota = profilo predefinito */
  browserProfile: string
  /** ID del team Vercel, solo se i progetti sono in un team */
  vercelTeamId?: string
}

export type BrowserKind = 'brave' | 'chrome' | 'edge' | 'default' | 'custom'

export interface BrowserConfig {
  /** default = browser predefinito di Windows (senza profili) */
  kind: BrowserKind
  /** Percorso dell'eseguibile (non serve per "default") */
  path: string
}

export interface DisplayConfig {
  /**
   * auto: cerca il monitor con la risoluzione indicata;
   * display: usa il monitor scelto nelle impostazioni;
   * window: niente schermo dedicato, finestra normale
   */
  mode: 'auto' | 'display' | 'window'
  /** Monitor scelto (modalità "display") */
  displayId?: number
  /** Risoluzione del monitor del dock, usata per riconoscerlo */
  width: number
  height: number
}

export interface TwitchConfig {
  /** Client ID dell'app registrata su dev.twitch.tv (il Client Secret va nei Collegamenti) */
  clientId: string
  /** Nomi dei canali da controllare (es. "nomecanale") */
  channels: string[]
}

export interface Snippet {
  label: string
  text: string
}

/** Schede che si possono nascondere (Home, Progetti e Sistema restano sempre) */
export type OptionalTab = 'scene' | 'postazione'
export type TabId = 'home' | 'progetti' | 'scene' | 'postazione' | 'sistema'
export const TAB_IDS: TabId[] = ['home', 'progetti', 'scene', 'postazione', 'sistema']

/** Riquadri della Home che si possono nascondere (Riprendi resta sempre) */
export type HomeCard = 'alerts' | 'recent' | 'resources' | 'streak' | 'recap'
export const HOME_CARDS: HomeCard[] = ['alerts', 'recent', 'resources', 'streak', 'recap']

/** Pulsanti della pagina di un progetto (Apri in VS Code resta sempre) */
export type ProjectAction = 'dev' | 'phone' | 'terminal' | 'github' | 'vercel' | 'supabase' | 'claude'
export const PROJECT_ACTIONS: ProjectAction[] = [
  'dev',
  'phone',
  'terminal',
  'github',
  'vercel',
  'supabase',
  'claude'
]

export type ThemeSetting = 'dark' | 'light' | 'auto'

export interface DockConfig {
  /** Versione del formato del file, per le migrazioni */
  version: number
  /** Lingua dell'interfaccia: auto = quella di Windows */
  language: LangSetting
  /** false finché non è stato completato il setup guidato */
  setupDone: boolean
  projects: ProjectConfig[]
  accounts: AccountConfig[]
  browser: BrowserConfig
  display: DisplayConfig
  /** Avvio automatico con Windows (vale solo per l'app installata) */
  openAtLogin: boolean
  tabs: Record<OptionalTab, boolean>
  /** Ordine delle schede in basso */
  tabOrder: TabId[]
  /** Tema dell'interfaccia: auto = come Windows */
  theme: ThemeSetting
  /** Minuti senza tocchi prima della schermata di riposo con l'orologio (0 = mai) */
  idleMinutes: number
  home: Record<HomeCard, boolean>
  projectActions: Record<ProjectAction, boolean>
  snippets: Snippet[]
  /** Il personaggio: cammina nella barra in alto e fa da salvaschermo */
  buddy: {
    enabled: boolean
    /** Ore in cui dorme (dalle sleepFrom alle sleepTo); uguali = non dorme mai */
    sleepFrom: number
    sleepTo: number
  }
  twitch: TwitchConfig
  /** Cartella di Steam; vuota = trovata da sola */
  steamPath: string
  postazione: {
    /** App da non mostrare nel mixer (nome del processo, es. "steamwebhelper") */
    hiddenApps: string[]
  }
}

/** Monitor collegato al PC, per scegliere quale fa da dock */
export interface DisplayOption {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
  /** Il monitor ha il touch (se Windows lo sa) */
  touch: boolean
  /** È il monitor su cui si trova adesso il dock */
  current: boolean
}

export interface BrowserProfile {
  dir: string
  name: string
}

export interface BrowserInfo {
  kind: Exclude<BrowserKind, 'default' | 'custom'>
  name: string
  path: string
  profiles: BrowserProfile[]
}

/** Repo trovato cercando in una cartella, con i valori dedotti dal progetto */
export interface ScannedRepo {
  path: string
  id: string
  name: string
  framework?: string
  devCommand?: string
  devPort?: number
  vercelProject?: string
}

export interface AudioDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface AudioApp {
  /** Nome del processo, usato come chiave (es. "spotify") */
  key: string
  name: string
  /** 0–100 */
  volume: number
  muted: boolean
}

export interface AudioState {
  ok: boolean
  error?: string
  master: { volume: number; muted: boolean }
  devices: AudioDevice[]
  apps: AudioApp[]
}

export interface MonitorBrightness {
  id: string
  name: string
  ok: boolean
  /** 0–100 */
  brightness: number
}

export type MediaCommand = 'playpause' | 'next' | 'prev'

/** vercel.<id account> oppure twitch.clientSecret */
export type SecretKey = string

/** Stato della sessione di Claude Code di un progetto, aggiornato dagli hook */
export type ClaudeState = 'working' | 'waiting' | 'done'

export interface ClaudeEvent {
  projectId: string
  state: ClaudeState
  at: string
}

export interface VercelDeploy {
  url: string
  state: string
  target: string
  createdAt: string
}

export interface VercelInfo {
  ok: boolean
  error?: string
  latest?: VercelDeploy
  latestPreview?: VercelDeploy
}

export interface SteamGame {
  appId: string
  name: string
}

export interface TwitchStream {
  login: string
  name: string
  game: string
  title: string
  viewers: number
  thumbnail: string
}

export interface TwitchInfo {
  ok: boolean
  error?: string
  live: TwitchStream[]
}

export interface StreakInfo {
  /** Giorni consecutivi con almeno un commit, fino a oggi (o ieri) */
  streak: number
  committedToday: boolean
  totalCommits: number
  level: number
  title: string
  /** Avanzamento verso il livello successivo, da 0 a 1 */
  progress: number
  nextAt: number
}

export interface GitFile {
  /** M modificato, A aggiunto, D eliminato, R rinominato, ? non tracciato */
  kind: string
  path: string
}

export interface GitCommit {
  msg: string
  /** Data ISO del commit */
  date: string
}

export interface GitInfo {
  ok: boolean
  error?: string
  branch: string
  files: GitFile[]
  commits: GitCommit[]
  remoteUrl?: string
}

export interface ProjectState {
  lastOpenedAt?: string
  note?: string
}

export interface DockState {
  mode: AccountMode
  lastProjectId?: string
  projects: Record<string, ProjectState>
}

export interface DevServerInfo {
  running: boolean
  port: number
  localUrl: string
  lanUrl?: string
  /** Ultime righe di output, utili se il server non parte */
  lastOutput?: string
  exitedWithError?: boolean
}

export interface SystemStats {
  cpu: number
  ram: number
  ramUsedGb: number
  ramTotalGb: number
}

export interface RecapProject {
  id: string
  name: string
  commits: GitCommit[]
  dirtyFiles: number
}

export interface DisplayInfo {
  /** true se il monitor del dock è stato trovato e la finestra è lì */
  onDock: boolean
  label: string
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

export interface DockApi {
  getConfig(): Promise<DockConfig>
  /** Salva tutta la configurazione (impostazioni e setup guidato) */
  saveConfig(cfg: DockConfig): Promise<DockConfig>
  listDisplays(): Promise<DisplayOption[]>
  detectBrowsers(): Promise<BrowserInfo[]>
  /** Cartelle comuni dove di solito stanno i repo (solo quelle che esistono) */
  suggestRoots(): Promise<string[]>
  scanFolder(root: string): Promise<ScannedRepo[]>
  /** Legge un singolo repo (anche se la cartella non è un repo git) */
  inspectFolder(path: string): Promise<ScannedRepo | null>
  pickFolder(): Promise<string | null>
  getAudio(): Promise<AudioState>
  setAppVolume(key: string, volume: number): Promise<ActionResult>
  setAppMute(key: string, muted: boolean): Promise<ActionResult>
  setMasterVolume(volume: number): Promise<ActionResult>
  setMasterMute(muted: boolean): Promise<ActionResult>
  setOutputDevice(id: string): Promise<ActionResult>
  getMonitors(): Promise<{ ok: boolean; error?: string; monitors: MonitorBrightness[] }>
  setBrightness(id: string, value: number): Promise<ActionResult>
  media(cmd: MediaCommand): Promise<ActionResult>
  openConfig(): Promise<ActionResult>
  getConfigPath(): Promise<string>
  getState(): Promise<DockState>
  setMode(mode: AccountMode): Promise<DockState>
  setNote(projectId: string, note: string): Promise<DockState>
  getGit(projectId: string): Promise<GitInfo>
  getRecap(): Promise<RecapProject[]>
  openVsCode(projectId: string): Promise<ActionResult>
  openTerminal(projectId: string): Promise<ActionResult>
  openClaude(projectId: string): Promise<ActionResult>
  openFolder(projectId: string): Promise<ActionResult>
  openLink(projectId: string, kind: 'github' | 'vercel' | 'supabase' | 'localhost'): Promise<ActionResult>
  devStatus(projectId: string): Promise<DevServerInfo>
  devStart(projectId: string): Promise<DevServerInfo>
  devStop(projectId: string): Promise<DevServerInfo>
  getSystem(): Promise<SystemStats>
  copyText(text: string): Promise<ActionResult>
  lockPc(): Promise<ActionResult>
  screenshot(): Promise<ActionResult>
  openClaudeDesktop(): Promise<ActionResult>
  getDisplay(): Promise<DisplayInfo>
  /** Il dock di norma non prende il focus; lo prende solo mentre scrivi */
  setTyping(on: boolean): Promise<void>
  secretsStatus(): Promise<Record<SecretKey, boolean>>
  setSecret(key: SecretKey, value: string): Promise<Record<SecretKey, boolean>>
  claudeStatus(): Promise<Record<string, ClaudeEvent>>
  claudeHookSnippet(): Promise<string>
  getVercel(projectId: string): Promise<VercelInfo>
  getSteamGames(): Promise<{ ok: boolean; error?: string; games: SteamGame[] }>
  launchGame(appId: string): Promise<ActionResult>
  getTwitch(): Promise<TwitchInfo>
  openTwitch(login: string): Promise<ActionResult>
  openUrl(url: string, mode: AccountMode): Promise<ActionResult>
  getStreak(): Promise<StreakInfo>
  /** state "end": la sessione è stata chiusa */
  onClaude(cb: (e: ClaudeEvent | { projectId: string; state: 'end' }) => void): () => void
  onDevChanged(cb: (projectId: string) => void): () => void
  /** saved = true quando la modifica arriva dalle Impostazioni del dock */
  onConfigChanged(cb: (saved: boolean) => void): () => void
}
