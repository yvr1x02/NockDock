export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayLike {
  id: number
  bounds: Rect
  scaleFactor: number
  internal?: boolean
}

/**
 * Trova il monitor del dock confrontando la risoluzione fisica
 * (dimensione logica × fattore di scala) con quella attesa.
 * Accetta anche il monitor ruotato e una tolleranza di qualche pixel.
 */
export function findDockDisplay<T extends DisplayLike>(
  displays: T[],
  target: { width: number; height: number },
  tolerance = 4
): T | undefined {
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= tolerance
  return displays.find((d) => {
    const w = Math.round(d.bounds.width * d.scaleFactor)
    const h = Math.round(d.bounds.height * d.scaleFactor)
    return (
      (near(w, target.width) && near(h, target.height)) || (near(w, target.height) && near(h, target.width))
    )
  })
}

/** Finestra centrata sul monitor principale quando il dock non è collegato. */
export function centeredBounds(area: Rect, size: { width: number; height: number }): Rect {
  return {
    width: size.width,
    height: size.height,
    x: Math.round(area.x + (area.width - size.width) / 2),
    y: Math.round(area.y + (area.height - size.height) / 2)
  }
}

/**
 * Sceglie il monitor del dock secondo le impostazioni:
 * - window: nessuno (finestra normale);
 * - display: quello scelto, se è ancora collegato; altrimenti si ripiega sulla risoluzione;
 * - auto: il monitor con la risoluzione indicata, mai il principale se ce ne sono altri uguali.
 */
export function pickDockDisplay<T extends DisplayLike>(
  displays: T[],
  cfg: { mode: 'auto' | 'display' | 'window'; displayId?: number; width: number; height: number },
  primaryId?: number
): T | undefined {
  if (cfg.mode === 'window') return undefined
  if (cfg.mode === 'display') {
    const chosen = displays.find((d) => d.id === cfg.displayId)
    if (chosen) return chosen
  }
  const others = displays.filter((d) => d.id !== primaryId)
  // Il monitor principale fa da dock solo se è l'unico con quella risoluzione e non ce ne sono altri
  return findDockDisplay(others, cfg) ?? (displays.length === 1 ? undefined : findDockDisplay(displays, cfg))
}

/** Layout di riferimento dell'interfaccia */
export const DESIGN = { width: 1024, height: 600 }

/**
 * Zoom della pagina per far stare il layout 1024×600 sul monitor del dock.
 * Su 1024×600 vale 1/scala (un pixel CSS = un pixel reale); su 1280×800 ingrandisce, su 800×480 rimpicciolisce.
 * Le altezze dell'interfaccia sono elastiche, quindi un rapporto diverso riempie comunque lo schermo.
 */
export function fitZoom(bounds: { width: number; height: number }, scaleFactor: number): number {
  const w = bounds.width * scaleFactor
  const h = bounds.height * scaleFactor
  const fit = Math.min(w / DESIGN.width, h / DESIGN.height)
  return Math.round((fit / scaleFactor) * 1000) / 1000
}
