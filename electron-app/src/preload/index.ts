import { contextBridge, ipcRenderer } from 'electron'

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

const api: SpiralAPI = {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
  getDirectoryTree: (dirPath: string) => ipcRenderer.invoke('fs:getDirectoryTree', dirPath),
  spawnAgent: (cwd?: string) => ipcRenderer.invoke('agent:spawn', cwd),
  sendInput: (text: string) => ipcRenderer.invoke('agent:sendInput', text),
  killAgent: () => ipcRenderer.invoke('agent:kill'),
  isAgentRunning: () => ipcRenderer.invoke('agent:isRunning'),
  onAgentStdout: (callback: (data: string) => void) => {
    const handler = (_: any, data: string): void => callback(data)
    ipcRenderer.on('agent:stdout', handler)
    return () => ipcRenderer.removeListener('agent:stdout', handler)
  },
  onAgentStderr: (callback: (data: string) => void) => {
    const handler = (_: any, data: string): void => callback(data)
    ipcRenderer.on('agent:stderr', handler)
    return () => ipcRenderer.removeListener('agent:stderr', handler)
  },
  onAgentExit: (callback: (code: number | null) => void) => {
    const handler = (_: any, code: number | null): void => callback(code)
    ipcRenderer.on('agent:exit', handler)
    return () => ipcRenderer.removeListener('agent:exit', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose IPC API:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
