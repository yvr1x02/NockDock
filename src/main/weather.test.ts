import { describe, expect, it } from 'vitest'
import { nextHours } from './weather'

describe('nextHours', () => {
  it('prende le ore dopo adesso, a passi di due', () => {
    const time = Array.from({ length: 12 }, (_, i) => `2026-11-17T${String(10 + i).padStart(2, '0')}:00`)
    const raw = {
      hourly: {
        time,
        temperature_2m: time.map((_, i) => 10 + i + 0.4),
        weather_code: time.map(() => 2),
        is_day: time.map((_, i) => (i < 7 ? 1 : 0))
      }
    }
    const h = nextHours(raw, new Date('2026-11-17T12:30'))
    expect(h.map((x) => x.hour)).toEqual([13, 15, 17, 19])
    expect(h[0]).toEqual({ hour: 13, temp: 13, code: 2, day: true })
    expect(h[3].day).toBe(false)
  })
})
