import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, useDock } from '../lib/dock'
import { ago } from '../lib/time'
import { Dot, Panel } from '../components/ui'
import { t } from '../lib/i18n'

const STATE_LABEL: Record<string, string> = {
  READY: 'Pronto',
  ERROR: 'Errore',
  BUILDING: 'In build',
  QUEUED: 'In coda',
  INITIALIZING: 'In avvio',
  CANCELED: 'Annullato'
}

/** Ultimo deploy del progetto e QR della preview, da far inquadrare al cliente. */
export function VercelPanel() {
  const { config, vercel, selId, openPanel, run, refreshVercel } = useDock()
  const p = config.projects.find((x) => x.id === selId) ?? config.projects[0]
  const v = p ? vercel[p.id] : undefined
  const preview = v?.latestPreview
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (p) refreshVercel(p.id)
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id])

  useEffect(() => {
    if (!preview?.url) return
    QRCode.toDataURL(preview.url, {
      margin: 1,
      width: 290,
      color: { dark: '#0e1013', light: '#ffffff' }
    }).then(setQr)
  }, [preview?.url])

  if (!p) return null
  const latest = v?.latest
  const production = v?.production

  return (
    <Panel title={t('Vercel · {name}', { name: p.name })} onClose={() => openPanel(null)}>
      <div className="flex h-full items-center gap-7">
        <span
          className={`flex size-80 shrink-0 items-center justify-center rounded-[18px] bg-white ${preview && qr ? '' : 'opacity-25'}`}
        >
          {preview && qr ? (
            <img
              src={qr}
              width={290}
              height={290}
              alt={t('QR code della preview {url}', { url: preview.url })}
            />
          ) : (
            <span className="px-6 text-center text-sm text-ground">{t('Nessuna preview pronta')}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {v && !v.ok && <p className="m-0 text-sm text-err">{v.error}</p>}
          {latest && (
            <div className="flex flex-col gap-1 rounded-xl bg-raised px-4 py-3">
              <span className="text-xs text-muted">{t('Ultimo deploy')}</span>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <Dot color={latest.state === 'READY' ? 'ok' : latest.state === 'ERROR' ? 'err' : 'warn'} />
                {t(STATE_LABEL[latest.state] ?? latest.state)} ·{' '}
                {latest.target === 'production' ? 'produzione' : 'preview'} · {ago(latest.createdAt)}
              </span>
            </div>
          )}
          <span className={`truncate font-mono text-lg ${preview ? '' : 'text-dim'}`}>
            {preview ? preview.url.replace('https://', '') : t('La preview compare qui quando è pronta')}
          </span>
          <span className="text-sm text-soft">
            {t("Fai inquadrare il QR al cliente: apre l'ultima preview pronta.")}
          </span>
          <div className="mt-1 flex flex-wrap gap-2.5">
            {production && (
              <button
                type="button"
                onClick={() => run(api.openUrl(production.url, p.account), t('Sito aperto nel browser'))}
                className="h-12 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent"
              >
                {t('Apri il sito')}
              </button>
            )}
            <button
              type="button"
              disabled={!preview}
              onClick={() =>
                preview && run(api.openUrl(preview.url, p.account), t('Preview aperta nel browser'))
              }
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {t('Apri la preview')}
            </button>
            <button
              type="button"
              disabled={!preview}
              onClick={() => preview && run(api.copyText(preview.url), t('Link della preview copiato'))}
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {t('Copia link')}
            </button>
            <button
              type="button"
              onClick={() => run(api.openLink(p.id, 'vercel'), t('Vercel aperto nel browser'))}
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {t('Apri dashboard')}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
