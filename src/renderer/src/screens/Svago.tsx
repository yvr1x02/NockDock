import { useEffect, useState } from 'react'
import type { SteamGame, TwitchInfo } from '@shared/types'
import { api, useDock } from '../lib/dock'
import { Card } from '../components/ui'
import { t, locale } from '../lib/i18n'

const TWITCH_REFRESH_MS = 120_000

/** Scheda Scene: per ora giochi Steam e canali Twitch in diretta; le scene di finestre arrivano dopo. */
export function Svago() {
  return (
    <div className="grid h-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
      <Games />
      <TwitchLive />
    </div>
  )
}

function Games() {
  const { run } = useDock()
  const [data, setData] = useState<{ ok: boolean; error?: string; games: SteamGame[] } | null>(null)

  useEffect(() => {
    api.getSteamGames().then(setData)
  }, [])

  return (
    <Card
      title={data?.ok ? t('Giochi installati · {length}', { length: data.games.length }) : t('Giochi')}
      className="gap-3"
    >
      {!data && <span className="text-sm text-muted">{t('Cerco le librerie di Steam…')}</span>}
      {data && !data.ok && <span className="text-sm text-err">{data.error}</span>}
      {data?.ok && data.games.length === 0 && (
        <span className="text-sm text-muted">{t('Nessun gioco installato trovato.')}</span>
      )}
      <div className="grid min-h-0 flex-1 auto-rows-[172px] grid-cols-5 gap-2.5 overflow-y-auto pr-1">
        {data?.games.map((g) => (
          <GameTile
            key={g.appId}
            game={g}
            onPlay={() => run(api.launchGame(g.appId), t('Avvio {name}', { name: g.name }))}
          />
        ))}
      </div>
      <span className="text-[11px] text-dim">
        {t(
          'Prossima versione: ogni gioco potrà avviare anche la sua scena (finestre, volumi, Non disturbare).'
        )}
      </span>
    </Card>
  )
}

function GameTile({ game, onPlay }: { game: SteamGame; onPlay: () => void }) {
  const [broken, setBroken] = useState(false)
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={t('Avvia {name}', { name: game.name })}
      className="relative overflow-hidden rounded-xl border border-line-strong bg-raised text-left"
    >
      {!broken && (
        <img
          src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {broken && (
        <span className="absolute inset-0 flex items-end p-2.5 text-[13px] leading-tight font-semibold">
          {game.name}
        </span>
      )}
    </button>
  )
}

function TwitchLive() {
  const { run } = useDock()
  const [info, setInfo] = useState<TwitchInfo | null>(null)

  useEffect(() => {
    const load = (): void => void api.getTwitch().then(setInfo)
    load()
    const timer = setInterval(load, TWITCH_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <Card title={t('In diretta su Twitch')} className="gap-2">
      {!info && <span className="text-sm text-muted">{t('Controllo i canali…')}</span>}
      {info && !info.ok && <span className="text-sm leading-snug text-err">{info.error}</span>}
      {info?.ok && info.live.length === 0 && (
        <span className="text-sm leading-snug text-muted">
          {t('Nessuno dei tuoi canali è in diretta. I canali si scelgono in Impostazioni → Collegamenti.')}
        </span>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {info?.live.map((s) => (
          <button
            key={s.login}
            type="button"
            onClick={() => run(api.openTwitch(s.login), t('Apro {name} nel browser', { name: s.name }))}
            className="flex shrink-0 flex-col gap-1.5 rounded-xl bg-raised p-2 text-left"
          >
            <span className="relative block aspect-video w-full overflow-hidden rounded-lg bg-line">
              <img src={s.thumbnail} alt="" className="size-full object-cover" />
              <span className="absolute top-1.5 left-1.5 rounded bg-[#e91916] px-1.5 text-[11px] font-bold text-white">
                {t('LIVE ·')} {s.viewers.toLocaleString(locale())}
              </span>
            </span>
            <span className="flex min-w-0 flex-col px-1">
              <span className="truncate text-sm font-semibold">{s.name}</span>
              <span className="truncate text-xs text-muted">{s.game || s.title}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}
