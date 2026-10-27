import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserInfo, BrowserProfile } from '@shared/types'

interface Candidate {
  kind: BrowserInfo['kind']
  name: string
  /** Percorsi relativi a Program Files, Program Files (x86) o AppData\Local */
  exe: string
  /** Cartella dei dati utente, relativa ad AppData\Local */
  userData: string
}

const CANDIDATES: Candidate[] = [
  {
    kind: 'brave',
    name: 'Brave',
    exe: 'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    userData: 'BraveSoftware\\Brave-Browser\\User Data'
  },
  {
    kind: 'chrome',
    name: 'Google Chrome',
    exe: 'Google\\Chrome\\Application\\chrome.exe',
    userData: 'Google\\Chrome\\User Data'
  },
  {
    kind: 'edge',
    name: 'Microsoft Edge',
    exe: 'Microsoft\\Edge\\Application\\msedge.exe',
    userData: 'Microsoft\\Edge\\User Data'
  }
]

/** Profili del browser letti dal file "Local State" (nome mostrato e cartella). */
export function readProfiles(localStateJson: string): BrowserProfile[] {
  try {
    const cache = JSON.parse(localStateJson)?.profile?.info_cache ?? {}
    return Object.entries(cache as Record<string, { name?: string }>)
      .map(([dir, v]) => ({ dir, name: v?.name || dir }))
      .sort((a, b) => (a.dir === 'Default' ? -1 : b.dir === 'Default' ? 1 : a.dir.localeCompare(b.dir)))
  } catch {
    return []
  }
}

/** Browser basati su Chromium installati, con i loro profili. Fuori da Windows: lista vuota. */
export function detectBrowsers(env: NodeJS.ProcessEnv = process.env): BrowserInfo[] {
  if (process.platform !== 'win32') return []
  const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean) as string[]
  const found: BrowserInfo[] = []
  for (const c of CANDIDATES) {
    const path = roots.map((r) => join(r, c.exe)).find((p) => existsSync(p))
    if (!path) continue
    let profiles: BrowserProfile[] = []
    if (env.LOCALAPPDATA) {
      const ls = join(env.LOCALAPPDATA, c.userData, 'Local State')
      if (existsSync(ls)) profiles = readProfiles(readFileSync(ls, 'utf8'))
    }
    found.push({ kind: c.kind, name: c.name, path, profiles })
  }
  return found
}
