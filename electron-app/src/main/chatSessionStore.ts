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
  private getSessionsDir(): string {
    const dir = join(app.getPath('userData'), 'chat-sessions')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private sessionPath(id: string): string {
    return join(this.getSessionsDir(), `${id}.json`)
  }

  /** Save or update a chat session */
  public saveSession(session: ChatSession): void {
    const filePath = this.sessionPath(session.id)
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
    console.log(`[ChatSessionStore] Session ${session.id} saved to: ${filePath}`)
  }

  /** Load a single session by ID */
  public loadSession(id: string): ChatSession | null {
    const filePath = this.sessionPath(id)
    if (!existsSync(filePath)) return null
    try {
      const raw = readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as ChatSession
    } catch (err) {
      console.error(`[ChatSessionStore] Failed to load session ${id}:`, err)
      return null
    }
  }

  /** List all sessions (metadata only — no full message arrays, for sidebar performance) */
  public listSessions(): Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }> {
    try {
      const dir = this.getSessionsDir()
      console.log(`[ChatSessionStore] Reading session files from: ${dir}`)
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
      const sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }> = []

      for (const file of files) {
        try {
          const raw = readFileSync(join(dir, file), 'utf-8')
          const session = JSON.parse(raw) as ChatSession
          sessions.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages ? session.messages.length : 0
          })
        } catch (err) {
          console.error(`[ChatSessionStore] Corrupted session file ${file}:`, err)
        }
      }

      // Sort by most recently updated first
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch (err) {
      console.error('[ChatSessionStore] Failed to list sessions:', err)
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
