import { spawn, type ChildProcess } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import type { DevServerInfo, ProjectConfig } from '@shared/types'

/** Primo indirizzo IPv4 della rete locale (quello che il telefono può raggiungere). */
export function lanAddress(): string | undefined {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
  const priv = all.find((a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a))
  return priv ?? all[0]
}

interface Running {
  child: ChildProcess
  output: string[]
  exitedWithError?: boolean
}

export class DevServers {
  private running = new Map<string, Running>()
  private lastExit = new Map<string, { output: string[]; error: boolean }>()

  constructor(private onChange: (projectId: string) => void) {}

  status(project: ProjectConfig): DevServerInfo {
    const port = project.devPort ?? 3000
    const lan = lanAddress()
    const r = this.running.get(project.id)
    const last = this.lastExit.get(project.id)
    return {
      running: !!r,
      port,
      localUrl: `http://localhost:${port}`,
      lanUrl: lan ? `http://${lan}:${port}` : undefined,
      lastOutput: (r?.output ?? last?.output ?? []).slice(-8).join('\n') || undefined,
      exitedWithError: !r && !!last?.error
    }
  }

  start(project: ProjectConfig): DevServerInfo {
    if (this.running.has(project.id)) return this.status(project)
    const port = project.devPort ?? 3000
    const command = project.devCommand ?? 'pnpm dev'
    const child = spawn(command, {
      cwd: project.path,
      shell: true,
      windowsHide: true,
      env: { ...process.env, PORT: String(port), BROWSER: 'none', FORCE_COLOR: '0' }
    })
    const entry: Running = { child, output: [] }
    const collect = (buf: Buffer): void => {
      entry.output.push(...buf.toString().split(/\r?\n/).filter(Boolean))
      if (entry.output.length > 200) entry.output.splice(0, entry.output.length - 200)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('error', (e) => entry.output.push(e.message))
    child.on('exit', (code) => {
      this.running.delete(project.id)
      this.lastExit.set(project.id, { output: entry.output, error: code !== 0 && code !== null })
      this.onChange(project.id)
    })
    this.running.set(project.id, entry)
    this.lastExit.delete(project.id)
    this.onChange(project.id)
    return this.status(project)
  }

  stop(project: ProjectConfig): DevServerInfo {
    const r = this.running.get(project.id)
    if (r?.child.pid) killTree(r.child.pid)
    this.running.delete(project.id)
    this.lastExit.set(project.id, { output: r?.output ?? [], error: false })
    this.onChange(project.id)
    return this.status(project)
  }

  stopAll(): void {
    for (const r of this.running.values()) if (r.child.pid) killTree(r.child.pid)
    this.running.clear()
  }
}

/** Con shell: true il server è un figlio della shell: va chiuso tutto l'albero dei processi. */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // già chiuso
      }
    }
  }
}
