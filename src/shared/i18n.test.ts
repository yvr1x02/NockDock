import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN } from './i18n-en'
import { resolveLang, translate } from './i18n'

/** Tutte le chiavi usate con t('...') o tr('...') nel codice */
function usedKeys(dir: string, out = new Set<string>()): Set<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) usedKeys(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) {
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/\btr?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g))
        out.add(m[2].replace(/\\(.)/g, '$1'))
    }
  }
  return out
}

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('traduzioni', () => {
  it('ogni testo dell’interfaccia ha la versione inglese', () => {
    const missing = [...usedKeys(join(__dirname, '..'))].filter(
      (k) => !(k in EN) && /[a-zà-ÿ]{2,}/i.test(k) && !/^(https?:|C:\\|%USERPROFILE%|")/.test(k)
    )
    expect(missing).toEqual([])
  })

  it('la traduzione usa gli stessi segnaposto del testo italiano', () => {
    const wrong = Object.entries(EN).filter(([it, en]) => placeholders(it).join() !== placeholders(en).join())
    expect(wrong).toEqual([])
  })

  it('sceglie la lingua e sostituisce i segnaposto', () => {
    expect(resolveLang('auto', 'it-IT')).toBe('it')
    expect(resolveLang('auto', 'de-DE')).toBe('en')
    expect(resolveLang('it', 'en-US')).toBe('it')
    expect(translate('en', '{n} avvisi', { n: 3 })).toBe('3 alerts')
    expect(translate('it', '{n} avvisi', { n: 3 })).toBe('3 avvisi')
    expect(translate('en', 'frase senza traduzione')).toBe('frase senza traduzione')
  })
})
