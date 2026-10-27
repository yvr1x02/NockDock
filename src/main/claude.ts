import { createServer, type Server } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
const HOOK_SCRIPT = `// Generato dal Dock: inoltra gli eventi di Claude Code all'app.
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

export function hookSnippet(scriptPath: string): string {
  const command = `node "${scriptPath.replace(/\\/g, '/')}"`
  const hooks = Object.fromEntries(HOOK_EVENTS.map((e) => [e, [{ hooks: [{ type: 'command', command }] }]]))
  return JSON.stringify({ hooks }, null, 2)
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
