import { useEffect, useState } from 'react'
import { Buddy, type BuddyClaude } from './Buddy'
import { WeatherPanel, useWeather } from './Weather'
import { isNight } from '../lib/buddyBus'
import { t, locale } from '../lib/i18n'

/**
 * Schermata di riposo: orologio grande, meteo a destra se acceso, e il personaggio che gira
 * per lo schermo. Un tocco la chiude.
 */
export function IdleScreen({
  buddy,
  weather,
  working,
  claude,
  onWake
}: {
  /** Con Yuyu spento resta solo l'orologio */
  buddy: boolean
  /** Meteo acceso e con una città scelta */
  weather: boolean
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
  const w = useWeather(weather)
  const side = weather && w !== null

  const time = now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      role="button"
      tabIndex={0}
      data-theme="dark"
      aria-label={t('Riattiva il dock')}
      onPointerDown={onWake}
      className={`absolute inset-0 z-40 bg-deep ${night ? 'opacity-70' : ''}`}
    >
      {side ? (
        <>
          <div className="absolute top-[72px] left-16 flex flex-col gap-2">
            <span className="font-mono text-[132px] leading-none font-light tracking-tighter text-ink">
              {time}
            </span>
            <span className="text-[22px] text-muted capitalize">{date}</span>
          </div>
          <div className="absolute top-[84px] right-16">
            <WeatherPanel w={w} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center">
          <span className="mt-16 font-mono text-[112px] leading-none font-medium tracking-tighter text-ink">
            {time}
          </span>
          <span className="mt-3 text-xl text-muted capitalize">{date}</span>
        </div>
      )}
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
      <span className="absolute bottom-3 left-0 w-full text-center text-xs text-dim">
        {t('Tocca per tornare al dock')}
      </span>
    </div>
  )
}
