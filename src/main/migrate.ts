import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const FILES = ['config.json', 'state.json', 'secrets.json']

/**
 * Fino alla 0.5 l'app si chiamava "Dock" e i dati stavano in %APPDATA%\\Dock.
 * Al primo avvio con il nome nuovo li copia nella cartella nuova (la vecchia resta, per sicurezza).
 */
export function migrateUserData(current: string, legacy: string): boolean {
  if (current === legacy || existsSync(join(current, 'config.json'))) return false
  if (!existsSync(join(legacy, 'config.json'))) return false
  mkdirSync(current, { recursive: true })
  for (const f of FILES) if (existsSync(join(legacy, f))) copyFileSync(join(legacy, f), join(current, f))
  return true
}
