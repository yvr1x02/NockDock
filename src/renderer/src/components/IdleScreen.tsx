import { useEffect, useState } from 'react'
import { Buddy, type BuddyClaude } from './Buddy'
import { isNight } from '../lib/buddyBus'
import { t, locale } from '../lib/i18n'

/** Schermata di riposo: orologio grande e il personaggio che gira per lo schermo. Un tocco la chiude. */
export function IdleScreen({
  buddy,
  working,
  claude,
  onWake
}: {
  /** Con Yuyu spento resta solo l'orologio */
  buddy: boolean
  working: boolean
  claude: BuddyClaude
  onWake: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const night = isNight(now)

  return (
    <div
      role="button"
      tabIndex={0}
      data-theme="dark"
      aria-label={t('Riattiva il dock')}
      onPointerDown={onWake}
      className={`absolute inset-0 z-40 flex flex-col items-center bg-deep ${night ? 'opacity-70' : ''}`}
    >
      <span className="mt-16 font-mono text-[112px] leading-none font-medium tracking-tighter text-ink">
        {now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="mt-3 text-xl text-muted capitalize">
        {now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      {buddy && (
        <div className="pointer-events-none absolute right-0 bottom-10 left-0 h-[192px]">
          <div className="absolute right-10 bottom-0 left-10 h-px bg-divider" />
          <Buddy
            scale={3}
            minX={40}
            maxX={1024 - 40 - 144}
            speed={70}
            working={working}
            claude={claude}
            bubble="above"
          />
        </div>
      )}
      <span className="absolute bottom-3 text-xs text-dim">{t('Tocca per tornare al dock')}</span>
    </div>
  )
}
