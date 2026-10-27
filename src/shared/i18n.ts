import { EN } from './i18n-en'

/**
 * Traduzioni: il testo italiano è la chiave, l'inglese sta in i18n-en.ts.
 * Una frase senza traduzione resta in italiano, così non si rompe mai niente.
 * I segnaposto si scrivono tra graffe: t('{n} avvisi', { n: 3 }).
 */
export type Lang = 'it' | 'en'
export type LangSetting = Lang | 'auto'

export function resolveLang(setting: LangSetting | undefined, systemLocale: string): Lang {
  if (setting === 'it' || setting === 'en') return setting
  return systemLocale.toLowerCase().startsWith('it') ? 'it' : 'en'
}

export type Params = Record<string, string | number>

export function translate(lang: Lang, key: string, params?: Params): string {
  const s = lang === 'en' ? (EN[key] ?? key) : key
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s
}

/** Locale per date e ore (toLocaleDateString) */
export const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-GB' }
