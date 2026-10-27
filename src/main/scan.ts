import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import type { ScannedRepo } from '@shared/types'
import { slug } from './store'

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'vendor', 'AppData'])

function readJsonSafe<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** "rpg-portfolio" → "Rpg Portfolio" */
export function prettyName(s: string): string {
  return s
    .replace(/^@[^/]+\//, '')
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

interface Pkg {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Deduce framework, comando del dev server (in ascolto in rete) e porta da package.json e lockfile. */
export function guessDev(
  pkg: Pkg | undefined,
  files: string[]
): Pick<ScannedRepo, 'framework' | 'devCommand' | 'devPort'> {
  if (!pkg?.scripts?.dev) return {}
  const pm = files.includes('pnpm-lock.yaml')
    ? 'pnpm'
    : files.includes('yarn.lock')
      ? 'yarn'
      : files.some((f) => f.startsWith('bun.lock'))
        ? 'bun'
        : 'npm'
  // con npm le opzioni passano dopo "--"
  const run = (extra: string): string => (pm === 'npm' ? `npm run dev -- ${extra}` : `${pm} dev ${extra}`)
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const dev = pkg.scripts.dev
  if (deps.next || /\bnext\b/.test(dev))
    return { framework: 'Next.js', devCommand: run('-H 0.0.0.0'), devPort: 3000 }
  if (deps.nuxt || /\bnuxt\b/.test(dev))
    return { framework: 'Nuxt', devCommand: run('--host'), devPort: 3000 }
  if (deps.astro || /\bastro\b/.test(dev))
    return { framework: 'Astro', devCommand: run('--host'), devPort: 4321 }
  if (deps['@sveltejs/kit']) return { framework: 'SvelteKit', devCommand: run('--host'), devPort: 5173 }
  if (deps.vite || /\bvite\b/.test(dev))
    return { framework: 'Vite', devCommand: run('--host'), devPort: 5173 }
  return { devCommand: pm === 'npm' ? 'npm run dev' : `${pm} dev` }
}

/** Legge una cartella di progetto. git = false: la accetta anche se non è un repo. */
export function inspectRepo(path: string, requireGit = true): ScannedRepo | null {
  if (!isDir(path)) return null
  if (requireGit && !existsSync(join(path, '.git'))) return null
  let files: string[]
  try {
    files = readdirSync(path)
  } catch {
    return null
  }
  const pkg = files.includes('package.json') ? readJsonSafe<Pkg>(join(path, 'package.json')) : undefined
  const folder = basename(path)
  const name = prettyName(pkg?.name && !pkg.name.startsWith('@') ? pkg.name : folder)
  const vercel = readJsonSafe<{ projectId?: string }>(join(path, '.vercel', 'project.json'))
  return {
    path,
    id: slug(folder),
    name,
    ...guessDev(pkg, files),
    ...(vercel?.projectId ? { vercelProject: vercel.projectId } : {})
  }
}

/** Cerca i repo git nella cartella e un livello sotto (es. C:\dev\cliente\sito). */
export function scanRepos(root: string, depth = 2): ScannedRepo[] {
  const out: ScannedRepo[] = []
  const walk = (dir: string, level: number): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entries) {
      if (SKIP.has(e) || e.startsWith('.')) continue
      const p = join(dir, e)
      if (!isDir(p)) continue
      const repo = inspectRepo(p)
      if (repo) out.push(repo)
      else if (level < depth) walk(p, level + 1)
    }
  }
  const self = inspectRepo(root)
  if (self) return [self]
  walk(root, 1)
  // id unici
  const seen = new Map<string, number>()
  for (const r of out) {
    const n = seen.get(r.id) ?? 0
    seen.set(r.id, n + 1)
    if (n) r.id = `${r.id}-${n + 1}`
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Cartelle dove di solito stanno i repo, solo quelle che esistono. */
export function suggestRoots(home = homedir()): string[] {
  const list = [
    'C:\\dev',
    'C:\\Projects',
    'C:\\repos',
    'D:\\dev',
    join(home, 'dev'),
    join(home, 'Projects'),
    join(home, 'repos'),
    join(home, 'source', 'repos'),
    join(home, 'Documents', 'GitHub'),
    join(home, 'code')
  ]
  return [...new Set(list)].filter((p) => process.platform === 'win32' || !/^[A-Z]:\\/.test(p)).filter(isDir)
}
