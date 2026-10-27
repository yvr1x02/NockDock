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

/** Il progetto si trova dal nome o ID scritto nelle impostazioni, altrimenti dal repo GitHub collegato */
async function findIn(
  token: string,
  teamId: string | undefined,
  ref: string | undefined,
  repoUrl: string | undefined
): Promise<{ id: string; name: string } | 'denied' | undefined> {
  try {
    if (ref)
      return await get<{ id: string; name: string }>(token, `/v9/projects/${encodeURIComponent(ref)}`, {
        teamId
      })
    if (repoUrl) {
      const j = await get<{ projects?: { id: string; name: string }[] }>(token, '/v10/projects', {
        teamId,
        repoUrl
      })
      return j.projects?.[0]
    }
  } catch (e) {
    // 404: non è in questo team. 401/403: il token non vale qui, si prova il prossimo
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
      dashboardUrl: owner ? `https://vercel.com/${owner}/${p.name}` : 'https://vercel.com/dashboard'
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
    return {
      ok: true,
      dashboardUrl: project.dashboardUrl,
      latest: list[0],
      production: list.find((d) => d.target === 'production' && d.state === 'READY'),
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
