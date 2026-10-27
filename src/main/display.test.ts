import { describe, expect, it } from 'vitest'
import { fitZoom, centeredBounds, findDockDisplay, type DisplayLike } from './display'

const monitor = (id: number, width: number, height: number, scaleFactor = 1, x = 0): DisplayLike => ({
  id,
  bounds: { x, y: 0, width, height },
  scaleFactor
})

describe('findDockDisplay', () => {
  const target = { width: 1024, height: 600 }

  it('trova il 7 pollici tra due monitor grandi', () => {
    const displays = [monitor(1, 2560, 1440), monitor(2, 1920, 1080, 1, 2560), monitor(3, 1024, 600, 1, 4480)]
    expect(findDockDisplay(displays, target)?.id).toBe(3)
  })

  it('tiene conto del ridimensionamento di Windows', () => {
    // 1024×600 al 125% viene riportato da Electron come 819×480 logici
    const displays = [monitor(1, 2560, 1440), monitor(2, 819.2, 480, 1.25)]
    expect(findDockDisplay(displays, target)?.id).toBe(2)
  })

  it('riconosce lo schermo ruotato', () => {
    expect(findDockDisplay([monitor(1, 600, 1024)], target)?.id).toBe(1)
  })

  it('non trova nulla se il dock non è collegato', () => {
    expect(findDockDisplay([monitor(1, 2560, 1440), monitor(2, 1920, 1080)], target)).toBeUndefined()
  })
})

describe('centeredBounds', () => {
  it('centra la finestra nell’area di lavoro', () => {
    expect(centeredBounds({ x: 0, y: 0, width: 1920, height: 1040 }, { width: 1024, height: 600 })).toEqual({
      x: 448,
      y: 220,
      width: 1024,
      height: 600
    })
  })
})

describe('zoom per schermi diversi', () => {
  it('a 1024×600 un pixel CSS è un pixel reale, anche con il ridimensionamento di Windows', () => {
    expect(fitZoom({ width: 1024, height: 600 }, 1)).toBe(1)
    expect(fitZoom({ width: 819.2, height: 480 }, 1.25)).toBe(0.8)
  })
  it('ingrandisce su schermi più grandi e rimpicciolisce su quelli più piccoli', () => {
    expect(fitZoom({ width: 1280, height: 800 }, 1)).toBe(1.25)
    expect(fitZoom({ width: 800, height: 480 }, 1)).toBe(0.781)
    expect(fitZoom({ width: 1920, height: 1080 }, 1)).toBe(1.8)
  })
})
