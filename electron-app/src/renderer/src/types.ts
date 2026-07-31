export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error'
export type AgentPlanLifecycle = 'idle' | 'active' | 'complete' | 'error'

export interface ParsedStep {
  id: string
  title: string
  status: PlanStepStatus
  subagent: 'PlannerAgent' | 'CoderAgent' | 'TesterAgent' | 'VerifierAgent' | 'DebuggerAgent' | 'ReflectorAgent' | 'IntentAnalyzer' | 'General'
  duration?: string
  content?: string
  defaultExpanded?: boolean
}

export interface ParsedPlanState {
  title: string
  isAgentMode: boolean
  currentPhase: AgentPlanLifecycle
  steps: ParsedStep[]
}

/** Serializable chat session (stored as JSON on disk) */
export interface ChatSessionMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ChatSession {
  id: string
  title: string
  messages: Array<{
    id: string
    sender: 'user' | 'assistant'
    content: string
    rawLogs?: string
    timestamp: string
  }>
  createdAt: string
  updatedAt: string
  workingDir?: string | null
}

export interface SpiralAPI {
  selectDirectory: () => Promise<string | null>
  selectFile: () => Promise<string | null>
  getDirectoryTree: (dirPath: string) => Promise<FileNode[]>
  spawnAgent: (cwd?: string) => Promise<{ success: boolean; error?: string }>
  sendInput: (text: string) => Promise<boolean>
  killAgent: () => Promise<boolean>
  isAgentRunning: () => Promise<boolean>
  onAgentStdout: (callback: (data: string) => void) => () => void
  onAgentStderr: (callback: (data: string) => void) => () => void
  onAgentExit: (callback: (code: number | null) => void) => () => void
  onAgentPlanUpdate: (callback: (plan: ParsedPlanState) => void) => () => void

  // Chat session persistence
  saveSession: (session: ChatSession) => Promise<boolean>
  loadSession: (id: string) => Promise<ChatSession | null>
  listSessions: () => Promise<ChatSessionMeta[]>
  deleteSession: (id: string) => Promise<boolean>

  // Settings
  getGroqKey: () => Promise<string>
  setGroqKey: (key: string) => Promise<boolean>
  getSystemPrompt: () => Promise<string>
  setSystemPrompt: (prompt: string) => Promise<boolean>
}
