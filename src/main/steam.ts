import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SteamGame } from '@shared/types'
import { tr } from './i18n'

/** Programmi di supporto di Steam che non sono giochi. */
const NOT_GAMES = /redistributable|steamworks|proton|steam linux runtime|steamvr|soundtrack/i
const SKIP_IDS = new Set(['228980', '1070560', '1391110', '1628350'])

/** Cartelle delle librerie dichiarate in libraryfolders.vdf. */
export function parseLibraryFolders(vdf: string): string[] {
  return [...vdf.matchAll(/"path"\s+"([^"]+)"/g)].map((m) => m[1].replace(/\\\\/g, '\\'))
}

/** appid e nome da un appmanifest_*.acf. */
export function parseAppManifest(acf: string): SteamGame | undefined {
  const id = acf.match(/"appid"\s+"(\d+)"/)?.[1]
  const name = acf.match(/"name"\s+"([^"]+)"/)?.[1]
  if (!id || !name) return undefined
  return { appId: id, name }
}

function registrySteamPath(): Promise<string | undefined> {
  if (process.platform !== 'win32') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { windowsHide: true },
      (err, out) => {
        if (err) return resolve(undefined)
        resolve(
          out
            .match(/SteamPath\s+REG_SZ\s+(.+)/)?.[1]
            ?.trim()
            .replace(/\//g, '\\')
        )
      }
    )
  })
}

export async function findSteamGames(
  configured: string
): Promise<{ ok: boolean; error?: string; games: SteamGame[] }> {
  const candidates = [configured, await registrySteamPath(), 'C:\\Program Files (x86)\\Steam'].filter(
    (p): p is string => !!p
  )
  const root = candidates.find((p) => existsSync(join(p, 'steamapps')))
  if (!root)
    return {
      ok: false,
      error: tr('Steam non trovato: indica la cartella in Impostazioni → Collegamenti'),
      games: []
    }

  let libraries = [root]
  const vdfPath = join(root, 'steamapps', 'libraryfolders.vdf')
  if (existsSync(vdfPath))
    libraries = [...new Set([root, ...parseLibraryFolders(readFileSync(vdfPath, 'utf8'))])]

  const games = new Map<string, SteamGame>()
  for (const lib of libraries) {
    const dir = join(lib, 'steamapps')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!/^appmanifest_\d+\.acf$/.test(f)) continue
      try {
        const g = parseAppManifest(readFileSync(join(dir, f), 'utf8'))
        if (g && !SKIP_IDS.has(g.appId) && !NOT_GAMES.test(g.name)) games.set(g.appId, g)
      } catch {
        // file illeggibile: saltato
      }
    }
  }
  return { ok: true, games: [...games.values()].sort((a, b) => a.name.localeCompare(b.name, 'it')) }
}
