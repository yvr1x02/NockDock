import { useEffect, useState } from 'react'
import type { DockConfig } from '@shared/types'
import { api } from '../lib/dock'
import { accentVars, accountOf, badgeStyle, setAccentTheme } from '../lib/accounts'
import { Sprite } from '../components/Sprite'
import { Group, SmallButton, Toggle } from '../components/form'
import { Toast } from '../components/ui'
import {
  AccountsSection,
  DisplaySection,
  LanguagePicker,
  ProjectImport,
  IdlePicker,
  ThemePicker,
  type SectionProps
} from './sections'
import { validate } from './Settings'
import { getLang, setLang, t } from '../lib/i18n'
import { resolveLang, type Lang } from '@shared/i18n'

const STEPS = ['Benvenuto', 'Schermo', 'Browser e account', 'Progetti', 'Aspetto e avvio', 'Fatto'] as const

/** L'account creato di serie si chiama Personale o Personal secondo la lingua */
function localizeFirstAccount(d: DockConfig, lang: Lang): DockConfig {
  const first = d.accounts[0]
  if (first.name !== 'Personale' && first.name !== 'Personal') return d
  return {
    ...d,
    accounts: [{ ...first, name: lang === 'en' ? 'Personal' : 'Personale' }, ...d.accounts.slice(1)]
  }
}

/**
 * Setup guidato al primo avvio: schermo, browser e account, progetti, Yuyu.
 * Il resto (token, Twitch, Steam, snippet) si sistema dopo, dalle Impostazioni.
 */
export function Setup({ initial, onDone }: { initial: DockConfig; onDone: (cfg: DockConfig) => void }) {
  const [draft, setDraft] = useState<DockConfig>(() => localizeFirstAccount(initial, getLang()))
  const [step, setStep] = useState(0)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.setTyping(true)
    return () => void api.setTyping(false)
  }, [])

  // Se c'è un browser con i profili (Brave, Chrome, Edge) lo propone già scelto
  useEffect(() => {
    api.detectBrowsers().then((list) => {
      const b = list[0]
      if (!b) return
      setDraft((d) =>
        d.browser.kind !== 'default'
          ? d
          : {
              ...d,
              browser: { kind: b.kind, path: b.path },
              accounts: d.accounts.map((a, i) =>
                i === 0 && !a.browserProfile ? { ...a, browserProfile: b.profiles[0]?.dir ?? '' } : a
              )
            }
      )
    })
  }, [])

  const say = (text: string, error?: boolean): void => {
    setToast({ text, error })
    setTimeout(() => setToast(null), error ? 4000 : 2200)
  }
  const props: SectionProps = { draft, patch: (fn) => setDraft((d) => fn(d)), say }

  // Nel setup la lingua cambia subito, e il nome dell'account di partenza la segue
  const pickLanguage: SectionProps['patch'] = (fn) =>
    setDraft((d) => {
      const next = fn(d)
      const lang = resolveLang(next.language, navigator.language)
      setLang(lang)
      return localizeFirstAccount(next, lang)
    })

  const finish = async (): Promise<void> => {
    const problem = validate(draft)
    if (problem) return say(problem, true)
    setSaving(true)
    const saved = await api.saveConfig({ ...draft, setupDone: true })
    onDone(saved)
  }

  const last = step === STEPS.length - 1

  // Il tema scelto si vede subito, anche prima di salvare
  const theme =
    draft.theme === 'light' ||
    (draft.theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches)
      ? 'light'
      : 'dark'
  setAccentTheme(theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div
      className="relative flex h-full w-full flex-col bg-ground"
      style={accentVars(draft.accounts[0].color)}
    >
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-divider px-6">
        <span className="text-lg font-bold">{t('Configura il dock')}</span>
        <ol className="m-0 flex flex-1 list-none items-center justify-end gap-1.5 p-0">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? 'step' : undefined}
              className={`flex h-8 items-center rounded-full px-3 text-xs font-semibold ${
                i === step ? 'bg-accent-tint text-accent-text' : i < step ? 'text-soft' : 'text-dim'
              }`}
            >
              {i < step ? '✓ ' : `${i + 1}. `}
              {t(s)}
            </li>
          ))}
        </ol>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-5">
        {step === 0 && (
          <div className="flex flex-1 items-center gap-10 px-6">
            <Sprite anim="idle" scale={4} />
            <div className="flex flex-col gap-4">
              <h1 className="m-0 text-[32px] leading-tight font-bold">
                {t('Ciao! Prepariamo il tuo dock.')}
              </h1>
              <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-soft">
                <li>{t('scegli lo schermo su cui vive')}</li>
                <li>{t('collega il browser e i tuoi account (es. Personale e Lavoro)')}</li>
                <li>{t('trova i tuoi progetti in una cartella')}</li>
              </ul>
              <LanguagePicker draft={draft} patch={pickLanguage} />
              <span className="text-sm text-muted">
                {t('Ci vuole un minuto. Puoi cambiare tutto quando vuoi da Sistema → Impostazioni.')}
              </span>
            </div>
          </div>
        )}
        {step === 1 && <DisplaySection {...props} />}
        {step === 2 && <AccountsSection {...props} />}
        {step === 3 && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {draft.projects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-muted">{t('Aggiunti:')}</span>
                {draft.projects.map((p) => (
                  <span
                    key={p.id}
                    className="flex h-8 items-center rounded-full px-3 text-xs font-semibold"
                    style={badgeStyle(accountOf(draft, p.account).color)}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            )}
            <ProjectImport {...props} />
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <Group title={t('Tema')}>
              <ThemePicker draft={draft} patch={props.patch} />
            </Group>
            <Toggle
              checked={draft.buddy.enabled}
              onChange={(v) => setDraft((d) => ({ ...d, buddy: { ...d.buddy, enabled: v } }))}
              label={t('Mascotte (Yuyu)')}
              sub={t(
                'Un personaggio in pixel art che cammina nella barra in alto e reagisce a quello che fai'
              )}
            />
            <Group title={t('Schermata di riposo')}>
              <IdlePicker draft={draft} patch={props.patch} />
            </Group>
            <Toggle
              checked={draft.openAtLogin}
              onChange={(v) => setDraft((d) => ({ ...d, openAtLogin: v }))}
              label={t('Apri il dock all’accesso a Windows')}
            />
          </div>
        )}
        {step === 5 && (
          <div className="flex flex-1 items-center gap-10 px-6">
            <Sprite anim="jump" scale={4} />
            <div className="flex flex-col gap-3">
              <h1 className="m-0 text-[30px] font-bold">{t('Tutto pronto')}</h1>
              <span className="text-base text-soft">
                {draft.projects.length} {draft.projects.length === 1 ? t('progetto') : t('progetti')} ·{' '}
                {draft.accounts.map((a) => a.name).join(', ')} ·{' '}
                {draft.display.mode === 'window' ? t('in finestra') : t('sul monitor del dock')}
              </span>
              <span className="max-w-[560px] text-sm leading-relaxed text-muted">
                {t(
                  'Quando ti servono, in Impostazioni → Collegamenti trovi i token Vercel, Twitch, la cartella di Steam e gli hook per far seguire Claude Code a Yuyu.'
                )}
              </span>
            </div>
          </div>
        )}
      </main>

      <footer className="flex h-[72px] shrink-0 items-center gap-3 border-t border-divider px-6">
        {step > 0 && <SmallButton onClick={() => setStep((s) => s - 1)}>{t('Indietro')}</SmallButton>}
        <span className="flex-1" />
        {step === 3 && draft.projects.length === 0 && (
          <span className="text-[13px] text-muted">{t('Puoi anche aggiungerli dopo')}</span>
        )}
        {last ? (
          <SmallButton primary disabled={saving} onClick={finish}>
            {saving ? t('Salvo…') : t('Apri il dock')}
          </SmallButton>
        ) : (
          <SmallButton primary onClick={() => setStep((s) => s + 1)}>
            {step === 0 ? t('Iniziamo') : t('Avanti')}
          </SmallButton>
        )}
      </footer>
      {toast && <Toast text={toast.text} error={toast.error} />}
    </div>
  )
}
