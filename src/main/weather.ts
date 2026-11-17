import type { WeatherInfo } from '@shared/types'
import { tr } from './i18n'

/**
 * Meteo da Open-Meteo: gratuito, senza chiave e senza registrazione.
 * La città diventa coordinate una volta sola; le previsioni restano in memoria 15 minuti.
 */
const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const TTL_MS = 15 * 60_000

interface Place {
  name: string
  lat: number
  lon: number
}

const places = new Map<string, Place | null>()
let cache: { key: string; at: number; info: WeatherInfo } | undefined

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function findPlace(city: string, lang: string): Promise<Place | null> {
  const key = `${city.trim().toLowerCase()}|${lang}`
  if (places.has(key)) return places.get(key) ?? null
  const q = new URLSearchParams({ name: city.trim(), count: '1', language: lang, format: 'json' })
  const j = await getJson<{ results?: { name: string; latitude: number; longitude: number }[] }>(
    `${GEO}?${q}`
  )
  const r = j.results?.[0]
  const place = r ? { name: r.name, lat: r.latitude, lon: r.longitude } : null
  places.set(key, place)
  return place
}

interface RawForecast {
  current?: { temperature_2m: number; weather_code: number; is_day: number }
  hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[]; is_day: number[] }
  daily?: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
  }
}

/** Le prossime ore a passi di due, a partire dall'ora dopo quella attuale */
export function nextHours(raw: RawForecast, now: Date, count = 4, step = 2): WeatherInfo['hours'] {
  const h = raw.hourly
  if (!h) return []
  const start = h.time.findIndex((iso) => new Date(iso).getTime() > now.getTime())
  if (start < 0) return []
  const out: WeatherInfo['hours'] = []
  for (let i = start; i < h.time.length && out.length < count; i += step) {
    out.push({
      hour: new Date(h.time[i]).getHours(),
      temp: Math.round(h.temperature_2m[i]),
      code: h.weather_code[i],
      day: h.is_day[i] === 1
    })
  }
  return out
}

export async function readWeather(city: string, lang: string): Promise<WeatherInfo> {
  if (!city.trim()) return { ok: false, error: tr('Scegli la città nelle Impostazioni') }
  const key = `${city}|${lang}`
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.info
  try {
    const place = await findPlace(city, lang)
    if (!place) return { ok: false, error: tr('Città non trovata: {city}', { city }) }
    const q = new URLSearchParams({
      latitude: String(place.lat),
      longitude: String(place.lon),
      current: 'temperature_2m,weather_code,is_day',
      hourly: 'temperature_2m,weather_code,is_day',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '2'
    })
    const raw = await getJson<RawForecast>(`${FORECAST}?${q}`)
    if (!raw.current || !raw.daily) return { ok: false, error: tr('Meteo non disponibile') }
    const info: WeatherInfo = {
      ok: true,
      city: place.name,
      temp: Math.round(raw.current.temperature_2m),
      code: raw.current.weather_code,
      day: raw.current.is_day === 1,
      max: Math.round(raw.daily.temperature_2m_max[0]),
      min: Math.round(raw.daily.temperature_2m_min[0]),
      rain: raw.daily.precipitation_probability_max[0] ?? 0,
      hours: nextHours(raw, new Date())
    }
    cache = { key, at: Date.now(), info }
    return info
  } catch (e) {
    // Senza rete resta l'ultimo meteo letto, se c'è
    if (cache?.key === key) return cache.info
    return { ok: false, error: tr('Meteo non raggiungibile: {message}', { message: (e as Error).message }) }
  }
}
