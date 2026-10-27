import { execFile } from 'node:child_process'
import type { StreakInfo } from '@shared/types'

export const TITLES = [
  'Novizio',
  'Apprendista',
  'Scudiero del codice',
  'Artigiano',
  'Cacciatore di bug',
  'Mago del refactor',
  'Cavaliere del deploy',
  'Architetto',
  'Maestro di gilda',
  'Leggenda'
]

/** Livello dai commit totali: 1 + radice di (commit / 5). 5 commit → 2, 20 → 3, 45 → 4, 80 → 5… */
export function levelFor(total: number): { level: number; title: string; progress: number; nextAt: number } {
  const level = 1 + Math.floor(Math.sqrt(total / 5))
  const at = (l: number): number => 5 * (l - 1) ** 2
  const curr = at(level)
  const next = at(level + 1)
  return {
    level,
    title: TITLES[Math.min(level, TITLES.length) - 1],
    progress: (total - curr) / (next - curr),
    nextAt: next
  }
}

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Giorni consecutivi con commit che arrivano fino a oggi; se oggi non c'è ancora un commit, vale fino a ieri. */
export function streakFrom(dates: Date[], today = new Date()): { streak: number; committedToday: boolean } {
  const days = new Set(dates.map(dayKey))
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const committedToday = days.has(dayKey(d))
  if (!committedToday) d.setDate(d.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return { streak, committedToday }
}

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile('git', ['-C', cwd, ...args], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) =>
      resolve(err ? '' : out)
    )
  })
}

/** Conta solo i tuoi commit: l'autore è l'email git configurata in ogni repo. */
export async function readStreak(paths: string[]): Promise<StreakInfo> {
  const results = await Promise.all(
    paths.map(async (p) => {
      const email = (await git(p, ['config', 'user.email'])).trim()
      if (!email) return { dates: [] as Date[], total: 0 }
      const [log, count] = await Promise.all([
        git(p, ['log', '--all', '--since=400.days', `--author=${email}`, '--format=%cI']),
        git(p, ['rev-list', '--all', '--count', `--author=${email}`])
      ])
      return {
        dates: log
          .split(/\r?\n/)
          .filter(Boolean)
          .map((s) => new Date(s)),
        total: parseInt(count.trim(), 10) || 0
      }
    })
  )
  const dates = results.flatMap((r) => r.dates)
  const totalCommits = results.reduce((n, r) => n + r.total, 0)
  return { ...streakFrom(dates), totalCommits, ...levelFor(totalCommits) }
}
