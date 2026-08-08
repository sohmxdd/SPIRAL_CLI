import { dialog, ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { AgentOutputParser } from './agentOutputParser'
import { chatSessionStore } from './chatSessionStore'
import { settingsStore } from './settingsStore'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export class AgentManager {
  private currentChild: ChildProcessWithoutNullStreams | null = null
  private mainWindow: BrowserWindow | null = null
  private parser: AgentOutputParser = new AgentOutputParser()

  constructor() {}

  public setWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public findMainPy(): string | null {
    const candidates = [
      resolve(__dirname, '../../../main.py'),
      resolve(__dirname, '../../main.py'),
      resolve(process.cwd(), '../main.py'),
      resolve(process.cwd(), 'main.py'),
      resolve(process.cwd(), '../Nyx_CLI/main.py')
    ]

    for (const cand of candidates) {
      if (existsSync(cand)) {
        return cand
      }
    }
    return null
  }

  public spawnAgent(cwd?: string): { success: boolean; error?: string } {
    this.killAgent()
    this.parser.reset()

    const mainPyPath = this.findMainPy()
    if (!mainPyPath) {
      return {
        success: false,
        error: 'main.py not found in workspace.'
      }
    }

    const workingDir = cwd || resolve(mainPyPath, '..')
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3'

    const userApiKey = settingsStore.getGroqApiKey()
    const userSystemPrompt = settingsStore.getSystemPrompt()

    const spawnEnv: Record<string, string> = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1'
    }

    if (userApiKey) {
      spawnEnv.GROQ_API_KEY = userApiKey
    }

    if (userSystemPrompt) {
      spawnEnv.SPIRAL_PERSONALITY_PROMPT = userSystemPrompt
    }

    try {
      this.currentChild = spawn(pythonExe, ['-u', mainPyPath], {
        cwd: workingDir,
        env: spawnEnv
      })

      this.currentChild.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8')
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('agent:stdout', text)
          const planState = this.parser.parseChunk(text)
          this.mainWindow.webContents.send('agent:planUpdate', planState)
        }
      })

      this.currentChild.stderr.on('data', (chunk: Buffer) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('agent:stderr', chunk.toString('utf-8'))
        }
      })

      this.currentChild.on('exit', (code) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('agent:exit', code)
        }
        this.currentChild = null
      })

      this.currentChild.on('error', (err) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('agent:stderr', `[Process Error] ${err.message}\n`)
        }
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to spawn process' }
    }
  }

  public sendInput(text: string): boolean {
    if (this.currentChild && this.currentChild.stdin.writable) {
      this.currentChild.stdin.write(text + '\n')
      return true
    }
    return false
  }

  public killAgent(): boolean {
    if (this.currentChild) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', this.currentChild.pid!.toString(), '/f', '/t'])
        } else {
          this.currentChild.kill('SIGKILL')
        }
      } catch (e) {
        console.error('Error killing agent process:', e)
      }
      this.currentChild = null
      return true
    }
    return false
  }

  public setupIpcHandlers(): void {
    ipcMain.handle('dialog:selectDirectory', async () => {
      if (!this.mainWindow) return null
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    })

    ipcMain.handle('dialog:selectFile', async () => {
      if (!this.mainWindow) return null
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    })

    ipcMain.handle('fs:getDirectoryTree', async (_, dirPath: string) => {
      return this.readDirectoryTree(dirPath)
    })

    ipcMain.handle('agent:spawn', async (_, cwd?: string) => {
      return this.spawnAgent(cwd)
    })

    ipcMain.handle('agent:sendInput', async (_, text: string) => {
      return this.sendInput(text)
    })

    ipcMain.handle('agent:kill', async () => {
      return this.killAgent()
    })

    ipcMain.handle('agent:isRunning', async () => {
      return this.currentChild !== null
    })

    // ── Chat Session Persistence ──
    ipcMain.handle('chat:save', async (_, session) => {
      chatSessionStore.saveSession(session)
      return true
    })

    ipcMain.handle('chat:load', async (_, id: string) => {
      return chatSessionStore.loadSession(id)
    })

    ipcMain.handle('chat:list', async () => {
      return chatSessionStore.listSessions()
    })

    ipcMain.handle('chat:delete', async (_, id: string) => {
      return chatSessionStore.deleteSession(id)
    })

    // ── Settings IPC Handlers ──
    ipcMain.handle('settings:getGroqKey', async () => {
      return settingsStore.getGroqApiKey()
    })

    ipcMain.handle('settings:setGroqKey', async (_, key: string) => {
      settingsStore.setGroqApiKey(key)
      return true
    })

    ipcMain.handle('settings:getSystemPrompt', async () => {
      return settingsStore.getSystemPrompt()
    })

    ipcMain.handle('settings:setSystemPrompt', async (_, prompt: string) => {
      settingsStore.setSystemPrompt(prompt)
      return true
    })

    // ── Skills IPC Handler ──
    ipcMain.handle('skills:list', async (_, cwd?: string) => {
      return this.listSkills(cwd)
    })
  }

  public async listSkills(cwd?: string): Promise<any[]> {
    const mainPyPath = this.findMainPy()
    if (!mainPyPath) return []

    const pythonExe = process.platform === 'win32' ? 'python' : 'python3'
    const workingDir = cwd || resolve(mainPyPath, '..')

    return new Promise((res) => {
      let finished = false
      let proc: any = null

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true
          if (proc) {
            try {
              proc.kill()
            } catch {
              // ignore
            }
          }
          res([])
        }
      }, 5000)

      const finish = (result: any[]): void => {
        if (!finished) {
          finished = true
          clearTimeout(timer)
          res(result)
        }
      }

      try {
        proc = spawn(pythonExe, ['-u', mainPyPath, '--list-skills', workingDir], {
          cwd: workingDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
          }
        })

        let stdout = ''
        proc.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf-8')
        })

        proc.on('close', () => {
          try {
            const data = JSON.parse(stdout.trim())
            finish(Array.isArray(data) ? data : [])
          } catch {
            finish([])
          }
        })

        proc.on('error', () => finish([]))
      } catch {
        finish([])
      }
    })
  }

  private readDirectoryTree(dirPath: string, depth = 0): FileNode[] {
    if (depth > 4 || !existsSync(dirPath)) return []

    const ignoreList = new Set([
      'node_modules',
      '.git',
      '__pycache__',
      '.venv',
      'venv',
      'out',
      'dist',
      '.vite'
    ])

    try {
      const items = readdirSync(dirPath)
      const nodes: FileNode[] = []

      for (const item of items) {
        if (ignoreList.has(item) || item.startsWith('.')) continue

        const fullPath = join(dirPath, item)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            nodes.push({
              name: item,
              path: fullPath,
              isDirectory: true,
              children: this.readDirectoryTree(fullPath, depth + 1)
            })
          } else {
            nodes.push({
              name: item,
              path: fullPath,
              isDirectory: false
            })
          }
        } catch {
          // ignore
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name)
        }
        return a.isDirectory ? -1 : 1
      })
    } catch {
      return []
    }
  }
}

export const agentManager = new AgentManager()
