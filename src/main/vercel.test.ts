import { afterEach, describe, expect, it, vi } from 'vitest'
import { readVercel } from './vercel'

type Route = (url: URL) => { status: number; body?: unknown } | undefined

function mockFetch(route: Route): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const r = route(new URL(input)) ?? { status: 404 }
      return { ok: r.status < 400, status: r.status, json: async () => r.body }
    })
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('readVercel', () => {
  it('trova il progetto dal repo in un team, anche senza Team ID nelle impostazioni', async () => {
    mockFetch((u) => {
      const team = u.searchParams.get('teamId')
      if (u.pathname === '/v2/teams' && !u.pathname.includes('team_1'))
        return { status: 200, body: { teams: [{ id: 'team_1', slug: 'acme' }] } }
      if (u.pathname === '/v10/projects' && !team) return { status: 403 }
      if (u.pathname === '/v10/projects' && team === 'team_1')
        return { status: 200, body: { projects: [{ id: 'prj_1', name: 'shop' }] } }
      if (u.pathname === '/v6/deployments' && team === 'team_1')
        return {
          status: 200,
          body: {
            deployments: [
              { url: 'shop-b.vercel.app', readyState: 'READY', target: null, createdAt: 2 },
              { url: 'shop-a.vercel.app', readyState: 'READY', target: 'production', createdAt: 1 }
            ]
          }
        }
      return undefined
    })
    const r = await readVercel('tok-a', undefined, 'https://github.com/acme/shop')
    expect(r.ok).toBe(true)
    expect(r.dashboardUrl).toBe('https://vercel.com/acme/shop')
    expect(r.production?.url).toBe('https://shop-a.vercel.app')
    expect(r.latestPreview?.url).toBe('https://shop-b.vercel.app')
  })

  it('dice che il token non vale se nessuno lo accetta', async () => {
    mockFetch(() => ({ status: 403 }))
    const r = await readVercel('tok-b', 'shop', undefined, 'team_x')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/token/)
  })
})
