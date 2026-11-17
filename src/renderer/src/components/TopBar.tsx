import { useEffect, useState } from 'react'
import { useDock } from '../lib/dock'
import { accountOf } from '../lib/accounts'
import { Icon } from './Icon'
import { Buddy, type BuddyClaude } from './Buddy'
import { t, locale } from '../lib/i18n'

export function TopBar({ showBuddy, buddyClaude }: { showBuddy: boolean; buddyClaude: BuddyClaude }) {
  const { config, state, problems, openPanel, openSettings, dev } = useDock()
  const working = Object.values(dev).some((d) => d.running)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const account = accountOf(config, state.mode)
  const first = problems[0]
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-divider px-4">
      {/* Il personaggio cammina nello spazio libero tra l'orologio e i pulsanti */}
      {showBuddy && (
        <div className="pointer-events-none absolute inset-0">
          <Buddy
            scale={1}
            minX={200}
            maxX={first ? 230 : 620}
            speed={32}
            working={working}
            claude={buddyClaude}
            bubble="side"
          />
        </div>
      )}
      <div className="relative flex flex-1 items-baseline gap-2.5">
        <span className="font-mono text-[26px] font-medium tracking-tight">
          {now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-sm text-muted">
          {now.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>
      <div className="relative flex items-center gap-2">
        {/* Quanti avvisi ci sono: il dettaglio lo dice Yuyu, o si apre con un tocco */}
        {first && (
          <button
            type="button"
            onClick={() => openPanel('avvisi')}
            className="flex h-10 items-center gap-2 rounded-full border border-warn-line bg-warn-bg px-3.5 text-[15px] font-semibold text-warn-soft"
          >
            <span
              className={`size-2 shrink-0 rounded-full ${first.level === 'err' ? 'bg-err' : 'bg-warn'}`}
            />
            {problems.length === 1 ? t('1 avviso') : t('{n} avvisi', { n: problems.length })}
          </button>
        )}
        <button
          type="button"
          onClick={() => openPanel('account')}
          className="flex h-10 items-center gap-2 rounded-full border border-line-strong bg-card px-3.5 text-[15px] font-semibold"
        >
          <span className="size-2.5 rounded-full" style={{ background: account.color }} />
          {account.name}
        </button>
        <button
          type="button"
          aria-label={t('Impostazioni')}
          onClick={() => openSettings()}
          className="flex size-10 items-center justify-center rounded-xl border border-line-strong bg-card text-soft"
        >
          <Icon name="gear" size={20} />
        </button>
      </div>
    </header>
  )
}
