import type { CSSProperties } from 'react'
import type { AccountConfig, DockConfig } from '@shared/types'

/** Colori pronti per gli account, con il colore del testo già scelto per stare bene sul fondo scuro */
export const COLOR_PRESETS: { color: string; text: string; name: string }[] = [
  { color: '#b3202f', text: '#ff6e7a', name: 'Rosso' },
  { color: '#a98bff', text: '#b9a2ff', name: 'Viola' },
  { color: '#2f80ed', text: '#7fb3ff', name: 'Blu' },
  { color: '#1fa971', text: '#5ee0a6', name: 'Verde' },
  { color: '#f2994a', text: '#ffb877', name: 'Arancio' },
  { color: '#e0559b', text: '#ff8cc3', name: 'Rosa' },
  { color: '#14b8c4', text: '#5fe3ec', name: 'Azzurro' },
  { color: '#c9a227', text: '#f0cd5c', name: 'Oro' }
]

let theme: 'dark' | 'light' = 'dark'

/** Il tema cambia il colore del testo d'accento: chiaro sul fondo scuro, scuro sul fondo chiaro */
export function setAccentTheme(t: 'dark' | 'light'): void {
  theme = t
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Luminosità percepita da 0 a 1 */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Colore del testo d'accento: quello del preset, altrimenti il colore schiarito */
export function accentText(color: string): string {
  if (theme === 'light') {
    const [r, g, b] = rgb(color)
    const k = luminance(color) > 0.5 ? 0.55 : 0.85
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`
  }
  const preset = COLOR_PRESETS.find((p) => p.color === color.toLowerCase())
  if (preset) return preset.text
  const [r, g, b] = rgb(color)
  const mix = (c: number): number => Math.round(c + (255 - c) * 0.35)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export function tint(color: string, alpha = 0.2): string {
  const [r, g, b] = rgb(color)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Colore del testo sopra il colore pieno dell'account */
export const onColor = (color: string): string => (luminance(color) > 0.55 ? '#0e1013' : '#ffffff')

/** Variabili CSS dell'accento per l'account attivo */
export function accentVars(color: string): CSSProperties {
  return {
    '--accent': color,
    '--accent-text': accentText(color),
    '--on-accent': onColor(color),
    '--accent-tint': tint(color, theme === 'light' ? 0.12 : luminance(color) > 0.55 ? 0.14 : 0.22)
  } as CSSProperties
}

/** Etichetta colorata dell'account (lista progetti, Home…) */
export function badgeStyle(color: string): CSSProperties {
  return { color: accentText(color), background: tint(color, theme === 'light' ? 0.12 : 0.18) }
}

export function accountOf(cfg: DockConfig, id: string): AccountConfig {
  return cfg.accounts.find((a) => a.id === id) ?? cfg.accounts[0]
}

export const accountName = (cfg: DockConfig, id: string): string => accountOf(cfg, id).name
