import { createContext, useContext } from 'react'
import type {
  ActionResult,
  ClaudeEvent,
  DevServerInfo,
  DockConfig,
  DockState,
  GitInfo,
  ProjectConfig,
  VercelInfo
} from '@shared/types'

export type Tab = 'home' | 'progetti' | 'scene' | 'postazione' | 'sistema'
export type PanelKind = 'account' | 'avvisi' | 'telefono' | 'recap' | 'vercel' | { note: string }

/** Sezioni della schermata Impostazioni */
export type SettingsSection =
  | 'generale'
  | 'aspetto'
  | 'schermo'
  | 'account'
  | 'progetti'
  | 'collegamenti'
  | 'yuyu'
  | 'postazione'
  | 'snippet'

export interface Problem {
  projectId: string
  title: string
  detail: string
  /** warn: da guardare (es. Claude aspetta); err: qualcosa è rotto */
  level: 'warn' | 'err'
}

export interface DockCtx {
  config: DockConfig
  state: DockState
  git: Record<string, GitInfo>
  dev: Record<string, DevServerInfo>
  claude: Record<string, ClaudeEvent>
  vercel: Record<string, VercelInfo>
  refreshVercel: (id?: string) => void
  problems: Problem[]
  selId: string
  selectProject: (id: string, goTo?: boolean) => void
  setTab: (t: Tab) => void
  openPanel: (p: PanelKind | null) => void
  openSettings: (section?: SettingsSection) => void
  setState: (s: DockState) => void
  refreshGit: (id?: string) => void
  say: (text: string, error?: boolean) => void
  run: (p: Promise<ActionResult>, okMessage: string, after?: () => void) => Promise<void>
}

export const Ctx = createContext<DockCtx | null>(null)

export function useDock(): DockCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDock fuori dal provider')
  return c
}

export const api = window.dock

export function projectById(cfg: DockConfig, id: string): ProjectConfig | undefined {
  return cfg.projects.find((p) => p.id === id)
}

export function lastProjectId(cfg: DockConfig, st: DockState): string | undefined {
  if (st.lastProjectId && projectById(cfg, st.lastProjectId)) return st.lastProjectId
  return cfg.projects[0]?.id
}

export const CLAUDE_LABEL: Record<string, string> = {
  working: 'al lavoro…',
  waiting: 'aspetta il tuo ok',
  done: 'ha finito'
}
