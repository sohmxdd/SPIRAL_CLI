import { safeStorage, app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface SettingsData {
  groqApiKeyEncrypted?: string
  systemPrompt?: string
}

const DEFAULT_SYSTEM_PROMPT = `You are Nyx, the AI guide of SPIRAL — an autonomous coding agent.

Personality:
- Calm, intelligent, slightly witty
- Speaks in concise, sharp sentences
- Uses technical language naturally
- Helpful but never over-explains
- You ARE the system — not a separate entity

When answering questions:
- Be direct and informative
- Include code snippets when relevant (use proper formatting)
- For coding questions, give working examples
- Keep answers focused — no fluff

When responding to casual input:
- Be brief and personable
- Stay in character as a system presence
- Light humor is welcome

Always respond as Nyx. Never break character.`

export class SettingsStore {
  private getSettingsPath(): string {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return join(dir, 'settings.json')
  }

  private readRawSettings(): SettingsData {
    try {
      const p = this.getSettingsPath()
      if (!existsSync(p)) return {}
      const raw = readFileSync(p, 'utf-8')
      return JSON.parse(raw) as SettingsData
    } catch {
      return {}
    }
  }

  private writeRawSettings(data: SettingsData): void {
    const p = this.getSettingsPath()
    writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
  }

  /** Get decrypted Groq API Key */
  public getGroqApiKey(): string {
    const data = this.readRawSettings()
    if (!data.groqApiKeyEncrypted) return ''

    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(data.groqApiKeyEncrypted, 'base64')
        return safeStorage.decryptString(buf)
      } else {
        return Buffer.from(data.groqApiKeyEncrypted, 'base64').toString('utf-8')
      }
    } catch (err) {
      console.warn('[SettingsStore] safeStorage decryption fallback:', err)
      try {
        return Buffer.from(data.groqApiKeyEncrypted, 'base64').toString('utf-8')
      } catch {
        return ''
      }
    }
  }

  /** Set & encrypt Groq API Key using safeStorage with fallback */
  public setGroqApiKey(apiKey: string): void {
    const data = this.readRawSettings()
    if (!apiKey.trim()) {
      delete data.groqApiKeyEncrypted
    } else {
      try {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(apiKey.trim())
          data.groqApiKeyEncrypted = encrypted.toString('base64')
        } else {
          data.groqApiKeyEncrypted = Buffer.from(apiKey.trim()).toString('base64')
        }
      } catch (err) {
        console.warn('[SettingsStore] safeStorage encryption fallback:', err)
        data.groqApiKeyEncrypted = Buffer.from(apiKey.trim()).toString('base64')
      }
    }
    this.writeRawSettings(data)
  }

  /** Get System Prompt (personality override) */
  public getSystemPrompt(): string {
    const data = this.readRawSettings()
    return data.systemPrompt !== undefined ? data.systemPrompt : DEFAULT_SYSTEM_PROMPT
  }

  /** Set System Prompt */
  public setSystemPrompt(prompt: string): void {
    const data = this.readRawSettings()
    data.systemPrompt = prompt
    this.writeRawSettings(data)
  }
}

export const settingsStore = new SettingsStore()
