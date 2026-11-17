import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioState, MonitorBrightness } from '@shared/types'
import { useMedia } from '../lib/media'
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
  const [allApps, setAllApps] = useState(false)
  const [eachMonitor, setEachMonitor] = useState(false)

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
  const sendBrightAll = useThrottled(
    (ids: string[], v: number) => ids.forEach((id) => void api.setBrightness(id, v)),
    150
  )

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

  // Le prime tre app in vista, le altre a un tocco
  const shownApps = allApps ? apps : apps.slice(0, 3)
  const allBright = monitors?.filter((m) => m.ok) ?? []
  const avgBright = allBright.length
    ? Math.round(allBright.reduce((n, m) => n + m.brightness, 0) / allBright.length)
    : 0

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3">
      <Card className="gap-4 p-5">
        <span className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
          {t('Volume')}
        </span>
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
        <div className="h-px shrink-0 bg-divider" />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {!audio && <span className="text-sm text-muted">{t('Leggo il mixer di Windows…')}</span>}
          {audio && apps.length === 0 && (
            <span className="text-sm text-muted">
              {t('Nessuna app sta usando l’audio in questo momento.')}
            </span>
          )}
          {shownApps.map((a) => (
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
        <div className="flex shrink-0 items-center gap-2">
          {apps.length > 3 && (
            <button
              type="button"
              onClick={() => setAllApps((x) => !x)}
              className="h-10 rounded-xl border border-line-strong bg-raised px-4 text-sm"
            >
              {allApps ? t('Meno app') : t('Altre {n} app', { n: apps.length - 3 })}
            </button>
          )}
          <button
            type="button"
            onClick={() => openSettings('postazione')}
            className="ml-auto h-10 px-1 text-xs text-muted"
          >
            {t('Nascondi app…')}
          </button>
        </div>
      </Card>

      <div className="flex min-h-0 flex-col gap-3">
        <Card className="shrink-0 gap-2.5">
          <span className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
            {t('Uscita')}
          </span>
          <div className="grid max-h-[112px] grid-cols-3 gap-2 overflow-y-auto">
            {audio?.devices.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.name}
                onClick={async () => {
                  if (d.isDefault) return
                  const r = await api.setOutputDevice(d.id)
                  if (r.ok) say(t('Audio su {name}', { name: d.name }))
                  else report(r)
                  refresh()
                }}
                className={`h-12 truncate rounded-xl border px-2 text-[15px] ${
                  d.isDefault
                    ? 'border-accent bg-accent-tint font-semibold text-accent-text'
                    : 'border-line-strong bg-raised'
                }`}
              >
                {shortDevice(d.name)}
              </button>
            ))}
          </div>
        </Card>

        <Card className="shrink-0 gap-3">
          <span className="flex items-center justify-between">
            <span className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
              {t('Luminosità')}
            </span>
            {monitors && monitors.length > 1 && (
              <button
                type="button"
                onClick={() => setEachMonitor((x) => !x)}
                className="text-[13px] text-muted"
              >
                {eachMonitor ? t('Tutti insieme') : t('{n} monitor', { n: monitors.length })}
              </button>
            )}
          </span>
          {!monitors && !monitorError && <span className="text-sm text-muted">{t('Cerco i monitor…')}</span>}
          {monitorError && <span className="text-sm text-muted">{monitorError}</span>}
          {monitors && !eachMonitor && allBright.length > 0 && (
            <Slider
              label={t('Luminosità di tutti i monitor')}
              value={avgBright}
              onChange={(v) => {
                setMonitors((list) => list?.map((x) => (x.ok ? { ...x, brightness: v } : x)) ?? null)
                sendBrightAll(
                  allBright.map((m) => m.id),
                  v
                )
              }}
            />
          )}
          {monitors && !eachMonitor && allBright.length === 0 && (
            <span className="text-sm text-muted">{t('I monitor non accettano comandi (DDC/CI spento)')}</span>
          )}
          {eachMonitor &&
            monitors?.map((m) => (
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
        </Card>
        <Music report={report} />
      </div>
    </div>
  )
}

/** "Altoparlanti (Realtek High Definition Audio)" → "Altoparlanti" */
function shortDevice(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').trim() || name
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

/**
 * Tasti della musica. L'icona segue quello che Windows dice che sta suonando;
 * se Windows non lo sa dire, si alterna a ogni tocco.
 */
function Music({ report }: { report: (r: { ok: boolean; error?: string }) => void }) {
  const { playing, track, press } = useMedia(report)

  return (
    <Card className="min-h-0 flex-1 justify-between gap-2">
      <span className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">{t('Musica')}</span>
      {track && (
        <span className="-mt-1 truncate text-xs text-muted">
          {[track.title, track.artist].filter(Boolean).join(' · ')}
        </span>
      )}
      <div className="grid grid-cols-3 gap-2">
        <MediaButton icon="prev" label={t('Brano precedente')} onClick={() => press('prev')} />
        <MediaButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? t('Pausa') : t('Riproduci')}
          primary
          onClick={() => press('playpause')}
        />
        <MediaButton icon="next" label={t('Brano successivo')} onClick={() => press('next')} />
      </div>
    </Card>
  )
}

function MediaButton(props: {
  icon: 'prev' | 'next' | 'pause' | 'play'
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
