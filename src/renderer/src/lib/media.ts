import { useCallback, useEffect, useState } from 'react'
import type { ActionResult, MediaCommand, MediaState } from '@shared/types'
import { api } from './dock'

const POLL_MS = 3000

/**
 * Cosa sta suonando e i tasti della musica. L'icona segue quello che dice Windows;
 * se Windows non lo sa dire, play e pausa si alternano a ogni tocco.
 */
export function useMedia(report?: (r: ActionResult) => void): {
  state: MediaState | null
  playing: boolean
  track: { title: string; artist: string } | null
  press: (cmd: MediaCommand) => void
} {
  const [state, setState] = useState<MediaState | null>(null)
  const [playing, setPlaying] = useState(false)

  const apply = useCallback((s: MediaState): void => {
    setState(s)
    if (s.ok) setPlaying(s.status === 'playing')
  }, [])
  const read = useCallback((): void => void api.mediaState().then(apply), [apply])

  useEffect(() => {
    const tick = (): void => void api.mediaState().then(apply)
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [apply])

  const press = (cmd: MediaCommand): void => {
    if (cmd === 'playpause') setPlaying((p) => !p)
    void api.media(cmd).then((r) => {
      report?.(r)
      // Il lettore ci mette un attimo a cambiare stato
      setTimeout(read, 600)
    })
  }

  const track = state?.ok && state.title ? { title: state.title, artist: state.artist ?? '' } : null
  return { state, playing, track, press }
}
