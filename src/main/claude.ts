import { createServer, type Server } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ClaudeEvent, ClaudeState, ProjectConfig } from '@shared/types'

export const CLAUDE_PORT = 47321

const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** Il progetto è quello la cui cartella contiene la cartella di lavoro di Claude (vince la più specifica). */
export function projectForCwd(projects: ProjectConfig[], cwd: string): ProjectConfig | undefined {
  const c = norm(cwd)
  return projects
    .filter((p) => {
      const root = norm(p.path)
      return c === root || c.startsWith(root + '/')
    })
    .sort((a, b) => b.path.length - a.path.length)[0]
}

/** Traduce l'evento dell'hook nello stato mostrato sul dock. */
export function stateForEvent(event: string): ClaudeState | 'end' | undefined {
  switch (event) {
    case 'UserPromptSubmit':
    case 'PostToolUse':
      return 'working'
    case 'Notification':
    case 'PermissionRequest':
      return 'waiting'
    case 'Stop':
      return 'done'
    case 'SessionEnd':
      return 'end'
    default:
      return undefined
  }
}

/** Script che gli hook di Claude Code eseguono: inoltra al dock il JSON ricevuto su stdin. */
const HOOK_SCRIPT = `// Generato da Nockdock: inoltra gli eventi di Claude Code all'app.
const http = require('node:http')
let data = ''
process.stdin.on('data', (c) => (data += c))
process.stdin.on('end', () => {
  const req = http.request(
    { host: '127.0.0.1', port: ${CLAUDE_PORT}, path: '/claude', method: 'POST', headers: { 'content-type': 'application/json' }, timeout: 1500 },
    (res) => { res.resume(); res.on('end', () => process.exit(0)) }
  )
  req.on('error', () => process.exit(0))
  req.on('timeout', () => { req.destroy(); process.exit(0) })
  req.end(data)
})
`

export const HOOK_EVENTS = ['UserPromptSubmit', 'Notification', 'Stop', 'SessionEnd'] as const

const HOOK_FILE = 'dock-hook.cjs'

type HookGroup = { matcher?: string; hooks?: { type?: string; command?: string }[] }
type ClaudeSettings = { hooks?: Record<string, HookGroup[]>; [k: string]: unknown }

const isOurs = (g: HookGroup): boolean => !!g.hooks?.some((h) => h.command?.includes(HOOK_FILE))

/**
 * Aggiunge (on) o toglie (off) gli hook di Nockdock dalle impostazioni di Claude Code,
 * lasciando com'è tutto il resto del file.
 */
export function withDockHooks(settings: ClaudeSettings, scriptPath: string, on: boolean): ClaudeSettings {
  const command = `node "${scriptPath.replace(/\\/g, '/')}"`
  const hooks: Record<string, HookGroup[]> = { ...(settings.hooks ?? {}) }
  for (const event of HOOK_EVENTS) {
    const others = (hooks[event] ?? []).filter((g) => !isOurs(g))
    const next = on ? [...others, { hooks: [{ type: 'command', command }] }] : others
    if (next.length) hooks[event] = next
    else delete hooks[event]
  }
  const out: ClaudeSettings = { ...settings, hooks }
  if (!Object.keys(hooks).length) delete out.hooks
  return out
}

export const hasDockHooks = (settings: ClaudeSettings): boolean =>
  HOOK_EVENTS.every((e) => (settings.hooks?.[e] ?? []).some(isOurs))

/** ~/.claude/settings.json */
export const claudeSettingsPath = (): string => join(homedir(), '.claude', 'settings.json')

function readSettings(file: string): ClaudeSettings {
  if (!existsSync(file)) return {}
  const raw = readFileSync(file, 'utf8').trim()
  if (!raw) return {}
  const j = JSON.parse(raw)
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('settings.json')
  return j as ClaudeSettings
}

export function claudeHooksStatus(): boolean {
  try {
    return hasDockHooks(readSettings(claudeSettingsPath()))
  } catch {
    return false
  }
}

/** Scrive gli hook nel file di Claude Code; la prima volta ne tiene una copia accanto. */
export function setClaudeHooks(scriptPath: string, on: boolean): { ok: boolean; error?: string } {
  const file = claudeSettingsPath()
  let current: ClaudeSettings
  try {
    current = readSettings(file)
  } catch {
    return {
      ok: false,
      error: 'Le impostazioni di Claude Code non sono un JSON valido: correggile e riprova'
    }
  }
  try {
    mkdirSync(dirname(file), { recursive: true })
    const backup = file + '.nockdock-backup'
    if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup)
    writeFileSync(file, JSON.stringify(withDockHooks(current, scriptPath, on), null, 2) + '\n', 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export class ClaudeBridge {
  readonly scriptPath: string
  private server?: Server
  private states = new Map<string, ClaudeEvent>()

  constructor(
    dir: string,
    private projects: () => ProjectConfig[],
    private onEvent: (e: ClaudeEvent | { projectId: string; state: 'end' }) => void
  ) {
    this.scriptPath = join(dir, 'dock-hook.cjs')
    writeFileSync(this.scriptPath, HOOK_SCRIPT, 'utf8')
  }

  status(): Record<string, ClaudeEvent> {
    return Object.fromEntries(this.states)
  }

  start(): void {
    this.server = createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/claude') {
        res.writeHead(404).end()
        return
      }
      let body = ''
      req.on('data', (c) => {
        body += c
        if (body.length > 200_000) req.destroy()
      })
      req.on('end', () => {
        res.writeHead(204).end()
        try {
          const j = JSON.parse(body) as { cwd?: string; hook_event_name?: string }
          if (!j.cwd || !j.hook_event_name) return
          const p = projectForCwd(this.projects(), j.cwd)
          const state = stateForEvent(j.hook_event_name)
          if (!p || !state) return
          if (state === 'end') {
            this.states.delete(p.id)
            this.onEvent({ projectId: p.id, state: 'end' })
            return
          }
          const e: ClaudeEvent = { projectId: p.id, state, at: new Date().toISOString() }
          this.states.set(p.id, e)
          this.onEvent(e)
        } catch {
          // JSON non valido: ignorato
        }
      })
    })
    // Solo in locale: nessuno dalla rete può mandare eventi
    this.server.on('error', () => undefined)
    this.server.listen(CLAUDE_PORT, '127.0.0.1')
  }

  stop(): void {
    this.server?.close()
  }
}
