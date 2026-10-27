import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import source from './win/DockHelper.cs?raw'
import { tr } from './i18n'

const TIMEOUT_MS = 10_000

/** Script PowerShell: compila l'aiutante una volta sola in una DLL, poi la carica e resta in ascolto. */
export function helperScript(dll: string): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$dll = '${dll.replace(/'/g, "''")}'`,
    'if (-not (Test-Path -LiteralPath $dll)) {',
    "  $src = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'DockHelper.cs')",
    '  Add-Type -TypeDefinition $src -Language CSharp -OutputAssembly $dll -OutputType Library',
    '}',
    'Add-Type -LiteralPath $dll',
    '[DockWin.Helper]::Serve()'
  ].join('\r\n')
}

/** I campi viaggiano separati da tabulazioni, una richiesta per riga */
const clean = (s: string): string => s.replace(/[\t\r\n]/g, ' ')

/**
 * Processo PowerShell sempre acceso che parla con le API audio e dei monitor di Windows.
 * Parte alla prima richiesta e si riavvia da solo se si chiude.
 */
export class WinHelper {
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private seq = 0
  private pending = new Map<string, { resolve: (v: unknown) => void; timer: NodeJS.Timeout }>()
  private buffer = ''
  private lastError = ''

  constructor(private dir: string) {}

  private start(): Promise<void> {
    const hash = createHash('sha1').update(source).digest('hex').slice(0, 10)
    const folder = join(this.dir, 'win-helper')
    mkdirSync(folder, { recursive: true })
    const cs = join(folder, 'DockHelper.cs')
    const ps1 = join(folder, 'dock-helper.ps1')
    const dll = join(folder, `DockHelper-${hash}.dll`)
    writeFileSync(cs, source, 'utf8')
    writeFileSync(ps1, helperScript(dll), 'utf8')

    const proc = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
      { windowsHide: true }
    )
    this.proc = proc
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (d: string) => (this.lastError = (this.lastError + d).slice(-500)))

    this.ready = new Promise<void>((resolve, reject) => {
      const firstRun = existsSync(dll) ? 15_000 : 60_000 // la prima volta compila
      const t = setTimeout(() => reject(new Error(tr('L’aiutante di Windows non risponde'))), firstRun)
      proc.stdout.on('data', (chunk: string) => {
        this.buffer += chunk
        let i: number
        while ((i = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, i).replace(/\r$/, '')
          this.buffer = this.buffer.slice(i + 1)
          const tab = line.indexOf('\t')
          if (tab < 0) continue
          const id = line.slice(0, tab)
          if (id === 'ready') {
            clearTimeout(t)
            resolve()
            continue
          }
          const p = this.pending.get(id)
          if (!p) continue
          this.pending.delete(id)
          clearTimeout(p.timer)
          try {
            const r = JSON.parse(line.slice(tab + 1))
            // Gli errori dell'aiutante sono in italiano: qui passano dalla traduzione
            if (r && typeof r.error === 'string') r.error = tr(r.error)
            p.resolve(r)
          } catch {
            p.resolve({ ok: false, error: tr('Risposta non valida') })
          }
        }
      })
      proc.once('exit', () => {
        clearTimeout(t)
        reject(new Error(this.lastError.trim().split('\n').pop() || tr('L’aiutante di Windows si è chiuso')))
        this.proc = null
        this.ready = null
        for (const [, p] of this.pending) {
          clearTimeout(p.timer)
          p.resolve({ ok: false, error: tr('L’aiutante di Windows si è chiuso') })
        }
        this.pending.clear()
      })
      proc.once('error', (e) => reject(e))
    })
    return this.ready
  }

  async call<T>(cmd: string, ...args: (string | number | boolean)[]): Promise<T> {
    if (process.platform !== 'win32') return { ok: false, error: tr('Disponibile solo su Windows') } as T
    try {
      await (this.ready ?? this.start())
    } catch (e) {
      this.ready = null
      return { ok: false, error: (e as Error).message } as T
    }
    const id = String(++this.seq)
    const line = [
      id,
      cmd,
      ...args.map((a) => clean(typeof a === 'boolean' ? (a ? '1' : '0') : String(a)))
    ].join('\t')
    return new Promise<T>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, error: tr('Windows non ha risposto in tempo') } as T)
      }, TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, timer })
      this.proc?.stdin.write(line + '\n')
    })
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
    this.ready = null
  }
}
