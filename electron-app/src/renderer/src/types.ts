export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error'

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
  currentPhase: string
  steps: ParsedStep[]
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
}
