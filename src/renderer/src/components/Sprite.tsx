import { useEffect, useRef, useState, type CSSProperties } from 'react'
import sheetUrl from '../assets/buddy.png'
import meta from '../assets/buddy.json'

export type AnimName = keyof typeof meta.animations

export const FRAME_W = meta.frameWidth
export const FRAME_H = meta.frameHeight
const TOTAL = Object.values(meta.animations).reduce((n, a) => n + a.count, 0)

/**
 * Un'animazione del personaggio presa dal foglio di sprite.
 * Va montato con `key={anim}` così riparte dal primo fotogramma a ogni cambio.
 */
export function Sprite({
  anim,
  scale = 1,
  onEnd,
  style
}: {
  anim: AnimName
  scale?: number
  onEnd?: () => void
  style?: CSSProperties
}) {
  const a = meta.animations[anim]
  const [i, setI] = useState(0)
  const endRef = useRef(onEnd)

  useEffect(() => {
    endRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const timer = setInterval(() => setI((p) => (p + 1 >= a.count ? (a.loop ? 0 : p) : p + 1)), 1000 / a.fps)
    return () => clearInterval(timer)
  }, [a])

  // Le animazioni senza ripetizione avvisano quando finiscono
  useEffect(() => {
    if (a.loop || i < a.count - 1) return
    const timer = setTimeout(() => endRef.current?.(), 1000 / a.fps)
    return () => clearTimeout(timer)
  }, [a, i])

  const frame = a.start + i
  return (
    <div
      aria-hidden="true"
      style={{
        width: FRAME_W * scale,
        height: FRAME_H * scale,
        backgroundImage: `url(${sheetUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${TOTAL * FRAME_W * scale}px ${FRAME_H * scale}px`,
        backgroundPosition: `-${frame * FRAME_W * scale}px 0`,
        imageRendering: 'pixelated',
        ...style
      }}
    />
  )
}
