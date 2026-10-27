import type { VercelDeploy, VercelInfo } from '@shared/types'
import { tr } from './i18n'

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

/** Ultimo deploy e ultima preview pronta di un progetto. */
export async function readVercel(token: string, project: string, teamId?: string): Promise<VercelInfo> {
  const q = new URLSearchParams({ projectId: project, limit: '10' })
  if (teamId) q.set('teamId', teamId)
  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) {
      const msg =
        res.status === 403 || res.status === 401
          ? tr('token non valido o senza accesso')
          : tr('errore {status}', { status: res.status })
      return { ok: false, error: `Vercel: ${msg}` }
    }
    const json = (await res.json()) as { deployments?: RawDeploy[] }
    const list = (json.deployments ?? []).map(toDeploy)
    return {
      ok: true,
      latest: list[0],
      latestPreview: list.find((d) => d.target !== 'production' && d.state === 'READY')
    }
  } catch (e) {
    return { ok: false, error: tr('Vercel non raggiungibile: {message}', { message: (e as Error).message }) }
  }
}
