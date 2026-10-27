import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig, slug } from './store'
import { pickDockDisplay } from './display'
import { guessDev, inspectRepo, prettyName, scanRepos } from './scan'
import { readProfiles } from './browsers'
import { helperScript } from './winhelper'
import { migrateUserData } from './migrate'

describe('configurazione', () => {
  it('un utente nuovo parte vuoto e deve fare il setup', () => {
    const c = normalizeConfig(undefined)
    expect(c.setupDone).toBe(false)
    expect(c.projects).toEqual([])
    expect(c.accounts.map((a) => a.id)).toEqual(['personale'])
  })

  it('migra il formato delle versioni 0.1–0.4 senza perdere niente', () => {
    const old = {
      projects: [{ id: 'work', name: 'Work App', path: 'C:\\dev\\work-app', account: 'lavoro' }],
      accounts: {
        personale: { braveProfile: 'Default' },
        lavoro: { braveProfile: 'Profile 1', vercelTeamId: 'team_x' }
      },
      bravePath: 'C:\\brave.exe',
      dockDisplay: { width: 1024, height: 600 },
      buddy: { enabled: true, idleMinutes: 5 }
    }
    const c = normalizeConfig(old)
    expect(c.setupDone).toBe(true)
    expect(c.browser).toEqual({ kind: 'brave', path: 'C:\\brave.exe' })
    expect(c.accounts).toEqual([
      { id: 'personale', name: 'Personale', color: '#b3202f', browserProfile: 'Default' },
      { id: 'lavoro', name: 'Lavoro', color: '#a98bff', browserProfile: 'Profile 1', vercelTeamId: 'team_x' }
    ])
    expect(c.projects[0].account).toBe('lavoro')
    expect(c.display).toEqual({ mode: 'auto', width: 1024, height: 600 })
    expect(c.buddy).toEqual({ enabled: true, sleepFrom: 23, sleepTo: 7 })
    // i minuti della schermata di riposo escono da "buddy" e restano gli stessi
    expect(c.idleMinutes).toBe(5)
    expect(c.tabOrder).toEqual(['home', 'progetti', 'scene', 'postazione', 'sistema'])
    expect(c.theme).toBe('dark')
    expect(Object.values(c.home).every(Boolean)).toBe(true)
  })

  it('ripara i valori sbagliati invece di rompersi', () => {
    const c = normalizeConfig({
      version: 2,
      setupDone: true,
      accounts: [{ name: 'Clienti', color: 'rosso' }, { name: 'Clienti' }],
      projects: [{ name: 'X', path: 'C:\\x', account: 'non-esiste' }],
      buddy: { idleMinutes: -3, sleepFrom: 30 },
      display: { mode: 'boh' }
    })
    expect(c.accounts).toHaveLength(1)
    expect(c.accounts[0].id).toBe('clienti')
    expect(c.accounts[0].color).toMatch(/^#[0-9a-f]{6}$/)
    expect(c.projects[0]).toMatchObject({ id: 'x', account: 'clienti' })
    expect(c.idleMinutes).toBe(0)
    expect(c.buddy.sleepFrom).toBe(23)
    expect(c.display.mode).toBe('auto')
  })

  it('tiene ordine delle schede, riquadri spenti e link validi', () => {
    const c = normalizeConfig({
      version: 2,
      tabOrder: ['sistema', 'home', 'sistema', 'boh'],
      home: { streak: false },
      projectActions: { supabase: false },
      theme: 'light',
      projects: [
        {
          id: 'a',
          name: 'A',
          path: 'C:\\a',
          account: 'personale',
          links: [
            { label: 'Figma', url: 'https://figma.com/x' },
            { label: 'Rotto', url: 'javascript:alert(1)' }
          ]
        }
      ]
    })
    expect(c.tabOrder).toEqual(['sistema', 'home', 'progetti', 'scene', 'postazione'])
    expect(c.home.streak).toBe(false)
    expect(c.home.recap).toBe(true)
    expect(c.projectActions.supabase).toBe(false)
    expect(c.theme).toBe('light')
    expect(c.projects[0].links).toEqual([{ label: 'Figma', url: 'https://figma.com/x' }])
  })

  it('crea id leggibili', () => {
    expect(slug('Città di Prova')).toBe('citta-di-prova')
    expect(slug('Perché è così')).toBe('perche-e-cosi')
    expect(DEFAULT_CONFIG.version).toBe(2)
  })
})

describe('monitor del dock', () => {
  const d = (id: number, w: number, h: number, scale = 1) => ({
    id,
    bounds: { x: 0, y: 0, width: w / scale, height: h / scale },
    scaleFactor: scale
  })
  const displays = [d(1, 2560, 1440), d(2, 1024, 600, 1.25), d(3, 1920, 1080)]

  it('in automatico trova il 1024×600 anche con il ridimensionamento', () => {
    expect(pickDockDisplay(displays, { mode: 'auto', width: 1024, height: 600 }, 1)?.id).toBe(2)
  })
  it('usa il monitor scelto, e se non c’è più ripiega sulla risoluzione', () => {
    expect(
      pickDockDisplay(displays, { mode: 'display', displayId: 3, width: 1024, height: 600 }, 1)?.id
    ).toBe(3)
    expect(
      pickDockDisplay(displays, { mode: 'display', displayId: 9, width: 1024, height: 600 }, 1)?.id
    ).toBe(2)
  })
  it('in finestra non usa nessun monitor, e con un solo monitor nemmeno', () => {
    expect(pickDockDisplay(displays, { mode: 'window', width: 1024, height: 600 }, 1)).toBeUndefined()
    expect(pickDockDisplay([d(2, 1024, 600)], { mode: 'auto', width: 1024, height: 600 }, 2)).toBeUndefined()
  })
})

describe('ricerca dei progetti', () => {
  it('deduce comando e porta dal framework e dal gestore di pacchetti', () => {
    const next = { scripts: { dev: 'next dev' }, dependencies: { next: '15' } }
    expect(guessDev(next, ['pnpm-lock.yaml'])).toEqual({
      framework: 'Next.js',
      devCommand: 'pnpm dev -H 0.0.0.0',
      devPort: 3000
    })
    const vite = { scripts: { dev: 'vite' }, devDependencies: { vite: '7' } }
    expect(guessDev(vite, ['package-lock.json'])).toEqual({
      framework: 'Vite',
      devCommand: 'npm run dev -- --host',
      devPort: 5173
    })
    expect(guessDev({ scripts: {} }, [])).toEqual({})
    expect(prettyName('rpg-portfolio')).toBe('Rpg Portfolio')
  })

  it('trova i repo anche un livello sotto e legge il progetto Vercel', () => {
    const root = mkdtempSync(join(tmpdir(), 'dock-scan-'))
    const repo = (rel: string, pkg?: object): string => {
      const p = join(root, rel)
      mkdirSync(join(p, '.git'), { recursive: true })
      if (pkg) writeFileSync(join(p, 'package.json'), JSON.stringify(pkg))
      return p
    }
    repo('acme-shop', {
      name: 'acme-shop',
      scripts: { dev: 'next dev' },
      dependencies: { next: '15' }
    })
    const nested = repo(join('clienti', 'client-site'))
    mkdirSync(join(nested, '.vercel'))
    writeFileSync(join(nested, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_123' }))
    mkdirSync(join(root, 'node_modules', 'pkg', '.git'), { recursive: true })
    mkdirSync(join(root, 'appunti'))

    const found = scanRepos(root)
    expect(found.map((r) => r.id)).toEqual(['acme-shop', 'client-site'])
    expect(found[0]).toMatchObject({ name: 'Acme Shop', framework: 'Next.js', devPort: 3000 })
    expect(found[1]).toMatchObject({ name: 'Client Site', vercelProject: 'prj_123' })
    expect(inspectRepo(join(root, 'appunti'))).toBeNull()
    expect(inspectRepo(join(root, 'appunti'), false)?.name).toBe('Appunti')
  })
})

describe('browser e aiutante di Windows', () => {
  it('legge i nomi dei profili dal file Local State', () => {
    const ls = JSON.stringify({
      profile: { info_cache: { 'Profile 1': { name: 'Lavoro' }, Default: { name: 'Alex' } } }
    })
    expect(readProfiles(ls)).toEqual([
      { dir: 'Default', name: 'Alex' },
      { dir: 'Profile 1', name: 'Lavoro' }
    ])
    expect(readProfiles('rotto')).toEqual([])
  })

  it('lo script PowerShell compila una volta sola e protegge il percorso', () => {
    const s = helperScript("C:\\Users\\O'Neil\\Dock\\h.dll")
    expect(s).toContain("$dll = 'C:\\Users\\O''Neil\\Dock\\h.dll'")
    expect(s).toContain('if (-not (Test-Path -LiteralPath $dll))')
    expect(s).toContain('[DockWin.Helper]::Serve()')
  })
})

describe('cambio di nome', () => {
  it('porta config, stato e token dalla cartella vecchia, una volta sola', () => {
    const base = mkdtempSync(join(tmpdir(), 'dock-migrate-'))
    const legacy = join(base, 'Dock')
    const current = join(base, 'Nockdock')
    mkdirSync(legacy)
    writeFileSync(join(legacy, 'config.json'), '{"version":2}')
    writeFileSync(join(legacy, 'secrets.json'), '{}')
    expect(migrateUserData(current, legacy)).toBe(true)
    expect(readFileSync(join(current, 'config.json'), 'utf8')).toBe('{"version":2}')
    expect(existsSync(join(current, 'secrets.json'))).toBe(true)
    expect(migrateUserData(current, legacy)).toBe(false)
  })
})
