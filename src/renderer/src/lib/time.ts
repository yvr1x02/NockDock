import { t, locale } from './i18n'
const DAY = 86_400_000

/** "ora", "5 min fa", "2 h fa", "3 g fa", poi la data. */
export function ago(iso?: string, now = Date.now()): string {
  if (!iso) return '—'
  const diff = now - Date.parse(iso)
  if (Number.isNaN(diff)) return '—'
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('ora')
  if (min < 60) return t('{min} min fa', { min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('{h} h fa', { h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('{d} g fa', { d })
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

/** "oggi, 14:52", "ieri, 18:40", "lun, 10:15" o "12 ott". */
export function opened(iso?: string, now = new Date()): string {
  if (!iso) return t('mai dal dock')
  const d = new Date(iso)
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (d.getTime() >= startOfToday) return t('oggi, {time}', { time })
  if (d.getTime() >= startOfToday - DAY) return t('ieri, {time}', { time })
  if (d.getTime() >= startOfToday - 6 * DAY)
    return `${d.toLocaleDateString(locale(), { weekday: 'short' })}, ${time}`
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}
