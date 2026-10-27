import { describe, expect, it } from 'vitest'
import { ago, initials, opened } from './time'

describe('ago', () => {
  const now = Date.parse('2026-10-21T16:00:00+02:00')
  it('formatta i tempi relativi', () => {
    expect(ago('2026-10-21T15:59:40+02:00', now)).toBe('ora')
    expect(ago('2026-10-21T15:45:00+02:00', now)).toBe('15 min fa')
    expect(ago('2026-10-21T14:00:00+02:00', now)).toBe('2 h fa')
    expect(ago('2026-10-18T16:00:00+02:00', now)).toBe('3 g fa')
    expect(ago(undefined, now)).toBe('—')
  })
})

describe('opened', () => {
  const now = new Date(2026, 9, 21, 16, 0)
  it('usa oggi e ieri', () => {
    expect(opened(new Date(2026, 9, 21, 14, 52).toISOString(), now)).toMatch(/^oggi, 14[:.]52$/)
    expect(opened(new Date(2026, 9, 20, 18, 40).toISOString(), now)).toMatch(/^ieri, 18[:.]40$/)
    expect(opened(undefined, now)).toBe('mai dal dock')
  })
})

describe('initials', () => {
  it('prende due lettere', () => {
    expect(initials('Acme Shop')).toBe('AS')
    expect(initials('TimeLog')).toBe('TI')
    expect(initials('Città di Prova')).toBe('CD')
  })
})
