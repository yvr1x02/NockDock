import { describe, expect, it } from 'vitest'
import { parseLog, parseStatus, remoteToWebUrl } from './git'

describe('parseStatus', () => {
  it('legge branch e file modificati', () => {
    const out = [
      '## main...origin/main [ahead 1]',
      ' M components/Gallery.tsx',
      'A  public/foto/pochette-01.jpg',
      '?? note.txt',
      'R  vecchio.ts -> nuovo.ts'
    ].join('\n')
    expect(parseStatus(out)).toEqual({
      branch: 'main',
      files: [
        { kind: 'M', path: 'components/Gallery.tsx' },
        { kind: 'A', path: 'public/foto/pochette-01.jpg' },
        { kind: '?', path: 'note.txt' },
        { kind: 'R', path: 'nuovo.ts' }
      ]
    })
  })

  it('gestisce un repo senza commit e senza remote', () => {
    expect(parseStatus('## No commits yet on main\n').branch).toBe('main')
    expect(parseStatus('## feat/report-ore\n').branch).toBe('feat/report-ore')
  })
})

describe('parseLog', () => {
  it('separa messaggio e data', () => {
    expect(
      parseLog('Galleria prodotti\x1f2026-10-21T14:52:00+02:00\nFix header\x1f2026-10-20T18:01:00+02:00')
    ).toEqual([
      { msg: 'Galleria prodotti', date: '2026-10-21T14:52:00+02:00' },
      { msg: 'Fix header', date: '2026-10-20T18:01:00+02:00' }
    ])
  })
})

describe('remoteToWebUrl', () => {
  it('converte ssh e https', () => {
    expect(remoteToWebUrl('git@github.com:octocat/acme-shop.git')).toBe(
      'https://github.com/octocat/acme-shop'
    )
    expect(remoteToWebUrl('https://github.com/octocat/timelog.git\n')).toBe(
      'https://github.com/octocat/timelog'
    )
    expect(remoteToWebUrl('https://token@github.com/octocat/blog')).toBe('https://github.com/octocat/blog')
  })
})
