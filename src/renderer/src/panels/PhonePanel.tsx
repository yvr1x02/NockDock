import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, useDock } from '../lib/dock'
import { Dot, Panel } from '../components/ui'
import { t } from '../lib/i18n'

export function PhonePanel() {
  const { config, dev, selId, openPanel, run } = useDock()
  const p = config.projects.find((x) => x.id === selId) ?? config.projects[0]
  const d = p ? dev[p.id] : undefined
  const [qr, setQr] = useState('')
  const url = d?.lanUrl

  // All'apertura avvia il dev server se è fermo
  useEffect(() => {
    if (p && !d?.running) api.devStart(p.id)
    // solo all'apertura del pannello
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id])

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { margin: 1, width: 290, color: { dark: '#0e1013', light: '#ffffff' } }).then(setQr)
  }, [url])

  if (!p) return null
  const running = !!d?.running

  return (
    <Panel title={t('Apri sul telefono · {name}', { name: p.name })} onClose={() => openPanel(null)}>
      <div className="flex h-full items-center gap-7">
        <span
          className={`flex size-80 shrink-0 items-center justify-center rounded-[18px] bg-white ${running && qr ? '' : 'opacity-25'}`}
        >
          {qr ? (
            <img src={qr} width={290} height={290} alt={t('QR code di {url}', { url: url ?? '' })} />
          ) : (
            <span className="text-ground">{t('Nessuna rete')}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <span
            className={`flex items-center gap-2 text-[13px] font-semibold ${running ? 'text-ok' : d?.exitedWithError ? 'text-err' : 'text-muted'}`}
          >
            <Dot color={running ? 'ok' : d?.exitedWithError ? 'err' : 'muted'} />
            {running
              ? t('Dev server attivo in rete')
              : d?.exitedWithError
                ? t('Il dev server si è fermato con un errore')
                : t('Avvio del dev server…')}
          </span>
          <span className={`font-mono text-2xl font-medium ${running ? '' : 'text-dim'}`}>
            {url ?? t('Nessuna rete locale trovata')}
          </span>
          {d?.exitedWithError && d.lastOutput ? (
            <pre className="m-0 max-h-32 overflow-auto rounded-xl bg-raised p-3 font-mono text-xs whitespace-pre-wrap text-soft">
              {d.lastOutput}
            </pre>
          ) : (
            <ol className="m-0 flex flex-col gap-2 pl-5 text-sm leading-relaxed text-soft">
              <li>{t('Collega il telefono alla stessa Wi-Fi del PC.')}</li>
              <li>{t('Inquadra il QR con la fotocamera.')}</li>
              <li>{t('Le modifiche al codice si aggiornano da sole anche sul telefono.')}</li>
            </ol>
          )}
          <span className="text-xs text-dim">
            {t('Comando:')} {p.devCommand ?? 'pnpm dev'} {t('· porta')} {p.devPort ?? 3000}
          </span>
          <div className="mt-2 flex gap-2.5">
            <button
              type="button"
              disabled={!url}
              onClick={() => url && run(api.copyText(url), t('Indirizzo copiato negli appunti'))}
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {t('Copia indirizzo')}
            </button>
            <button
              type="button"
              onClick={() => (running ? api.devStop(p.id) : api.devStart(p.id))}
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {running ? t('Ferma il dev server') : t('Avvia il dev server')}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
