import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import type { SecretKey } from '@shared/types'
import { tr } from './i18n'

/** Chiavi ammesse: un token Vercel per account */
export const isSecretKey = (k: string): k is SecretKey => /^vercel\.[a-z0-9-]{1,40}$/.test(k)

/** Token salvati cifrati con l'account di Windows: non finiscono mai in config.json né nell'interfaccia. */
export class Secrets {
  private file: string
  private data: Partial<Record<SecretKey, string>> = {}

  constructor(dir: string) {
    this.file = join(dir, 'secrets.json')
    if (existsSync(this.file)) {
      try {
        this.data = JSON.parse(readFileSync(this.file, 'utf8'))
      } catch {
        this.data = {}
      }
    }
  }

  get(key: SecretKey): string | undefined {
    const v = this.data[key]
    if (!v || !safeStorage.isEncryptionAvailable()) return undefined
    try {
      return safeStorage.decryptString(Buffer.from(v, 'base64'))
    } catch {
      return undefined
    }
  }

  set(key: SecretKey, value: string): void {
    if (!isSecretKey(key)) throw new Error(tr('Chiave non valida'))
    const v = value.trim()
    if (!v) delete this.data[key]
    else this.data[key] = safeStorage.encryptString(v).toString('base64')
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
  }

  /** Quali token sono impostati (solo sì/no, mai il valore) */
  status(): Record<SecretKey, boolean> {
    return Object.fromEntries(Object.keys(this.data).map((k) => [k, !!this.data[k]]))
  }
}
