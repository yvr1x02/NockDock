import { useEffect, useState } from 'react'
import { useDock } from '../lib/dock'
import { accountName } from '../lib/accounts'
import { Icon } from './Icon'
import { Buddy, type BuddyClaude } from './Buddy'
import { t, locale } from '../lib/i18n'

export function TopBar({ showBuddy, buddyClaude }: { showBuddy: boolean; buddyClaude: BuddyClaude }) {
  const { config, state, problems, openPanel, dev } = useDock()
  const working = Object.values(dev).some((d) => d.running)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const n = problems.length
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-divider px-5">
      {/* Il personaggio cammina nello spazio libero tra l'orologio e i pulsanti */}
      {showBuddy && (
        <div className="pointer-events-none absolute inset-0">
          <Buddy
            scale={1}
            minX={220}
            maxX={680}
            speed={32}
            working={working}
            claude={buddyClaude}
            bubble="side"
          />
        </div>
      )}
      <div className="relative flex items-baseline gap-3">
        <span className="font-mono text-2xl font-medium tracking-tight">
          {now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-sm text-muted">
          {now.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => openPanel('avvisi')}
          className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${
            n ? 'border-warn-line bg-warn-bg text-warn-soft' : 'border-ok-line bg-ok/10 text-ok'
          }`}
        >
          <span className={`size-2 rounded-full ${n ? 'bg-warn-soft' : 'bg-ok'}`} />
          {n ? (n === 1 ? t('1 avviso') : t('{n} avvisi', { n })) : t('Tutto ok')}
        </button>
        <button
          type="button"
          onClick={() => openPanel('account')}
          className="ml-1 flex h-10 items-center gap-2 rounded-full border border-accent bg-accent-tint pr-3.5 pl-2.5 text-[13px] font-semibold text-accent-text"
        >
          <Icon name="user" size={16} />
          {accountName(config, state.mode)}
        </button>
      </div>
    </header>
  )
}
