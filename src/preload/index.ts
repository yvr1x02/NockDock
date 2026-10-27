import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DockApi } from '../shared/types'

const listen = <A extends unknown[]>(channel: string, cb: (...args: A) => void): (() => void) => {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: DockApi = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  listDisplays: () => ipcRenderer.invoke('sys:displays'),
  detectBrowsers: () => ipcRenderer.invoke('setup:browsers'),
  suggestRoots: () => ipcRenderer.invoke('setup:roots'),
  scanFolder: (root) => ipcRenderer.invoke('setup:scan', root),
  inspectFolder: (path) => ipcRenderer.invoke('setup:inspect', path),
  pickFolder: () => ipcRenderer.invoke('setup:pick'),
  getAudio: () => ipcRenderer.invoke('audio:get'),
  setAppVolume: (key, v) => ipcRenderer.invoke('audio:app-volume', key, v),
  setAppMute: (key, m) => ipcRenderer.invoke('audio:app-mute', key, m),
  setMasterVolume: (v) => ipcRenderer.invoke('audio:master-volume', v),
  setMasterMute: (m) => ipcRenderer.invoke('audio:master-mute', m),
  setOutputDevice: (id) => ipcRenderer.invoke('audio:output', id),
  getMonitors: () => ipcRenderer.invoke('monitor:list'),
  setBrightness: (id, v) => ipcRenderer.invoke('monitor:brightness', id, v),
  media: (cmd) => ipcRenderer.invoke('media:cmd', cmd),
  openConfig: () => ipcRenderer.invoke('config:open'),
  getConfigPath: () => ipcRenderer.invoke('config:path'),
  getState: () => ipcRenderer.invoke('state:get'),
  setMode: (mode) => ipcRenderer.invoke('state:mode', mode),
  setNote: (id, note) => ipcRenderer.invoke('state:note', id, note),
  getGit: (id) => ipcRenderer.invoke('git:info', id),
  getRecap: () => ipcRenderer.invoke('git:recap'),
  openVsCode: (id) => ipcRenderer.invoke('act:vscode', id),
  openTerminal: (id) => ipcRenderer.invoke('act:terminal', id),
  openClaude: (id) => ipcRenderer.invoke('act:claude', id),
  openFolder: (id) => ipcRenderer.invoke('act:folder', id),
  openLink: (id, kind) => ipcRenderer.invoke('act:link', id, kind),
  devStatus: (id) => ipcRenderer.invoke('dev:status', id),
  devStart: (id) => ipcRenderer.invoke('dev:start', id),
  devStop: (id) => ipcRenderer.invoke('dev:stop', id),
  getSystem: () => ipcRenderer.invoke('sys:stats'),
  copyText: (text) => ipcRenderer.invoke('sys:copy', text),
  lockPc: () => ipcRenderer.invoke('sys:lock'),
  screenshot: () => ipcRenderer.invoke('sys:screenshot'),
  openClaudeDesktop: () => ipcRenderer.invoke('sys:claude-desktop'),
  getDisplay: () => ipcRenderer.invoke('sys:display'),
  setTyping: (on) => ipcRenderer.invoke('sys:typing', on),
  secretsStatus: () => ipcRenderer.invoke('secrets:status'),
  setSecret: (key, value) => ipcRenderer.invoke('secrets:set', key, value),
  claudeStatus: () => ipcRenderer.invoke('claude:status'),
  claudeHookSnippet: () => ipcRenderer.invoke('claude:snippet'),
  getVercel: (id) => ipcRenderer.invoke('vercel:info', id),
  getSteamGames: () => ipcRenderer.invoke('steam:games'),
  launchGame: (appId) => ipcRenderer.invoke('steam:launch', appId),
  getTwitch: () => ipcRenderer.invoke('twitch:live'),
  openTwitch: (login) => ipcRenderer.invoke('twitch:open', login),
  openUrl: (url, mode) => ipcRenderer.invoke('url:open', url, mode),
  getStreak: () => ipcRenderer.invoke('git:streak'),
  onClaude: (cb) => listen('claude:event', cb),
  onDevChanged: (cb) => listen('dev:changed', cb),
  onConfigChanged: (cb) => listen('config:changed', cb)
}

contextBridge.exposeInMainWorld('dock', api)
