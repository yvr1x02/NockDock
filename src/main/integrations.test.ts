import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '@shared/types'
import { hookSnippet, projectForCwd, stateForEvent } from './claude'
import { levelFor, streakFrom } from './streak'
import { parseAppManifest, parseLibraryFolders } from './steam'
import { toDeploy } from './vercel'

const proj = (id: string, path: string): ProjectConfig => ({ id, name: id, path, account: 'personale' })

describe('Claude Code', () => {
  const projects = [
    proj('dev', 'C:\\dev'),
    proj('shop', 'C:\\dev\\acme-shop'),
    proj('tl', 'C:\\dev\\timelog')
  ]

  it('associa la cartella al progetto più specifico, senza badare a maiuscole e barre', () => {
    expect(projectForCwd(projects, 'c:/Dev/Acme-Shop/app')?.id).toBe('shop')
    expect(projectForCwd(projects, 'C:\\dev\\timelog')?.id).toBe('tl')
    expect(projectForCwd(projects, 'C:\\dev\\timelog-old')?.id).toBe('dev')
    expect(projectForCwd(projects, 'D:\\altro')).toBeUndefined()
  })

  it('traduce gli eventi degli hook', () => {
    expect(stateForEvent('UserPromptSubmit')).toBe('working')
    expect(stateForEvent('Notification')).toBe('waiting')
    expect(stateForEvent('Stop')).toBe('done')
    expect(stateForEvent('SessionEnd')).toBe('end')
    expect(stateForEvent('PreCompact')).toBeUndefined()
  })

  it('genera gli hook con il percorso dello script', () => {
    const j = JSON.parse(hookSnippet('C:\\Users\\user\\AppData\\Roaming\\Dock\\dock-hook.cjs'))
    expect(Object.keys(j.hooks)).toEqual(['UserPromptSubmit', 'Notification', 'Stop', 'SessionEnd'])
    expect(j.hooks.Stop[0].hooks[0]).toEqual({
      type: 'command',
      command: 'node "C:/Users/user/AppData/Roaming/Dock/dock-hook.cjs"'
    })
  })
})

describe('serie e livelli', () => {
  const today = new Date(2026, 9, 26, 10)
  const day = (offset: number, h = 15): Date => new Date(2026, 9, 26 + offset, h)

  it('conta i giorni consecutivi fino a oggi', () => {
    expect(streakFrom([day(0), day(-1), day(-1, 9), day(-2), day(-4)], today)).toEqual({
      streak: 3,
      committedToday: true
    })
  })

  it('se oggi non hai ancora committato la serie vale fino a ieri', () => {
    expect(streakFrom([day(-1), day(-2)], today)).toEqual({ streak: 2, committedToday: false })
    expect(streakFrom([day(-3)], today)).toEqual({ streak: 0, committedToday: false })
  })

  it('calcola livello e titolo', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Novizio', nextAt: 5 })
    expect(levelFor(20)).toMatchObject({ level: 3, title: 'Scudiero del codice', nextAt: 45 })
    expect(levelFor(30).progress).toBeCloseTo(10 / 25)
    expect(levelFor(100_000).title).toBe('Leggenda')
  })
})

describe('Steam', () => {
  it('legge le librerie e i manifest', () => {
    const vdf =
      '"libraryfolders"\n{\n "0"\n {\n  "path"\t\t"C:\\\\Program Files (x86)\\\\Steam"\n }\n "1"\n {\n  "path"\t\t"D:\\\\SteamLibrary"\n }\n}'
    expect(parseLibraryFolders(vdf)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'])
    expect(
      parseAppManifest('"AppState"\n{\n\t"appid"\t\t"250900"\n\t"name"\t\t"The Binding of Isaac: Rebirth"\n}')
    ).toEqual({
      appId: '250900',
      name: 'The Binding of Isaac: Rebirth'
    })
  })
})

describe('Vercel', () => {
  it('normalizza un deploy', () => {
    expect(toDeploy({ url: 'shop-abc.vercel.app', readyState: 'ERROR', target: null, createdAt: 0 })).toEqual(
      {
        url: 'https://shop-abc.vercel.app',
        state: 'ERROR',
        target: 'preview',
        createdAt: '1970-01-01T00:00:00.000Z'
      }
    )
  })
})

describe('ponte Claude Code', () => {
  it('riceve l’evento dello script dell’hook e lo associa al progetto', async () => {
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { spawn } = await import('node:child_process')
    const { ClaudeBridge } = await import('./claude')
    const dir = mkdtempSync(join(tmpdir(), 'dock-'))
    const events: unknown[] = []
    const bridge = new ClaudeBridge(
      dir,
      () => [proj('shop', '/home/u/shop')],
      (e) => events.push(e)
    )
    bridge.start()
    await new Promise((r) => setTimeout(r, 100))
    // Esegue lo script generato esattamente come farebbe Claude Code
    await new Promise<void>((resolve) => {
      const child = spawn(process.execPath, [bridge.scriptPath])
      child.on('exit', () => resolve())
      child.stdin.end(
        JSON.stringify({ hook_event_name: 'Notification', cwd: '/home/u/shop/src', session_id: 'x' })
      )
    })
    await new Promise((r) => setTimeout(r, 100))
    bridge.stop()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ projectId: 'shop', state: 'waiting' })
    expect(bridge.status().shop?.state).toBe('waiting')
  })
})
