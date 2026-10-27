import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { clipboard, shell } from 'electron'
import type { ActionResult, AccountMode, DockConfig, ProjectConfig } from '@shared/types'
import { tr } from './i18n'

const isWin = process.platform === 'win32'

function launch(command: string, args: string[], cwd?: string, useShell = false): Promise<ActionResult> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: useShell,
        windowsHide: false
      })
      child.once('error', (e) => resolve({ ok: false, error: e.message }))
      child.once('spawn', () => {
        child.unref()
        resolve({ ok: true })
      })
    } catch (e) {
      resolve({ ok: false, error: (e as Error).message })
    }
  })
}

const quote = (s: string): string => `"${s.replace(/"/g, '\\"')}"`

const commandCache = new Map<string, boolean>()
function hasCommand(name: string): boolean {
  if (!commandCache.has(name)) {
    const r = spawnSync(isWin ? 'where' : 'which', [name], { windowsHide: true })
    commandCache.set(name, r.status === 0)
  }
  return commandCache.get(name) ?? false
}

function checkFolder(p: ProjectConfig): ActionResult | undefined {
  if (!existsSync(p.path)) return { ok: false, error: tr('Cartella non trovata: {path}', { path: p.path }) }
  return undefined
}

export async function openVsCode(p: ProjectConfig): Promise<ActionResult> {
  const bad = checkFolder(p)
  if (bad) return bad
  // "code" su Windows è code.cmd: serve la shell; il percorso va tra virgolette
  return launch('code', [quote(p.path)], p.path, true)
}

/** Apre Windows Terminal nella cartella; con `command` esegue anche un programma (es. claude). */
export async function openTerminal(p: ProjectConfig, command?: string): Promise<ActionResult> {
  const bad = checkFolder(p)
  if (bad) return bad
  if (isWin) {
    if (hasCommand('wt')) {
      const args = ['-d', quote(p.path)]
      if (command) args.push('cmd', '/k', command)
      return launch('wt', args, p.path, true)
    }
    // Windows Terminal assente: ripiega sul prompt dei comandi
    return launch('cmd', ['/c', 'start', '""', 'cmd', '/k', command ?? 'echo.'], p.path, false)
  }
  return launch(
    process.platform === 'darwin' ? 'open' : 'x-terminal-emulator',
    process.platform === 'darwin' ? ['-a', 'Terminal', p.path] : [],
    p.path
  )
}

export async function openFolder(p: ProjectConfig): Promise<ActionResult> {
  const bad = checkFolder(p)
  if (bad) return bad
  const err = await shell.openPath(p.path)
  return err ? { ok: false, error: err } : { ok: true }
}

const BROWSER_NAME: Record<string, string> = {
  brave: 'Brave',
  chrome: 'Chrome',
  edge: 'Edge',
  custom: 'browser'
}

/** Apre un link nel browser scelto, con il profilo dell'account; se non lo trova usa quello predefinito. */
export async function openInBrowser(
  cfg: DockConfig,
  accountId: AccountMode,
  url: string
): Promise<ActionResult> {
  const { kind, path } = cfg.browser
  if (kind !== 'default' && path && existsSync(path)) {
    const profile = cfg.accounts.find((a) => a.id === accountId)?.browserProfile
    const args = profile ? [`--profile-directory=${profile}`, url] : [url]
    return launch(path, args)
  }
  await shell.openExternal(url)
  if (kind === 'default') return { ok: true }
  return {
    ok: true,
    message: tr('{p0} non trovato: aperto nel browser predefinito', {
      p0: BROWSER_NAME[kind] ?? tr('Browser')
    })
  }
}

export function copyText(text: string): ActionResult {
  clipboard.writeText(text)
  return { ok: true }
}

export function lockPc(): Promise<ActionResult> {
  if (!isWin) return Promise.resolve({ ok: false, error: tr('Disponibile solo su Windows') })
  return launch('rundll32.exe', ['user32.dll,LockWorkStation'])
}

/** Apre Claude Desktop: prima l'eseguibile installato, altrimenti il link claude:// registrato dall'app. */
export async function openClaudeDesktop(): Promise<ActionResult> {
  if (isWin && process.env.LOCALAPPDATA) {
    const exe = `${process.env.LOCALAPPDATA}\\AnthropicClaude\\claude.exe`
    if (existsSync(exe)) return launch(exe, [])
  }
  try {
    await shell.openExternal('claude://')
    return { ok: true }
  } catch {
    return { ok: false, error: tr('Claude Desktop non trovato') }
  }
}

/** Strumento di cattura di Windows (lo stesso di Win+Maiusc+S). */
export function screenshot(): Promise<ActionResult> {
  if (!isWin) return Promise.resolve({ ok: false, error: tr('Disponibile solo su Windows') })
  return launch('explorer.exe', ['ms-screenclip:'])
}
