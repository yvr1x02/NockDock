import { join } from 'node:path'
import { migrateUserData } from './migrate'
import { watch } from 'node:fs'
import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import type {
  AccountMode,
  ActionResult,
  DisplayInfo,
  DisplayOption,
  DockConfig,
  MediaCommand,
  RecapProject,
  SecretKey
} from '@shared/types'
import { ClaudeBridge, hookSnippet } from './claude'
import { Secrets } from './secrets'
import { readVercel } from './vercel'
import { findSteamGames } from './steam'
import { readStreak } from './streak'
import { Store } from './store'
import { centeredBounds, fitZoom, pickDockDisplay } from './display'
import { detectBrowsers } from './browsers'
import { inspectRepo, scanRepos, suggestRoots } from './scan'
import { WinHelper } from './winhelper'
import { setMainLang } from './i18n'
import { resolveLang } from '@shared/i18n'
import { commitsSinceMidnight, readGitInfo } from './git'
import { DevServers } from './devservers'
import * as actions from './actions'
import { readSystem } from './system'
import { tr } from './i18n'

// Una sola istanza: se l'app è già aperta, la seconda si chiude subito
if (!app.requestSingleInstanceLock()) app.quit()

const WINDOWED = process.env.DOCK_WINDOWED === '1'
let win: BrowserWindow | null = null
let onDock = false
let store: Store
let devServers: DevServers
let secrets: Secrets
let claude: ClaudeBridge
let winHelper: WinHelper
let dockId: number | undefined

/** Lingua dei messaggi del processo principale, dalla configurazione o da Windows */
function applyLang(): void {
  setMainLang(resolveLang(store.config.language, app.getLocale()))
}

function dockDisplay() {
  if (WINDOWED) return undefined
  return pickDockDisplay(screen.getAllDisplays(), store.config.display, screen.getPrimaryDisplay().id)
}

/**
 * L'aiutante di Windows segue il puntatore fuori dal dock, così dopo un tocco
 * lo può rimettere dove era (Windows lo sposta sul punto toccato).
 */
function trackCursor(dock: Electron.Display | undefined): void {
  if (!dock || process.platform !== 'win32' || !winHelper) return
  const r = screen.dipToScreenRect(null, dock.bounds)
  void winHelper.call('cursortrack', r.x, r.y, r.x + r.width, r.y + r.height)
}

function createWindow(): void {
  const dock = dockDisplay()
  onDock = !!dock
  dockId = dock?.id
  trackCursor(dock)
  const size = { width: 1024, height: 600 }
  const bounds = dock ? dock.bounds : centeredBounds(screen.getPrimaryDisplay().workArea, size)

  win = new BrowserWindow({
    ...bounds,
    useContentSize: !dock,
    show: false,
    // Sul dock: senza bordi, sempre in primo piano, fuori dalla barra delle applicazioni
    // e senza rubare il focus alla finestra su cui stai lavorando.
    frame: !dock,
    resizable: !dock,
    alwaysOnTop: !!dock,
    skipTaskbar: !!dock,
    focusable: !dock,
    backgroundColor: '#0E1013',
    title: 'Nockdock',
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  if (dock) {
    win.setBounds(dock.bounds)
    // L'interfaccia è disegnata per 1024×600: su schermi diversi si ingrandisce o rimpicciolisce
    // per starci, e il ridimensionamento di Windows (es. 125%) non la deforma
    const zoom = fitZoom(dock.bounds, dock.scaleFactor)
    win.webContents.on('did-finish-load', () => win?.webContents.setZoomFactor(zoom))
  }
  win.once('ready-to-show', () => (dock ? win?.showInactive() : win?.show()))

  // Se il processo della pagina va in crash, la ricarica invece di lasciare il dock vuoto
  win.webContents.on('render-process-gone', () => win?.webContents.reload())
  // I link esterni non si aprono dentro il dock
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

/** Quando si collega o scollega il dock, ricrea la finestra nel posto giusto. */
function onDisplaysChanged(): void {
  const dock = dockDisplay()
  if (!win || win.isDestroyed()) return createWindow()
  if (!!dock !== onDock || dock?.id !== dockId) {
    win.destroy()
    win = null
    createWindow()
  } else if (dock) {
    win.setBounds(dock.bounds)
    trackCursor(dock)
  }
}

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

function projectOr(id: string) {
  const p = store.project(id)
  if (!p) throw new Error(tr('Progetto sconosciuto: {id}', { id }))
  return p
}

async function guard(fn: () => Promise<ActionResult> | ActionResult): Promise<ActionResult> {
  try {
    return await fn()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => store.config)
  ipcMain.handle('config:save', (_e, cfg: DockConfig) => {
    const saved = store.saveConfig(cfg)
    applyLang()
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: saved.openAtLogin })
    send('config:changed', true)
    // Se è cambiato il monitor del dock, la finestra si sposta (dopo aver risposto)
    setTimeout(onDisplaysChanged, 300)
    return saved
  })
  ipcMain.handle('sys:displays', (): DisplayOption[] => {
    const primary = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: d.label || `Monitor ${i + 1}`,
      width: Math.round(d.bounds.width * d.scaleFactor),
      height: Math.round(d.bounds.height * d.scaleFactor),
      primary: d.id === primary,
      touch: d.touchSupport === 'available',
      current: onDock && d.id === dockId
    }))
  })
  ipcMain.handle('setup:browsers', () => detectBrowsers())
  ipcMain.handle('setup:roots', () => suggestRoots())
  ipcMain.handle('setup:scan', (_e, root: string) => scanRepos(root))
  ipcMain.handle('setup:inspect', (_e, path: string) => inspectRepo(path, false))
  ipcMain.handle('setup:pick', async () => {
    const opts = { properties: ['openDirectory' as const], title: tr('Scegli la cartella') }
    const r =
      win && !win.isDestroyed() ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })

  ipcMain.on('touch:end', () => {
    if (!onDock || !store.config.restoreCursor) return
    // Un attimo di ritardo: il click del tocco deve arrivare prima che il puntatore se ne vada
    setTimeout(() => void winHelper.call('cursorrestore'), 30)
  })
  ipcMain.handle('audio:get', () => winHelper.call('audio'))
  ipcMain.handle('audio:app-volume', (_e, key: string, v: number) => winHelper.call('appvol', key, v))
  ipcMain.handle('audio:app-mute', (_e, key: string, m: boolean) => winHelper.call('appmute', key, m))
  ipcMain.handle('audio:master-volume', (_e, v: number) => winHelper.call('mastervol', v))
  ipcMain.handle('audio:master-mute', (_e, m: boolean) => winHelper.call('mastermute', m))
  ipcMain.handle('audio:output', (_e, id: string) => winHelper.call('output', id))
  ipcMain.handle('monitor:list', () => winHelper.call('monitors'))
  ipcMain.handle('monitor:brightness', (_e, id: string, v: number) => winHelper.call('bright', id, v))
  ipcMain.handle('media:cmd', (_e, cmd: MediaCommand) =>
    ['playpause', 'next', 'prev'].includes(cmd)
      ? winHelper.call('media', cmd)
      : { ok: false, error: tr('Comando non valido') }
  )
  ipcMain.handle('config:path', () => store.configPath)
  ipcMain.handle('config:open', () =>
    guard(async () => {
      const err = await shell.openPath(store.configPath)
      return err ? { ok: false, error: err } : { ok: true }
    })
  )
  ipcMain.handle('state:get', () => store.state)
  ipcMain.handle('state:mode', (_e, mode: AccountMode) => store.setMode(mode))
  ipcMain.handle('state:note', (_e, id: string, note: string) => store.setNote(id, note))

  ipcMain.handle('git:info', (_e, id: string) => readGitInfo(projectOr(id).path))
  ipcMain.handle('git:recap', async (): Promise<RecapProject[]> => {
    const list = await Promise.all(
      store.config.projects.map(async (p) => {
        const [commits, info] = await Promise.all([commitsSinceMidnight(p.path), readGitInfo(p.path, 1)])
        const openedToday =
          store.state.projects[p.id]?.lastOpenedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)
        const touched = commits.length > 0 || openedToday
        return touched ? { id: p.id, name: p.name, commits, dirtyFiles: info.files.length } : null
      })
    )
    return list.filter((p): p is RecapProject => p !== null)
  })

  ipcMain.handle('act:vscode', (_e, id: string) =>
    guard(async () => {
      const r = await actions.openVsCode(projectOr(id))
      if (r.ok) store.touchProject(id)
      return r
    })
  )
  ipcMain.handle('act:terminal', (_e, id: string) => guard(() => actions.openTerminal(projectOr(id))))
  ipcMain.handle('act:claude', (_e, id: string) =>
    guard(async () => {
      const r = await actions.openTerminal(projectOr(id), 'claude')
      if (r.ok) store.touchProject(id)
      return r
    })
  )
  ipcMain.handle('act:folder', (_e, id: string) => guard(() => actions.openFolder(projectOr(id))))
  ipcMain.handle('act:link', (_e, id: string, kind: 'github' | 'vercel' | 'supabase' | 'localhost') =>
    guard(async () => {
      const p = projectOr(id)
      let url: string | undefined
      if (kind === 'github') url = (await readGitInfo(p.path, 1)).remoteUrl
      if (kind === 'vercel') url = p.vercelUrl
      if (kind === 'supabase') url = p.supabaseUrl
      if (kind === 'localhost') url = devServers.status(p).localUrl
      if (!url)
        return {
          ok: false,
          error: tr('Nessun link {kind} per {name}: aggiungilo nelle Impostazioni', { kind, name: p.name })
        }
      return actions.openInBrowser(store.config, p.account, url)
    })
  )

  ipcMain.handle('dev:status', (_e, id: string) => devServers.status(projectOr(id)))
  ipcMain.handle('dev:start', (_e, id: string) => devServers.start(projectOr(id)))
  ipcMain.handle('dev:stop', (_e, id: string) => devServers.stop(projectOr(id)))

  ipcMain.handle('sys:stats', () => readSystem())
  ipcMain.handle('sys:copy', (_e, text: string) => actions.copyText(text))
  ipcMain.handle('sys:lock', () => guard(() => actions.lockPc()))
  ipcMain.handle('sys:screenshot', () => guard(() => actions.screenshot()))
  ipcMain.handle('sys:claude-desktop', () => guard(() => actions.openClaudeDesktop()))
  ipcMain.handle('sys:display', (): DisplayInfo => ({
    onDock,
    label: onDock ? tr('Sul monitor del dock') : tr('In finestra (dock non collegato)')
  }))
  ipcMain.handle('secrets:status', () => secrets.status())
  ipcMain.handle('secrets:set', (_e, key: SecretKey, value: string) => {
    secrets.set(key, value)
    return secrets.status()
  })

  ipcMain.handle('claude:status', () => claude.status())
  ipcMain.handle('claude:snippet', () => hookSnippet(claude.scriptPath))

  ipcMain.handle('vercel:info', async (_e, id: string) => {
    const p = projectOr(id)
    if (!p.vercelProject) return { ok: false, error: tr('Aggiungi il progetto Vercel nelle Impostazioni') }
    const account = store.config.accounts.find((a) => a.id === p.account)
    const token = secrets.get(`vercel.${p.account}`)
    if (!token)
      return {
        ok: false,
        error: tr('Manca il token Vercel {p0}: Impostazioni → Collegamenti', {
          p0: account?.name ?? p.account
        })
      }
    return readVercel(token, p.vercelProject, account?.vercelTeamId)
  })

  ipcMain.handle('steam:games', () => findSteamGames(store.config.steamPath))
  ipcMain.handle('steam:launch', (_e, appId: string) =>
    guard(async () => {
      if (!/^\d+$/.test(appId)) return { ok: false, error: tr('Gioco non valido') }
      await shell.openExternal(`steam://rungameid/${appId}`)
      return { ok: true }
    })
  )

  ipcMain.handle('url:open', (_e, url: string, mode: AccountMode) =>
    guard(() => {
      if (!/^https?:\/\//.test(url)) return { ok: false, error: tr('Link non valido') }
      return actions.openInBrowser(store.config, mode, url)
    })
  )

  ipcMain.handle('git:streak', () => readStreak(store.config.projects.map((p) => p.path)))

  ipcMain.handle('sys:typing', (_e, on: boolean) => {
    if (!win || !onDock) return
    win.setFocusable(on)
    if (on) win.focus()
    else win.blur()
  })
}

app.whenReady().then(() => {
  migrateUserData(app.getPath('userData'), join(app.getPath('appData'), 'Dock'))
  store = new Store(app.getPath('userData'))
  applyLang()
  devServers = new DevServers((id) => send('dev:changed', id))
  secrets = new Secrets(app.getPath('userData'))
  claude = new ClaudeBridge(
    app.getPath('userData'),
    () => store.config.projects,
    (e) => send('claude:event', e)
  )
  claude.start()
  winHelper = new WinHelper(app.getPath('userData'))
  registerIpc()

  // L'avvio automatico si registra solo per l'app installata, non in sviluppo
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: store.config.openAtLogin })

  // Se modifichi config.json mentre l'app è aperta, si ricarica da sola
  let t: NodeJS.Timeout | undefined
  watch(store.configPath, () => {
    clearTimeout(t)
    // Le scritture fatte dall'app stessa (Impostazioni) sono già state comunicate
    if (Date.now() - store.lastWrite < 1500) return
    t = setTimeout(() => {
      store.reloadConfig()
      applyLang()
      send('config:changed', false)
      onDisplaysChanged()
    }, 300)
  })

  createWindow()
  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)
})

app.on('second-instance', () => {
  if (win && !onDock) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('before-quit', () => {
  devServers?.stopAll()
  claude?.stop()
  winHelper?.stop()
})
app.on('window-all-closed', () => app.quit())
