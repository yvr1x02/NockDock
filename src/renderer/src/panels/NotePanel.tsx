import { useEffect, useRef, useState } from 'react'
import { api, useDock } from '../lib/dock'
import { Panel } from '../components/ui'
import { t } from '../lib/i18n'

export function NotePanel({ projectId }: { projectId: string }) {
  const { config, state, setState, openPanel, say } = useDock()
  const p = config.projects.find((x) => x.id === projectId)
  const [text, setText] = useState(state.projects[projectId]?.note ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Il dock prende il focus solo mentre scrivi, poi lo restituisce
  useEffect(() => {
    api.setTyping(true).then(() => ref.current?.focus())
    return () => void api.setTyping(false)
  }, [])

  const save = async (): Promise<void> => {
    setState(await api.setNote(projectId, text))
    openPanel(null)
    say(text.trim() ? t('Nota salvata') : t('Nota cancellata'))
  }

  return (
    <Panel
      title={t('Nota per la prossima volta · {p0}', { p0: p?.name ?? projectId })}
      onClose={() => openPanel(null)}
    >
      <div className="flex h-full flex-col gap-3">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
          }}
          placeholder={t('Cosa devi ricordarti quando riapri questo progetto?')}
          className="min-h-0 flex-1 resize-none rounded-xl border border-line-strong bg-raised p-4 text-lg leading-relaxed text-ink outline-none placeholder:text-dim focus:border-accent"
        />
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">
            {t('Invio per salvare · Maiusc+Invio per andare a capo')}
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setText('')}
              className="h-12 rounded-xl border border-line-strong bg-raised px-4 text-sm font-semibold"
            >
              {t('Svuota')}
            </button>
            <button
              type="button"
              onClick={save}
              className="h-12 rounded-xl bg-accent px-6 text-sm font-bold text-on-accent"
            >
              {t('Salva nota')}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
