import { useEffect, useMemo, useState } from 'react'
import type { DockConfig } from '@shared/types'
import { api, useDock, type SettingsSection } from '../lib/dock'
import { accentVars, accountOf } from '../lib/accounts'
import { Icon, type IconName } from '../components/Icon'
import { SmallButton } from '../components/form'
import {
  AccountsSection,
  AppearanceSection,
  DisplaySection,
  GeneralSection,
  LinksSection,
  PostazioneSection,
  ProjectsSection,
  SnippetSection,
  YuyuSection,
  type SectionProps
} from './sections'
import { t } from '../lib/i18n'

const SECTIONS: { id: SettingsSection; label: string; icon: IconName }[] = [
  { id: 'generale', label: 'Generale', icon: 'gear' },
  { id: 'aspetto', label: 'Aspetto', icon: 'sun' },
  { id: 'schermo', label: 'Schermo', icon: 'scene' },
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'progetti', label: 'Progetti', icon: 'folder' },
  { id: 'collegamenti', label: 'Collegamenti', icon: 'open' },
  { id: 'yuyu', label: 'Yuyu', icon: 'sparkle' },
  { id: 'postazione', label: 'Postazione', icon: 'sliders' },
  { id: 'snippet', label: 'Snippet', icon: 'clipboard' }
]

/** Controlla la bozza prima di salvare: restituisce il primo problema, se c'è */
export function validate(d: DockConfig): string | null {
  if (d.accounts.some((a) => !a.name.trim())) return t('Ogni account deve avere un nome')
  const ids = new Set<string>()
  for (const p of d.projects) {
    if (!p.name.trim()) return t('C’è un progetto senza nome')
    if (!p.path.trim()) return t('{name}: manca la cartella', { name: p.name })
    if (ids.has(p.id)) return t('Due progetti con lo stesso id: {id}', { id: p.id })
    ids.add(p.id)
    if (p.devPort !== undefined && (p.devPort < 1 || p.devPort > 65535))
      return t('{name}: porta non valida', { name: p.name })
  }
  return null
}

export function Settings({ section, onClose }: { section: SettingsSection; onClose: () => void }) {
  const { config, state, say } = useDock()
  const [draft, setDraft] = useState<DockConfig>(config)
  const [current, setCurrent] = useState<SettingsSection>(section)
  const [saving, setSaving] = useState(false)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config])

  // Si scrive con la tastiera: il dock prende il focus finché le impostazioni sono aperte
  useEffect(() => {
    api.setTyping(true)
    return () => void api.setTyping(false)
  }, [])

  const props: SectionProps = { draft, patch: (fn) => setDraft((d) => fn(d)), say }

  const save = async (): Promise<void> => {
    const problem = validate(draft)
    if (problem) return say(problem, true)
    setSaving(true)
    const saved = await api.saveConfig(draft)
    setSaving(false)
    setDraft(saved)
    say(t('Impostazioni salvate'))
    onClose()
  }

  // L'anteprima del colore segue la bozza dell'account attivo
  const accent = accountOf(draft, state.mode).color

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-ground"
      style={accentVars(accent)}
      role="dialog"
      aria-label={t('Impostazioni')}
    >
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-divider px-5">
        <Icon name="gear" size={22} className="text-accent-text" />
        <h1 className="m-0 flex-1 text-xl font-bold">{t('Impostazioni')}</h1>
        {dirty && <span className="text-[13px] text-warn">{t('Modifiche non salvate')}</span>}
        <SmallButton onClick={onClose}>{dirty ? t('Annulla') : t('Chiudi')}</SmallButton>
        <SmallButton primary disabled={!dirty || saving} onClick={save}>
          {saving ? t('Salvo…') : t('Salva')}
        </SmallButton>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[210px] shrink-0 flex-col gap-1 border-r border-divider p-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrent(s.id)}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                current === s.id ? 'bg-accent-tint text-accent-text' : 'text-soft'
              }`}
            >
              <Icon name={s.icon} size={18} />
              {t(s.label)}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const r = await api.openConfig()
              if (!r.ok) say(r.error, true)
            }}
            className="mt-auto h-10 rounded-xl px-3 text-left text-xs text-muted"
          >
            {t('Apri config.json')}
          </button>
        </nav>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          {current === 'generale' && <GeneralSection {...props} />}
          {current === 'aspetto' && <AppearanceSection {...props} />}
          {current === 'schermo' && <DisplaySection {...props} />}
          {current === 'account' && <AccountsSection {...props} />}
          {current === 'progetti' && <ProjectsSection {...props} />}
          {current === 'collegamenti' && <LinksSection {...props} />}
          {current === 'yuyu' && <YuyuSection {...props} />}
          {current === 'postazione' && <PostazioneSection {...props} />}
          {current === 'snippet' && <SnippetSection {...props} />}
        </div>
      </div>
    </div>
  )
}
