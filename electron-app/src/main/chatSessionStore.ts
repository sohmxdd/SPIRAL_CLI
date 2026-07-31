import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  content: string
  rawLogs?: string
  timestamp: string // ISO string for JSON serialization
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  workingDir?: string | null
}

/**
 * Manages persistent chat sessions stored as JSON files in the app's userData directory.
 * Each session is a separate .json file in `<userData>/chat-sessions/`.
 */
export class ChatSessionStore {
  private sessionsDir: string

  constructor() {
    this.sessionsDir = join(app.getPath('userData'), 'chat-sessions')
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true })
    }
  }

  private sessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`)
  }

  /** Save or update a chat session */
  public saveSession(session: ChatSession): void {
    const filePath = this.sessionPath(session.id)
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
  }

  /** Load a single session by ID */
  public loadSession(id: string): ChatSession | null {
    const filePath = this.sessionPath(id)
    if (!existsSync(filePath)) return null
    try {
      const raw = readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as ChatSession
    } catch {
      return null
    }
  }

  /** List all sessions (metadata only — no full message arrays, for sidebar performance) */
  public listSessions(): Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }> {
    try {
      const files = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'))
      const sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }> = []

      for (const file of files) {
        try {
          const raw = readFileSync(join(this.sessionsDir, file), 'utf-8')
          const session = JSON.parse(raw) as ChatSession
          sessions.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length
          })
        } catch {
          // skip corrupted files
        }
      }

      // Sort by most recently updated first
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch {
      return []
    }
  }

  /** Delete a session */
  public deleteSession(id: string): boolean {
    const filePath = this.sessionPath(id)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      return true
    }
    return false
  }
}

export const chatSessionStore = new ChatSessionStore()
