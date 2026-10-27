import { cpus, freemem, totalmem } from 'node:os'
import type { SystemStats } from '@shared/types'

let prev = snapshot()

function snapshot(): { idle: number; total: number } {
  return cpus().reduce(
    (acc, c) => {
      const t = c.times
      acc.idle += t.idle
      acc.total += t.user + t.nice + t.sys + t.idle + t.irq
      return acc
    },
    { idle: 0, total: 0 }
  )
}

/** Uso della CPU dall'ultima chiamata e della RAM, in percentuale. */
export function readSystem(): SystemStats {
  const now = snapshot()
  const dTotal = now.total - prev.total
  const dIdle = now.idle - prev.idle
  prev = now
  const cpu = dTotal > 0 ? Math.round(100 * (1 - dIdle / dTotal)) : 0
  const total = totalmem()
  const used = total - freemem()
  return {
    cpu: Math.max(0, Math.min(100, cpu)),
    ram: Math.round((100 * used) / total),
    ramUsedGb: Math.round((used / 1024 ** 3) * 10) / 10,
    ramTotalGb: Math.round((total / 1024 ** 3) * 10) / 10
  }
}
