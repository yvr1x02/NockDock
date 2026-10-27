import { LOCALE, translate, type Lang, type Params } from '@shared/i18n'

let lang: Lang = 'it'

/** La imposta App a ogni cambio di configurazione */
export function setLang(l: Lang): void {
  lang = l
  document.documentElement.lang = l
}

export const getLang = (): Lang => lang
export const locale = (): string => LOCALE[lang]

/** Testo dell'interfaccia nella lingua scelta */
export function t(key: string, params?: Params): string {
  return translate(lang, key, params)
}
