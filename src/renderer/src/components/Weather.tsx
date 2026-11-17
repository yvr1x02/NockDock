import { useEffect, useState } from 'react'
import type { WeatherInfo } from '@shared/types'
import { api } from '../lib/dock'
import { t } from '../lib/i18n'

type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

/** Codici meteo WMO raggruppati in poche icone */
export function skyOf(code: number): Sky {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'rain'
}

const SKY_LABEL: Record<Sky, string> = {
  clear: 'Sereno',
  partly: 'Poco nuvoloso',
  cloudy: 'Nuvoloso',
  fog: 'Nebbia',
  rain: 'Pioggia',
  snow: 'Neve',
  storm: 'Temporale'
}

const SUN = '#f5c451'
const MOON = '#d0c8c8'
const CLOUD = '#625b5b'
const DROP = '#6ea8ff'

/** Icona del tempo disegnata a mano, leggibile anche piccola */
export function WeatherIcon({ code, day, size }: { code: number; day: boolean; size: number }) {
  const sky = skyOf(code)
  const body = day ? (
    <circle cx="9" cy="9" r="4.5" fill={SUN} />
  ) : (
    <path d="M11 3.5a5.5 5.5 0 1 0 4 9.5 6.5 6.5 0 0 1-4-9.5z" fill={MOON} />
  )
  const cloud = <path d="M7.5 20h10a4 4 0 0 0 0-8 5.2 5.2 0 0 0-10 1.6A3.2 3.2 0 0 0 7.5 20z" fill={CLOUD} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {sky === 'clear' &&
        (day ? (
          <>
            <circle cx="12" cy="12" r="5" fill={SUN} />
            <path
              d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
              stroke={SUN}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path d="M14 3a8 8 0 1 0 7 12 9 9 0 0 1-7-12z" fill={MOON} />
        ))}
      {sky === 'partly' && (
        <>
          {body}
          {cloud}
        </>
      )}
      {sky === 'cloudy' && (
        <>
          <path d="M6 15h8a3.4 3.4 0 0 0 0-6.8 4.4 4.4 0 0 0-8.4 1.4A2.7 2.7 0 0 0 6 15z" fill="#4f4949" />
          {cloud}
        </>
      )}
      {sky === 'fog' && (
        <path d="M4 9h16M3 13h18M5 17h14" stroke={CLOUD} strokeWidth="2" strokeLinecap="round" />
      )}
      {(sky === 'rain' || sky === 'snow' || sky === 'storm') && (
        <>
          <path d="M6.5 14h10a4 4 0 0 0 0-8 5.2 5.2 0 0 0-10 1.6A3.2 3.2 0 0 0 6.5 14z" fill={CLOUD} />
          {sky === 'rain' && (
            <path
              d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"
              stroke={DROP}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
          {sky === 'snow' && (
            <g fill="#f2eeee">
              <circle cx="8" cy="18" r="1.2" />
              <circle cx="12" cy="20" r="1.2" />
              <circle cx="16" cy="18" r="1.2" />
            </g>
          )}
          {sky === 'storm' && (
            <path
              d="M12.5 14l-2.5 4h3l-2 4"
              stroke={SUN}
              strokeWidth="1.8"
              fill="none"
              strokeLinejoin="round"
            />
          )}
        </>
      )}
    </svg>
  )
}

/** Meteo aggiornato ogni 15 minuti finché il componente è in vista */
export function useWeather(enabled: boolean): WeatherInfo | null {
  const [w, setW] = useState<WeatherInfo | null>(null)
  useEffect(() => {
    if (!enabled) return
    const tick = (): void => void api.getWeather().then(setW)
    tick()
    const timer = setInterval(tick, 15 * 60_000)
    return () => clearInterval(timer)
  }, [enabled])
  return enabled ? w : null
}

/** Il blocco del meteo nella schermata di riposo */
export function WeatherPanel({ w }: { w: WeatherInfo }) {
  if (!w.ok || w.temp === undefined || w.code === undefined)
    return <span className="text-sm text-dim">{w.error}</span>
  return (
    <div className="flex w-[340px] flex-col gap-[18px]">
      <div className="flex items-center gap-[18px]">
        <WeatherIcon code={w.code} day={w.day ?? true} size={76} />
        <div className="flex flex-col gap-0.5">
          <span className="text-[56px] leading-none font-semibold tracking-tight text-ink">{w.temp}°</span>
          <span className="text-base text-muted">
            {w.city} · {t(SKY_LABEL[skyOf(w.code)])}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-muted">
        <span>
          {t('Max')} <span className="text-ink">{w.max}°</span>
        </span>
        <span>
          {t('Min')} <span className="text-ink">{w.min}°</span>
        </span>
        <span>
          {t('Pioggia')} <span className="text-ink">{w.rain}%</span>
        </span>
      </div>
      {w.hours && w.hours.length > 0 && (
        <>
          <div className="h-px bg-divider" />
          <div className="grid grid-cols-4 gap-2 text-center">
            {w.hours.map((h) => (
              <div key={h.hour} className="flex flex-col items-center gap-1.5">
                <span className="text-[13px] text-dim">{h.hour}</span>
                <WeatherIcon code={h.code} day={h.day} size={26} />
                <span className="text-[15px] text-ink">{h.temp}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
