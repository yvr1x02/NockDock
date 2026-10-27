import { useEffect, useState } from 'react'
import type { DisplayInfo, SystemStats } from '@shared/types'
import { api, useDock } from '../lib/dock'
import { Card } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'
import { t } from '../lib/i18n'

export function Sistema() {
  const { config, run, openSettings } = useDock()
  const [s, setS] = useState<SystemStats | null>(null)
  const [display, setDisplay] = useState<DisplayInfo | null>(null)
  const [configPath, setConfigPath] = useState('')

  useEffect(() => {
    const tick = (): void => void api.getSystem().then(setS)
    tick()
    const timer = setInterval(tick, 2000)
    api.getDisplay().then(setDisplay)
    api.getConfigPath().then(setConfigPath)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="grid h-full grid-cols-3 gap-3">
      <Card title={t('Risorse')} className="gap-4">
        <Meter label={t('CPU')} value={s?.cpu ?? 0} />
        <Meter label={t('RAM')} value={s?.ram ?? 0} extra={s ? `${s.ramUsedGb} / ${s.ramTotalGb} GB` : ''} />
        <div className="mt-auto flex flex-col gap-1 text-xs text-muted">
          <span>{display?.label}</span>
          <span className="truncate font-mono" title={configPath}>
            {configPath}
          </span>
        </div>
      </Card>

      <Card title={t('Snippet · tocca per copiare')} className="gap-2">
        {config.snippets.map((sn) => (
          <button
            key={sn.label}
            type="button"
            onClick={() =>
              run(api.copyText(sn.text), t('{label} copiato negli appunti', { label: sn.label }))
            }
            className="flex h-11 shrink-0 items-center gap-3 rounded-xl border border-line-strong bg-raised px-3.5 text-left text-sm font-medium"
          >
            <Icon name="clipboard" size={16} className="text-muted" />
            {sn.label}
          </button>
        ))}
        {config.snippets.length === 0 && (
          <button
            type="button"
            onClick={() => openSettings('snippet')}
            className="flex h-11 items-center rounded-xl border border-dashed border-dash px-3.5 text-sm text-muted"
          >
            {t('Aggiungi uno snippet')}
          </button>
        )}
      </Card>

      <section className="grid min-w-0 grid-cols-2 grid-rows-3 gap-3">
        <Tile
          icon="camera"
          label={t('Screenshot')}
          onClick={() => run(api.screenshot(), t('Seleziona l’area da catturare'))}
        />
        <Tile icon="lock" label={t('Blocca PC')} onClick={() => run(api.lockPc(), t('PC bloccato'))} />
        <Tile
          icon="gear"
          label={t('Impostazioni')}
          sub={t('schermo, account, progetti, Yuyu')}
          wide
          onClick={() => openSettings()}
        />
        <Tile
          icon="open"
          label={t('Collegamenti')}
          sub={t('token Vercel e Claude Code')}
          wide
          onClick={() => openSettings('collegamenti')}
        />
      </section>
    </div>
  )
}

function Meter({ label, value, extra }: { label: string; value: number; extra?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex justify-between text-sm">
        <span>
          {label} {extra && <span className="text-xs text-muted">· {extra}</span>}
        </span>
        <span className="font-mono">{value}%</span>
      </span>
      <div className="h-2.5 overflow-hidden rounded-[5px] bg-line">
        <div
          className="h-full rounded-[5px] bg-accent transition-[width] duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function Tile(props: { icon: IconName; label: string; sub?: string; wide?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex flex-col items-start justify-between rounded-2xl border border-line bg-card p-3.5 text-left text-sm font-medium ${
        props.wide ? 'col-span-2' : ''
      }`}
    >
      <Icon name={props.icon} size={22} />
      <span className="flex flex-col gap-0.5">
        <span className={props.wide ? 'text-[15px] font-semibold' : ''}>{props.label}</span>
        {props.sub && <span className="text-xs text-muted">{props.sub}</span>}
      </span>
    </button>
  )
}
