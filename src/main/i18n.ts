import { translate, type Lang, type Params } from '@shared/i18n'

let lang: Lang = 'it'

/** La imposta il processo principale quando legge la configurazione */
export function setMainLang(l: Lang): void {
  lang = l
}

export const mainLang = (): Lang => lang

/** Messaggi del processo principale (errori mostrati nel dock) nella lingua scelta */
export function tr(key: string, params?: Params): string {
  return translate(lang, key, params)
}
