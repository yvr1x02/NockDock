import { execFile } from 'node:child_process'
import type { GitCommit, GitFile, GitInfo } from '@shared/types'

const SEP = '\x1f'

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr.trim() || err.message))
        else resolve(stdout)
      }
    )
  })
}

/** Legge l'output di `git status --porcelain=v1 -b`. */
export function parseStatus(out: string): { branch: string; files: GitFile[] } {
  let branch = ''
  const files: GitFile[] = []
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('## ')) {
      const head = line.slice(3)
      if (head.startsWith('No commits yet on ')) branch = head.slice('No commits yet on '.length)
      else branch = head.split('...')[0].split(' ')[0]
      continue
    }
    const code = line.slice(0, 2)
    let path = line.slice(3)
    if (path.includes(' -> ')) path = path.split(' -> ')[1]
    path = path.replace(/^"|"$/g, '')
    const kind = code === '??' ? '?' : (code.trim()[0] ?? 'M')
    files.push({ kind, path })
  }
  return { branch, files }
}

/** Legge l'output di `git log --pretty=format:%s<SEP>%cI`. */
export function parseLog(out: string): GitCommit[] {
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [msg, date] = line.split(SEP)
      return { msg, date }
    })
}

/** Converte il remote origin in un link al repo su GitHub. */
export function remoteToWebUrl(remote: string): string | undefined {
  const r = remote.trim()
  const ssh = r.match(/^git@([^:]+):(.+?)(\.git)?$/)
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`
  const http = r.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(\.git)?$/)
  if (http) return `https://${http[1]}/${http[2]}`
  return undefined
}

export async function readGitInfo(cwd: string, commitCount = 5): Promise<GitInfo> {
  try {
    const status = parseStatus(await git(cwd, ['status', '--porcelain=v1', '-b']))
    let commits: GitCommit[] = []
    try {
      commits = parseLog(await git(cwd, ['log', `-n${commitCount}`, `--pretty=format:%s${SEP}%cI`]))
    } catch {
      // repo senza commit
    }
    let remoteUrl: string | undefined
    try {
      remoteUrl = remoteToWebUrl(await git(cwd, ['remote', 'get-url', 'origin']))
    } catch {
      // nessun remote
    }
    return { ok: true, branch: status.branch, files: status.files, commits, remoteUrl }
  } catch (e) {
    return { ok: false, error: (e as Error).message, branch: '', files: [], commits: [] }
  }
}

/** Commit fatti da oggi a mezzanotte, per il recap di fine giornata. */
export async function commitsSinceMidnight(cwd: string): Promise<GitCommit[]> {
  try {
    return parseLog(await git(cwd, ['log', '--since=midnight', `--pretty=format:%s${SEP}%cI`]))
  } catch {
    return []
  }
}
