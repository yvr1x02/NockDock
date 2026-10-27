import type { VercelDeploy, VercelInfo } from '@shared/types'
import { tr } from './i18n'

const API = 'https://api.vercel.com'

interface RawDeploy {
  url?: string
  state?: string
  readyState?: string
  target?: string | null
  createdAt?: number
  created?: number
}

export function toDeploy(d: RawDeploy): VercelDeploy {
  return {
    url: d.url ? `https://${d.url}` : '',
    state: d.readyState ?? d.state ?? 'UNKNOWN',
    target: d.target ?? 'preview',
    createdAt: new Date(d.createdAt ?? d.created ?? 0).toISOString()
  }
}

/** Progetto Vercel trovato: id, team in cui sta e link alla dashboard */
interface Resolved {
  projectId: string
  teamId?: string
  dashboardUrl: string
  siteUrl?: string
}

class VercelError extends Error {
  constructor(public status: number) {
    super(String(status))
  }
}

async function get<T>(
  token: string,
  path: string,
  query: Record<string, string | undefined> = {}
): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v)
  const res = await fetch(`${API}${path}${q.size ? `?${q}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new VercelError(res.status)
  return (await res.json()) as T
}

/** I team a cui il token ha accesso; vuoto se il token vale solo per l'account personale */
async function teamsOf(token: string): Promise<{ id: string; slug: string }[]> {
  try {
    const j = await get<{ teams?: { id: string; slug: string }[] }>(token, '/v2/teams', { limit: '50' })
    return j.teams ?? []
  } catch {
    return []
  }
}

interface RawProject {
  id: string
  name: string
  link?: { type?: string; org?: string; repo?: string; projectNamespace?: string; projectName?: string }
  targets?: { production?: { alias?: string[] } }
  alias?: { domain?: string }[]
}

/** "owner/repo" in minuscolo dall'indirizzo del remote (https://github.com/owner/repo) */
export function repoSlug(url: string | undefined): string | undefined {
  const m = url?.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/)
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : undefined
}

const linkSlug = (p: RawProject): string | undefined => {
  const org = p.link?.org ?? p.link?.projectNamespace
  const repo = p.link?.repo ?? p.link?.projectName
  return org && repo ? `${org}/${repo}`.toLowerCase() : undefined
}

/** Indirizzo pubblico della produzione: il dominio più corto, senza quelli dei branch */
export function siteOf(p: RawProject): string | undefined {
  const names = [...(p.targets?.production?.alias ?? []), ...(p.alias ?? []).map((a) => a.domain ?? '')]
    .filter((d) => d && !d.includes('-git-'))
    .sort((a, b) => a.length - b.length)
  return names[0] ? `https://${names[0]}` : undefined
}

/**
 * Cerca il progetto in un account o team: dal nome o ID scritto nelle impostazioni,
 * altrimenti dal repo GitHub collegato a Vercel (confrontato senza badare alle maiuscole).
 */
async function findIn(
  token: string,
  teamId: string | undefined,
  ref: string | undefined,
  repoUrl: string | undefined
): Promise<RawProject | 'denied' | undefined> {
  const wanted = repoSlug(repoUrl)
  const repoName = wanted?.split('/')[1]
  try {
    let from: string | undefined
    for (let page = 0; page < 5; page++) {
      const j = await get<{ projects?: RawProject[]; pagination?: { next?: number | null } }>(
        token,
        '/v10/projects',
        { teamId, limit: '100', from }
      )
      const list = j.projects ?? []
      const hit = ref
        ? list.find((p) => p.id === ref || p.name.toLowerCase() === ref.toLowerCase())
        : (list.find((p) => wanted && linkSlug(p) === wanted) ??
          list.find((p) => repoName && p.name.toLowerCase() === repoName))
      if (hit) return hit
      if (!j.pagination?.next) break
      from = String(j.pagination.next)
    }
  } catch (e) {
    // 401/403: il token non vale per questo account o team, si prova il prossimo
    if (!(e instanceof VercelError)) throw e
    if (e.status === 401 || e.status === 403) return 'denied'
  }
  return undefined
}

const cache = new Map<string, Resolved>()

export async function resolveProject(
  token: string,
  ref: string | undefined,
  repoUrl: string | undefined,
  teamId?: string
): Promise<Resolved | undefined> {
  const key = `${token.slice(-6)}|${ref ?? ''}|${repoUrl ?? ''}|${teamId ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit

  // Il team indicato nelle impostazioni, oppure l'account personale e poi ogni team del token
  const teams = teamId ? [{ id: teamId, slug: '' }] : [{ id: '', slug: '' }, ...(await teamsOf(token))]
  let denied = 0
  for (const team of teams) {
    const p = await findIn(token, team.id || undefined, ref, repoUrl)
    if (p === 'denied') denied++
    if (!p || p === 'denied') continue
    let owner = team.slug
    try {
      if (team.id && !owner) owner = (await get<{ slug: string }>(token, `/v2/teams/${team.id}`)).slug
      if (!team.id) owner = (await get<{ user: { username: string } }>(token, '/v2/user')).user.username
    } catch {
      owner = ''
    }
    const r: Resolved = {
      projectId: p.id,
      teamId: team.id || undefined,
      dashboardUrl: owner ? `https://vercel.com/${owner}/${p.name}` : 'https://vercel.com/dashboard',
      siteUrl: siteOf(p)
    }
    if (!r.siteUrl) {
      try {
        r.siteUrl = siteOf(await get<RawProject>(token, `/v9/projects/${p.id}`, { teamId: r.teamId }))
      } catch {
        // resta l'indirizzo dell'ultimo deploy
      }
    }
    cache.set(key, r)
    return r
  }
  if (denied === teams.length) throw new VercelError(403)
  return undefined
}

/** Ultimo deploy, ultima produzione e ultima preview pronta di un progetto. */
export async function readVercel(
  token: string,
  ref: string | undefined,
  repoUrl: string | undefined,
  teamId?: string
): Promise<VercelInfo> {
  try {
    const project = await resolveProject(token, ref, repoUrl, teamId)
    if (!project)
      return {
        ok: false,
        error: ref
          ? tr('Vercel: progetto «{ref}» non trovato con questo token', { ref })
          : tr('Vercel: nessun progetto collegato a questo repo. Scrivi il nome in Impostazioni → Progetti')
      }
    const json = await get<{ deployments?: RawDeploy[] }>(token, '/v6/deployments', {
      projectId: project.projectId,
      teamId: project.teamId,
      limit: '20'
    })
    const list = (json.deployments ?? []).map(toDeploy)
    const prod = list.find((d) => d.target === 'production' && d.state === 'READY')
    return {
      ok: true,
      dashboardUrl: project.dashboardUrl,
      latest: list[0],
      // Il dominio pubblico (es. progetto.vercel.app) invece dell'indirizzo del singolo deploy, spesso protetto
      production: prod && { ...prod, url: project.siteUrl ?? prod.url },
      latestPreview: list.find((d) => d.target !== 'production' && d.state === 'READY')
    }
  } catch (e) {
    if (e instanceof VercelError) {
      const msg =
        e.status === 401 || e.status === 403
          ? tr('token non valido o senza accesso')
          : tr('errore {status}', { status: e.status })
      return { ok: false, error: `Vercel: ${msg}` }
    }
    return { ok: false, error: tr('Vercel non raggiungibile: {message}', { message: (e as Error).message }) }
  }
}

/** Link alla dashboard già trovato per un progetto, se c'è */
export function knownDashboard(ref: string | undefined, repoUrl: string | undefined): string | undefined {
  for (const [k, v] of cache) {
    const [, r, u] = k.split('|')
    if ((ref && r === ref) || (!ref && repoUrl && u === repoUrl)) return v.dashboardUrl
  }
  return undefined
}
