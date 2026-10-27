/** Reazioni che il resto dell'app può chiedere al personaggio. */
export type BuddyReaction = 'jump' | 'surprise' | 'look' | 'work'

export interface BuddyLine {
  text: string
  tone?: 'info' | 'warn' | 'ok'
  /** Cosa succede se tocchi il fumetto */
  onTap?: () => void
}

type Listener = (r: BuddyReaction) => void
type LineListener = (l: BuddyLine) => void
const listeners = new Set<Listener>()
const lineListeners = new Set<LineListener>()

export const buddyBus = {
  emit(r: BuddyReaction): void {
    listeners.forEach((l) => l(r))
  },
  on(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  /** Fa dire una frase al personaggio, nel fumetto */
  speak(line: BuddyLine): void {
    lineListeners.forEach((l) => l(line))
  },
  onSpeak(l: LineListener): () => void {
    lineListeners.add(l)
    return () => lineListeners.delete(l)
  }
}

let sleepFrom = 23
let sleepTo = 7

/** Ore in cui dorme, dalle impostazioni (uguali = non dorme mai) */
export function setSleepHours(from: number, to: number): void {
  sleepFrom = from
  sleepTo = to
}

/** Notte: il personaggio dorme. */
export function isNight(d = new Date(), from = sleepFrom, to = sleepTo): boolean {
  const h = d.getHours()
  if (from === to) return false
  return from < to ? h >= from && h < to : h >= from || h < to
}
