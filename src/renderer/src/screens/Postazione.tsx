import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioState, MonitorBrightness } from '@shared/types'
import { api, useDock } from '../lib/dock'
import { Card } from '../components/ui'
import { Icon } from '../components/Icon'
import { t } from '../lib/i18n'

const POLL_MS = 3000
/** Dopo aver toccato un cursore, per un attimo il dock non lo sovrascrive con i valori letti */
const HOLD_MS = 1500
const touchedAt: Record<string, number> = {}
const hold = (key: string): void => {
  touchedAt[key] = Date.now()
}
const held = (key: string): boolean => Date.now() - (touchedAt[key] ?? 0) < HOLD_MS

/** Invia al massimo un valore ogni 90 ms mentre trascini, e sempre l'ultimo */
function useThrottled<A extends unknown[]>(fn: (...a: A) => void, ms = 90): (...a: A) => void {
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])
  return useCallback(
    (...a: A) => {
      clearTimeout(timer.current)
      const wait = ms - (Date.now() - last.current)
      if (wait <= 0) {
        last.current = Date.now()
        fnRef.current(...a)
      } else
        timer.current = setTimeout(() => {
          last.current = Date.now()
          fnRef.current(...a)
        }, wait)
    },
    [ms]
  )
}

export function Postazione() {
  const { config, say, openSettings } = useDock()
  const [audio, setAudio] = useState<AudioState | null>(null)
  const [monitors, setMonitors] = useState<MonitorBrightness[] | null>(null)
  const [monitorError, setMonitorError] = useState('')

  const refresh = useCallback(async () => {
    const a = await api.getAudio()
    setAudio((prev) => {
      if (!prev || !a.ok) return a
      // I cursori che stai muovendo restano dove li hai messi
      return {
        ...a,
        master: held('master') ? prev.master : a.master,
        apps: a.apps.map((x) => (held(x.key) ? (prev.apps.find((p) => p.key === x.key) ?? x) : x))
      }
    })
  }, [])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const timer = setInterval(refresh, POLL_MS)
    api.getMonitors().then((m) => {
      if (m.ok) setMonitors(m.monitors)
      else setMonitorError(m.error ?? t('Monitor non disponibili'))
    })
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refresh])

  const sendApp = useThrottled((key: string, v: number) => void api.setAppVolume(key, v))
  const sendMaster = useThrottled((v: number) => void api.setMasterVolume(v))
  const sendBright = useThrottled((id: string, v: number) => void api.setBrightness(id, v), 150)

  const report = (r: { ok: boolean; error?: string }): void => {
    if (!r.ok) say(r.error ?? t('Non riuscito'), true)
  }

  if (audio && !audio.ok)
    return (
      <Card className="h-full items-center justify-center gap-2 text-center">
        <Icon name="sliders" size={32} className="text-muted" />
        <span className="text-lg font-semibold">{t('Postazione non disponibile')}</span>
        <span className="max-w-[520px] text-sm text-muted">{audio.error}</span>
      </Card>
    )

  const hidden = new Set(config.postazione.hiddenApps)
  const apps = (audio?.apps ?? []).filter((a) => !hidden.has(a.key))

  return (
    <div className="grid h-full grid-cols-[1fr_270px_250px] gap-3">
      <Card title={t('Volume per app')} className="gap-1">
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {!audio && <span className="text-sm text-muted">{t('Leggo il mixer di Windows…')}</span>}
          {audio && apps.length === 0 && (
            <span className="text-sm text-muted">
              {t('Nessuna app sta usando l’audio in questo momento.')}
            </span>
          )}
          {apps.map((a) => (
            <VolumeRow
              key={a.key}
              name={a.key === 'system' ? t('Suoni di sistema') : a.name}
              volume={a.volume}
              muted={a.muted}
              onVolume={(v) => {
                hold(a.key)
                setAudio(
                  (s) => s && { ...s, apps: s.apps.map((x) => (x.key === a.key ? { ...x, volume: v } : x)) }
                )
                sendApp(a.key, v)
              }}
              onMute={async () => {
                hold(a.key)
                setAudio(
                  (s) =>
                    s && { ...s, apps: s.apps.map((x) => (x.key === a.key ? { ...x, muted: !a.muted } : x)) }
                )
                report(await api.setAppMute(a.key, !a.muted))
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => openSettings('postazione')}
          className="h-9 shrink-0 self-start rounded-lg px-1 text-xs text-muted"
        >
          {t('Nascondi app dal mixer…')}
        </button>
      </Card>

      <Card title={t('Uscita')} className="gap-3">
        {audio && (
          <VolumeRow
            name={t('Generale')}
            big
            volume={audio.master.volume}
            muted={audio.master.muted}
            onVolume={(v) => {
              hold('master')
              setAudio((s) => s && { ...s, master: { ...s.master, volume: v } })
              sendMaster(v)
            }}
            onMute={async () => {
              hold('master')
              setAudio((s) => s && { ...s, master: { ...s.master, muted: !s.master.muted } })
              report(await api.setMasterMute(!audio.master.muted))
            }}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {audio?.devices.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={async () => {
                if (d.isDefault) return
                const r = await api.setOutputDevice(d.id)
                if (r.ok) say(t('Audio su {name}', { name: d.name }))
                else report(r)
                refresh()
              }}
              className={`flex min-h-12 shrink-0 items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left text-sm ${
                d.isDefault
                  ? 'border-accent bg-accent-tint font-semibold text-accent-text'
                  : 'border-line-strong bg-raised'
              }`}
            >
              <Icon name={/cuff|head|aur|buds|airpods/i.test(d.name) ? 'headphones' : 'volume'} size={18} />
              <span className="line-clamp-2 leading-tight">{d.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex min-h-0 flex-col gap-3">
        <Card title={t('Luminosità')} className="min-h-0 flex-1 gap-2">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {!monitors && !monitorError && (
              <span className="text-sm text-muted">{t('Cerco i monitor…')}</span>
            )}
            {monitorError && <span className="text-sm text-muted">{monitorError}</span>}
            {monitors?.map((m) => (
              <div key={m.id} className="flex flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate">{m.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {m.ok ? `${m.brightness}%` : t('no DDC/CI')}
                  </span>
                </span>
                <Slider
                  label={t('Luminosità {name}', { name: m.name })}
                  value={m.brightness}
                  disabled={!m.ok}
                  onChange={(v) => {
                    setMonitors(
                      (list) => list?.map((x) => (x.id === m.id ? { ...x, brightness: v } : x)) ?? null
                    )
                    sendBright(m.id, v)
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('Musica')} className="shrink-0 gap-2">
          <div className="grid grid-cols-3 gap-2">
            <MediaButton
              icon="prev"
              label={t('Brano precedente')}
              onClick={() => api.media('prev').then(report)}
            />
            <MediaButton
              icon="pause"
              label={t('Play / pausa')}
              primary
              onClick={() => api.media('playpause').then(report)}
            />
            <MediaButton
              icon="next"
              label={t('Brano successivo')}
              onClick={() => api.media('next').then(report)}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

function Slider({
  value,
  onChange,
  disabled,
  label
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  label: string
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="slider w-full"
      style={{ '--fill': `${value}%` } as React.CSSProperties}
    />
  )
}

function VolumeRow(props: {
  name: string
  volume: number
  muted: boolean
  big?: boolean
  onVolume: (v: number) => void
  onMute: () => void
}) {
  return (
    <div className={`flex shrink-0 items-center gap-3 ${props.big ? '' : 'min-h-[52px]'}`}>
      <button
        type="button"
        aria-label={
          props.muted
            ? t('Riattiva {name}', { name: props.name })
            : t('Silenzia {name}', { name: props.name })
        }
        onClick={props.onMute}
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
          props.muted ? 'border-err text-err' : 'border-line-strong bg-raised'
        }`}
      >
        <Icon name={props.muted ? 'mute' : 'volume'} size={20} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate ${props.big ? 'text-base font-bold' : 'text-sm font-medium'}`}>
            {props.name}
          </span>
          <span className="font-mono text-xs text-muted">{props.muted ? t('muto') : `${props.volume}%`}</span>
        </span>
        <Slider
          label={t('Volume {name}', { name: props.name })}
          value={props.volume}
          onChange={props.onVolume}
        />
      </div>
    </div>
  )
}

function MediaButton(props: {
  icon: 'prev' | 'next' | 'pause'
  label: string
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className={`flex h-12 items-center justify-center rounded-xl ${
        props.primary ? 'bg-accent text-on-accent' : 'border border-line-strong bg-raised'
      }`}
    >
      <Icon name={props.icon} size={20} />
    </button>
  )
}
