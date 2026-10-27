import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClaudeEvent, DevServerInfo, DockConfig, DockState, GitInfo, VercelInfo } from '@shared/types'
import { VercelPanel } from './panels/VercelPanel'
import { Settings } from './settings/Settings'
import { Setup } from './settings/Setup'
import { accentVars, accountOf, setAccentTheme } from './lib/accounts'
import { Svago } from './screens/Svago'
import {
  Ctx,
  api,
  lastProjectId,
  type DockCtx,
  type PanelKind,
  type Problem,
  type SettingsSection,
  type Tab
} from './lib/dock'
import { TopBar } from './components/TopBar'
import { TabBar } from './components/TabBar'
import { Toast } from './components/ui'
import { Home } from './screens/Home'
import { Projects } from './screens/Projects'
import { Postazione } from './screens/Postazione'
import { Sistema } from './screens/Sistema'
import { AccountPanel } from './panels/AccountPanel'
import { AlertsPanel } from './panels/AlertsPanel'
import { PhonePanel } from './panels/PhonePanel'
import { RecapPanel } from './panels/RecapPanel'
import { NotePanel } from './panels/NotePanel'
import { IdleScreen } from './components/IdleScreen'
import { buddyBus, setSleepHours } from './lib/buddyBus'
import { setLang } from './lib/i18n'
import { resolveLang } from '@shared/i18n'
import { t } from './lib/i18n'

const GIT_REFRESH_MS = 30_000
const VERCEL_REFRESH_MS = 120_000
let toastTimer: ReturnType<typeof setTimeout> | undefined
let lastTouch = Date.now()
/** Problemi già annunciati dal personaggio: ognuno lo dice una volta sola */
let announced = new Set<string>()

export function App() {
  const [config, setConfig] = useState<DockConfig | null>(null)
  const [state, setState] = useState<DockState | null>(null)
  const [git, setGit] = useState<Record<string, GitInfo>>({})
  const [dev, setDev] = useState<Record<string, DevServerInfo>>({})
  const [claude, setClaude] = useState<Record<string, ClaudeEvent>>({})
  const [vercel, setVercel] = useState<Record<string, VercelInfo>>({})
  const [claudeDone, setClaudeDone] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [panel, openPanel] = useState<PanelKind | null>(null)
  const [selId, setSelId] = useState('')
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [idle, setIdle] = useState(false)
  const [settings, setSettings] = useState<SettingsSection | null>(null)
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia('(prefers-color-scheme: light)').matches
  )
  const say = useCallback((text: string, error?: boolean) => {
    clearTimeout(toastTimer)
    setToast({ text, error })
    buddyBus.emit(error ? 'surprise' : 'jump')
    toastTimer = setTimeout(() => setToast(null), error ? 4500 : 2400)
  }, [])

  const loadAll = useCallback(async () => {
    const [cfg, st] = await Promise.all([api.getConfig(), api.getState()])
    setLang(resolveLang(cfg.language, navigator.language))
    setConfig(cfg)
    setState(st)
    setSelId((cur) => (cur && cfg.projects.some((p) => p.id === cur) ? cur : (lastProjectId(cfg, st) ?? '')))
    return cfg
  }, [])

  const refreshGit = useCallback(
    async (id?: string) => {
      const cfg = config ?? (await api.getConfig())
      const ids = id ? [id] : cfg.projects.map((p) => p.id)
      const results = await Promise.all(ids.map(async (pid) => [pid, await api.getGit(pid)] as const))
      setGit((g) => ({ ...g, ...Object.fromEntries(results) }))
    },
    [config]
  )

  const refreshDev = useCallback(async (id: string) => {
    const info = await api.devStatus(id)
    setDev((d) => ({ ...d, [id]: info }))
  }, [])

  // Alla fine di ogni tocco il puntatore torna sul monitor dove stavi lavorando
  useEffect(() => {
    const end = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') api.touchEnd()
    }
    window.addEventListener('pointerup', end, true)
    window.addEventListener('pointercancel', end, true)
    return () => {
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', end, true)
    }
  }, [])

  // Primo caricamento e ricarica quando cambia config.json
  useEffect(() => {
    let alive = true
    const boot = async (): Promise<void> => {
      const cfg = await loadAll()
      if (!alive) return
      const results = await Promise.all(
        cfg.projects.map(async (p) => [p.id, await api.getGit(p.id)] as const)
      )
      const devs = await Promise.all(
        cfg.projects.map(async (p) => [p.id, await api.devStatus(p.id)] as const)
      )
      if (!alive) return
      setGit(Object.fromEntries(results))
      setDev(Object.fromEntries(devs))
    }
    boot()
    const offCfg = api.onConfigChanged((saved) => {
      boot()
      if (!saved) say(t('Configurazione ricaricata'))
    })
    const offDev = api.onDevChanged((id) => refreshDev(id))
    return () => {
      alive = false
      offCfg()
      offDev()
    }
  }, [loadAll, refreshDev, say])

  useEffect(() => {
    const timer = setInterval(() => refreshGit(), GIT_REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshGit])

  // Vercel: solo i progetti con vercelProject, ogni due minuti
  const refreshVercel = useCallback(
    async (id?: string) => {
      if (!config) return
      const list = config.projects.filter((p) => p.vercelProject && (!id || p.id === id))
      const results = await Promise.all(list.map(async (p) => [p.id, await api.getVercel(p.id)] as const))
      setVercel((v) => ({ ...v, ...Object.fromEntries(results) }))
    },
    [config]
  )
  useEffect(() => {
    const first = setTimeout(() => refreshVercel(), 0)
    const timer = setInterval(() => refreshVercel(), VERCEL_REFRESH_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refreshVercel])

  // Claude Code: stato iniziale ed eventi dagli hook
  useEffect(() => {
    api.claudeStatus().then(setClaude)
    return api.onClaude((e) => {
      setClaude((c) => {
        const copy = { ...c }
        if (e.state === 'end') delete copy[e.projectId]
        else copy[e.projectId] = e
        return copy
      })
      if (e.state === 'done') {
        buddyBus.emit('jump')
        // Un oggetto nuovo ogni volta: così il fumetto riparte anche se finisce due volte lo stesso progetto
        setClaudeDone(e.projectId + '|' + e.at)
      }
    })
  }, [])
  useEffect(() => {
    if (!claudeDone || !config) return
    const id = claudeDone.split('|')[0]
    const name = config.projects.find((p) => p.id === id)?.name ?? id
    buddyBus.speak({
      text: t('Claude ha finito in {name}', { name }),
      tone: 'ok',
      onTap: () => {
        setSelId(id)
        setTab('progetti')
      }
    })
  }, [claudeDone, config])

  // Tema: scuro, chiaro o come Windows (segue i cambi mentre l'app è aperta)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const on = (e: MediaQueryListEvent): void => setSystemLight(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const theme = config?.theme === 'light' || (config?.theme === 'auto' && systemLight) ? 'light' : 'dark'
  setAccentTheme(theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Ore di sonno di Yuyu e schede nascoste dalle impostazioni
  useEffect(() => {
    if (!config) return
    setSleepHours(config.buddy.sleepFrom, config.buddy.sleepTo)
  }, [config])

  // Schermata di riposo dopo un po' di minuti senza tocchi
  const idleMinutes = config?.idleMinutes ?? 0
  useEffect(() => {
    const touch = (): void => {
      lastTouch = Date.now()
    }
    window.addEventListener('pointerdown', touch, true)
    const timer = setInterval(() => {
      if (idleMinutes > 0 && Date.now() - lastTouch > idleMinutes * 60_000) setIdle(true)
    }, 10_000)
    return () => {
      window.removeEventListener('pointerdown', touch, true)
      clearInterval(timer)
    }
  }, [idleMinutes])

  // Quando parte un dev server il personaggio si mette al portatile
  const working = Object.values(dev).some((d) => d.running)
  useEffect(() => {
    if (working) buddyBus.emit('work')
  }, [working])

  const problems = useMemo<Problem[]>(() => {
    if (!config) return []
    return config.projects.flatMap((p) => {
      const list: Problem[] = []
      const g = git[p.id]
      const d = dev[p.id]
      const v = vercel[p.id]
      if (claude[p.id]?.state === 'waiting')
        list.push({
          projectId: p.id,
          title: t('Claude aspetta il tuo ok · {name}', { name: p.name }),
          detail: t('Tocca Claude Code nel progetto per tornare al terminale'),
          level: 'warn'
        })
      if (g && !g.ok)
        list.push({
          projectId: p.id,
          title: t('{name}: repo non trovato', { name: p.name }),
          detail: t('Controlla il percorso {path}', { path: p.path }),
          level: 'err'
        })
      if (d?.exitedWithError)
        list.push({
          projectId: p.id,
          title: t('Dev server fermato con errore · {name}', { name: p.name }),
          detail: d.lastOutput?.split('\n').pop() ?? t('Controlla il comando in config.json'),
          level: 'err'
        })
      if (v?.ok && v.latest?.state === 'ERROR')
        list.push({
          projectId: p.id,
          title: t('Deploy in errore · {name}', { name: p.name }),
          detail: t('Ultimo deploy {p0} fallito', {
            p0: v.latest.target === 'production' ? t('di produzione') : t('di preview')
          }),
          level: 'err'
        })
      if (v && !v.ok)
        list.push({
          projectId: p.id,
          title: t('Vercel · {name}', { name: p.name }),
          detail: v.error ?? t('errore'),
          level: 'warn'
        })
      return list
    })
  }, [config, git, dev, vercel, claude])

  // Ogni problema nuovo lo annuncia il personaggio, con il fumetto
  useEffect(() => {
    const fresh = problems.filter((p) => !announced.has(p.title))
    announced = new Set(problems.map((p) => p.title))
    const first = fresh[0]
    if (!first) return
    buddyBus.emit(first.level === 'err' ? 'surprise' : 'look')
    buddyBus.speak({
      text: first.title,
      tone: 'warn',
      onTap: () => {
        setSelId(first.projectId)
        setTab('progetti')
        openPanel(null)
      }
    })
  }, [problems])

  const ctx = useMemo<DockCtx | null>(() => {
    if (!config || !state) return null
    return {
      config,
      state,
      git,
      dev,
      claude,
      vercel,
      refreshVercel: (id) => void refreshVercel(id),
      problems,
      selId,
      setTab,
      openPanel,
      openSettings: (section) => {
        openPanel(null)
        setSettings(section ?? 'generale')
      },
      setState,
      refreshGit: (id) => void refreshGit(id),
      say,
      selectProject: (id, goTo) => {
        setSelId(id)
        if (goTo) {
          setTab('progetti')
          openPanel(null)
        }
        // L'account si allinea al progetto scelto
        const p = config.projects.find((x) => x.id === id)
        if (p && p.account !== state.mode) {
          api.setMode(p.account).then(setState)
          say(
            t('Account {name} attivato per {name2}', {
              name: accountOf(config, p.account).name,
              name2: p.name
            })
          )
        }
      },
      run: async (promise, okMessage, after) => {
        const r = await promise
        if (r.ok) say(r.message ?? okMessage)
        else say(r.error, true)
        after?.()
        api.getState().then(setState)
      }
    }
  }, [config, state, git, dev, claude, vercel, refreshVercel, problems, selId, refreshGit, say])

  const claudeStates = Object.values(claude).map((c) => c.state)
  const buddyClaude = claudeStates.includes('waiting')
    ? 'waiting'
    : claudeStates.includes('working')
      ? 'working'
      : null

  if (!ctx) {
    return <div className="flex h-full items-center justify-center text-muted">{t('Avvio del dock…')}</div>
  }

  // Una scheda nascosta nelle impostazioni rimanda alla Home
  const shown: Tab = (tab === 'scene' || tab === 'postazione') && !ctx.config.tabs[tab] ? 'home' : tab

  // Primo avvio: setup guidato
  if (!ctx.config.setupDone) return <Setup initial={ctx.config} onDone={(cfg) => setConfig({ ...cfg })} />

  return (
    <Ctx.Provider value={ctx}>
      <div
        style={accentVars(accountOf(ctx.config, ctx.state.mode).color)}
        className="relative flex h-full w-full flex-col overflow-hidden bg-ground"
      >
        <TopBar showBuddy={ctx.config.buddy.enabled && !idle} buddyClaude={buddyClaude} />
        <main className="min-h-0 flex-1 px-5 py-4">
          {shown === 'home' && <Home />}
          {shown === 'progetti' && <Projects />}
          {shown === 'scene' && <Svago />}
          {shown === 'postazione' && <Postazione />}
          {shown === 'sistema' && <Sistema />}
        </main>
        <TabBar tab={shown} />
        {panel === 'account' && <AccountPanel />}
        {panel === 'avvisi' && <AlertsPanel />}
        {panel === 'telefono' && <PhonePanel />}
        {panel === 'recap' && <RecapPanel />}
        {panel === 'vercel' && <VercelPanel />}
        {panel && typeof panel === 'object' && <NotePanel projectId={panel.note} />}
        {settings && <Settings section={settings} onClose={() => setSettings(null)} />}
        {toast && <Toast text={toast.text} error={toast.error} />}
        {idle && (
          <IdleScreen
            buddy={ctx.config.buddy.enabled}
            working={working}
            claude={buddyClaude}
            onWake={() => {
              lastTouch = Date.now()
              setIdle(false)
            }}
          />
        )}
      </div>
    </Ctx.Provider>
  )
}
