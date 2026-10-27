import type { TwitchInfo, TwitchStream } from '@shared/types'
import { tr } from './i18n'

let token: { value: string; expires: number; clientId: string } | undefined

async function appToken(clientId: string, secret: string): Promise<string> {
  if (token && token.clientId === clientId && Date.now() < token.expires) return token.value
  const q = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: 'client_credentials'
  })
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${q}`, {
    method: 'POST',
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok)
    throw new Error(
      res.status === 400 || res.status === 403
        ? tr('Client ID o Secret non validi')
        : tr('errore {status}', { status: res.status })
    )
  const j = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000, clientId }
  return j.access_token
}

/** Quali dei canali indicati sono in diretta adesso. */
export async function readTwitch(
  clientId: string,
  secret: string | undefined,
  channels: string[]
): Promise<TwitchInfo> {
  if (!channels.length) return { ok: true, live: [] }
  if (!clientId || !secret)
    return {
      ok: false,
      error: tr('Collega Twitch in Impostazioni → Collegamenti'),
      live: []
    }
  try {
    const bearer = await appToken(clientId, secret)
    const q = new URLSearchParams()
    channels.slice(0, 100).forEach((c) => q.append('user_login', c.trim().toLowerCase()))
    const res = await fetch(`https://api.twitch.tv/helix/streams?${q}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(8000)
    })
    if (res.status === 401) token = undefined
    if (!res.ok) return { ok: false, error: tr('Twitch: errore {status}', { status: res.status }), live: [] }
    const j = (await res.json()) as {
      data: {
        user_login: string
        user_name: string
        game_name: string
        title: string
        viewer_count: number
        thumbnail_url: string
      }[]
    }
    const live: TwitchStream[] = j.data.map((s) => ({
      login: s.user_login,
      name: s.user_name,
      game: s.game_name,
      title: s.title,
      viewers: s.viewer_count,
      thumbnail: s.thumbnail_url.replace('{width}', '320').replace('{height}', '180')
    }))
    return { ok: true, live: live.sort((a, b) => b.viewers - a.viewers) }
  } catch (e) {
    return { ok: false, error: `Twitch: ${(e as Error).message}`, live: [] }
  }
}
