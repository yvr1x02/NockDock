import { api, useDock } from '../lib/dock'
import { accentText, onColor, tint } from '../lib/accounts'
import { Panel } from '../components/ui'
import { t } from '../lib/i18n'

export function AccountPanel() {
  const { config, state, setState, openPanel, openSettings, say } = useDock()
  const browser =
    config.browser.kind === 'default'
      ? t('browser predefinito')
      : { brave: t('Brave'), chrome: t('Chrome'), edge: t('Edge'), custom: 'browser' }[config.browser.kind]
  const cols = config.accounts.length > 2 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2'

  return (
    <Panel title={t('Account')} onClose={() => openPanel(null)}>
      <div className="flex h-full flex-col gap-3.5">
        <div className={`grid min-h-0 flex-1 gap-3.5 ${cols}`}>
          {config.accounts.map((a) => {
            const active = a.id === state.mode
            const count = config.projects.filter((p) => p.account === a.id).length
            return (
              <button
                key={a.id}
                type="button"
                onClick={async () => {
                  if (active) return
                  setState(await api.setMode(a.id))
                  say(t('Ambiente {name} attivato', { name: a.name }))
                }}
                style={active ? { borderColor: a.color, background: tint(a.color, 0.18) } : undefined}
                className={`flex min-h-0 flex-col gap-3 rounded-[18px] border-2 p-5 text-left ${
                  active ? '' : 'border-line-strong bg-card'
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-[26px] font-bold" style={{ color: accentText(a.color) }}>
                    {a.name}
                  </span>
                  <span
                    className={`flex h-[26px] shrink-0 items-center rounded-full px-3 text-xs font-semibold ${
                      active ? '' : 'bg-line text-muted'
                    }`}
                    style={active ? { background: a.color, color: onColor(a.color) } : undefined}
                  >
                    {active ? t('Attivo') : t('Tocca per attivare')}
                  </span>
                </span>
                <span className="flex w-full flex-col gap-2.5 text-sm">
                  <Row
                    k={browser}
                    v={config.browser.kind === 'default' ? '—' : a.browserProfile || t('profilo predefinito')}
                  />
                  <Row k={t('Progetti')} v={String(count)} />
                  <Row k={t('Vercel')} v={a.vercelTeamId ? t('in un team') : t('senza team')} muted />
                </span>
              </button>
            )
          })}
          {config.accounts.length === 1 && (
            <button
              type="button"
              onClick={() => openSettings('account')}
              className="flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-dashed border-dash text-center"
            >
              <span className="text-lg font-semibold">{t('Aggiungi un account')}</span>
              <span className="px-8 text-[13px] text-muted">
                {t('Per esempio Lavoro: progetti, profilo del browser e token separati')}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[13px] text-muted">
            {t(
              'Si allinea da solo al progetto che apri. I link si aprono con il profilo dell’account del progetto.'
            )}
          </p>
          <button
            type="button"
            onClick={() => openSettings('account')}
            className="h-11 shrink-0 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
          >
            {t('Gestisci account')}
          </button>
        </div>
      </div>
    </Panel>
  )
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <span className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`truncate ${muted ? 'text-dim' : ''}`}>{v}</span>
    </span>
  )
}
