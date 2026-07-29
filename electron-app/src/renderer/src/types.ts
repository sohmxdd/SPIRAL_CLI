export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
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
}
