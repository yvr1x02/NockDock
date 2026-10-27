import { useCallback, useEffect, useRef, useState } from 'react'
import { Sprite, FRAME_W, FRAME_H, type AnimName } from './Sprite'
import { buddyBus, isNight, type BuddyLine, type BuddyReaction } from '../lib/buddyBus'
import { api } from '../lib/dock'
import { t } from '../lib/i18n'

export type BuddyClaude = 'working' | 'waiting' | null

interface Props {
  /** Ingrandimento dei pixel (1 nella barra in alto, 3 nel salvaschermo) */
  scale: number
  /** Zona orizzontale in cui può camminare, in px rispetto al contenitore */
  minX: number
  maxX: number
  /** Velocità di camminata in px al secondo */
  speed: number
  /** True quando c'è un dev server acceso: si mette al portatile */
  working: boolean
  /** Stato di Claude Code: pensa mentre lavora, ti chiama quando aspetta */
  claude: BuddyClaude
  /** Dove mettere il fumetto: di lato (barra in alto) o sopra la testa */
  bubble: 'side' | 'above'
}

const LOOPING: AnimName[] = ['idle', 'idleSide', 'walkLeft', 'walkRight', 'sleep', 'work', 'think']
const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const BUBBLE_MS = 7000
/** Tenendolo premuto così a lungo apre Claude Desktop */
const LONG_PRESS_MS = 600

/** Il personaggio: cammina, si guarda intorno, reagisce alle azioni, segue Claude Code e di notte dorme. */
export function Buddy({ scale, minX, maxX, speed, working, claude, bubble }: Props) {
  const startX = Math.round((minX + maxX) / 2)
  const [anim, setAnim] = useState<AnimName>('idle')
  const [x, setX] = useState(startX)
  const [walkMs, setWalkMs] = useState(0)
  const [line, setLine] = useState<BuddyLine | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const el = useRef<HTMLDivElement>(null)
  const xRef = useRef(startX)
  const workingRef = useRef(working)
  const claudeRef = useRef(claude)
  const nextRef = useRef<() => void>(() => {})
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressed = useRef(false)
  /** Mentre Claude Code aspetta alterna un salto e una pausa, per farsi notare */
  const waitJumped = useRef(false)

  useEffect(() => {
    workingRef.current = working
  }, [working])

  /** Posizione attuale, anche a metà di una camminata. */
  const currentX = useCallback((): number => {
    const node = el.current
    if (!node?.offsetParent) return xRef.current
    return node.getBoundingClientRect().left - node.offsetParent.getBoundingClientRect().left
  }, [])

  const stopWalking = useCallback(() => {
    const here = Math.round(currentX())
    xRef.current = here
    setWalkMs(0)
    setX(here)
  }, [currentX])

  const next = useCallback(() => {
    clearTimeout(timer.current)
    const after = (ms: number): void => {
      timer.current = setTimeout(() => nextRef.current(), ms)
    }
    setWalkMs(0)
    // Claude Code ha la precedenza su tutto, anche di notte
    if (claudeRef.current === 'waiting') {
      waitJumped.current = !waitJumped.current
      if (waitJumped.current) {
        setAnim('jump') // non si ripete: alla fine richiama next()
        return
      }
      setAnim('idle')
      return after(2500)
    }
    if (claudeRef.current === 'working') {
      setAnim('think')
      return after(15_000)
    }
    if (isNight()) {
      setAnim('sleep')
      return after(60_000)
    }
    if (workingRef.current && Math.random() < 0.7) {
      setAnim('work')
      return after(rand(12_000, 25_000))
    }
    const roll = Math.random()
    if (roll < 0.45) {
      // cammina fino a un punto a caso
      let target = Math.round(rand(minX, maxX))
      if (Math.abs(target - xRef.current) < 60)
        target = xRef.current > (minX + maxX) / 2 ? minX + 20 : maxX - 20
      const ms = (Math.abs(target - xRef.current) / speed) * 1000
      setAnim(target > xRef.current ? 'walkRight' : 'walkLeft')
      setWalkMs(ms)
      setX(target)
      xRef.current = target
      return after(ms)
    }
    if (roll < 0.7) {
      setAnim('idle')
      return after(rand(3000, 7000))
    }
    if (roll < 0.85) {
      setAnim('idleSide')
      return after(rand(3000, 6000))
    }
    setAnim('look') // non si ripete: alla fine chiama next()
  }, [minX, maxX, speed])

  useEffect(() => {
    nextRef.current = next
  }, [next])

  // Quando cambia lo stato di Claude Code riparte subito con il comportamento giusto
  useEffect(() => {
    claudeRef.current = claude
    const timer = setTimeout(() => {
      stopWalking()
      nextRef.current()
    }, 0)
    return () => clearTimeout(timer)
  }, [claude, stopWalking])

  const react = useCallback(
    (r: BuddyReaction) => {
      clearTimeout(timer.current)
      stopWalking()
      setAnim(r)
      if (r === 'work') timer.current = setTimeout(() => nextRef.current(), 20_000)
    },
    [stopWalking]
  )

  // Reazioni chieste dal resto dell'app
  useEffect(
    () =>
      buddyBus.on((r) => {
        if (isNight() && !claudeRef.current) return
        react(r)
      }),
    [react]
  )

  // Frasi nel fumetto
  useEffect(
    () =>
      buddyBus.onSpeak((l) => {
        clearTimeout(lineTimer.current)
        setLine(l)
        lineTimer.current = setTimeout(() => setLine(null), BUBBLE_MS)
      }),
    []
  )

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(lineTimer.current)
      clearTimeout(pressTimer.current)
    },
    []
  )

  const w = FRAME_W * scale
  // Nella barra in alto il fumetto va dal lato dove c'è più spazio
  const bubbleLeft = x - minX > maxX - x
  const toneBorder = line?.tone === 'warn' ? 'border-warn' : line?.tone === 'ok' ? 'border-ok' : 'border-dash'

  return (
    <div
      ref={el}
      className="absolute bottom-0"
      style={{ left: x, width: w, height: FRAME_H * scale, transition: `left ${walkMs}ms linear` }}
    >
      <button
        type="button"
        aria-label={t('Yuyu (tieni premuto per aprire Claude Desktop)')}
        onPointerDown={() => {
          longPressed.current = false
          clearTimeout(pressTimer.current)
          pressTimer.current = setTimeout(() => {
            longPressed.current = true
            react('jump')
            buddyBus.speak({ text: 'Apro Claude Desktop' })
            void api.openClaudeDesktop().then((r) => {
              if (!r.ok)
                buddyBus.speak({ text: r.error ?? 'Non riesco ad aprire Claude Desktop', tone: 'warn' })
            })
          }, LONG_PRESS_MS)
        }}
        onPointerUp={() => clearTimeout(pressTimer.current)}
        onPointerLeave={() => clearTimeout(pressTimer.current)}
        onPointerCancel={() => clearTimeout(pressTimer.current)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) return
          react('jump') // anche di notte: toccandolo si sveglia
        }}
        className="pointer-events-auto absolute inset-0 border-0 bg-transparent p-0 active:transform-none"
      >
        <Sprite
          key={anim}
          anim={anim}
          scale={scale}
          onEnd={LOOPING.includes(anim) ? undefined : () => nextRef.current()}
        />
      </button>
      {line && (
        <button
          type="button"
          onClick={() => {
            line.onTap?.()
            setLine(null)
          }}
          className={`pointer-events-auto absolute z-10 max-w-[300px] truncate rounded-xl border bg-raised px-3 text-[13px] font-semibold text-ink shadow-lg ${toneBorder} ${
            bubble === 'side' ? 'top-1/2 h-9 -translate-y-1/4' : 'bottom-full mb-2 h-11 text-[15px]'
          }`}
          style={
            bubble === 'side'
              ? bubbleLeft
                ? { right: w - 6 }
                : { left: w - 6 }
              : { left: '50%', transform: 'translateX(-50%)' }
          }
        >
          {line.text}
        </button>
      )}
    </div>
  )
}
