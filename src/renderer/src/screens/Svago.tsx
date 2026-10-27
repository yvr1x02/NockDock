import { useEffect, useState } from 'react'
import type { SteamGame } from '@shared/types'
import { api, useDock } from '../lib/dock'
import { Card } from '../components/ui'
import { t } from '../lib/i18n'

/** Scheda Giochi: i giochi Steam installati. */
export function Svago() {
  return (
    <div className="flex h-full flex-col">
      <Games />
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
      <div className="grid min-h-0 flex-1 auto-rows-[172px] grid-cols-7 gap-2.5 overflow-y-auto pr-1">
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
