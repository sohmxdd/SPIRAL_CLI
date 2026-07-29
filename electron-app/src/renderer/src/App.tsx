import React, { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { Terminal } from './components/Terminal'
import { InputBar } from './components/InputBar'
import { FileNode } from './types'
import { Play, Square, FolderOpen, RotateCcw } from 'lucide-react'

export default function App(): React.JSX.Element {
  const [currentDir, setCurrentDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false)
  const [terminalKey, setTerminalKey] = useState<number>(0)

  // Load directory tree
  const loadDirectoryTree = useCallback(async (dirPath: string) => {
    try {
      const tree = await window.api.getDirectoryTree(dirPath)
      setFileTree(tree)
    } catch (err) {
      console.error('Failed to load directory tree:', err)
    }
  }, [])

  // Select working directory
  const handleSelectDirectory = async (): Promise<void> => {
    try {
      const selected = await window.api.selectDirectory()
      if (selected) {
        setCurrentDir(selected)
        await loadDirectoryTree(selected)
        // Spawn agent in selected cwd
        const res = await window.api.spawnAgent(selected)
        if (res.success) {
          setIsAgentRunning(true)
        }
      }
    } catch (err) {
      console.error('Error selecting directory:', err)
    }
  }

  // Refresh current directory
  const handleRefreshDirectory = async (): Promise<void> => {
    if (currentDir) {
      await loadDirectoryTree(currentDir)
    }
  }

  // Spawn/Restart Agent Process
  const handleStartAgent = async (): Promise<void> => {
    const res = await window.api.spawnAgent(currentDir || undefined)
    if (res.success) {
      setIsAgentRunning(true)
    }
  }

  // Stop Agent Process
  const handleStopAgent = async (): Promise<void> => {
    await window.api.killAgent()
    setIsAgentRunning(false)
  }

  // Send message or task
  const handleSendMessage = async (msg: string): Promise<void> => {
    if (!isAgentRunning) {
      const res = await window.api.spawnAgent(currentDir || undefined)
      if (res.success) {
        setIsAgentRunning(true)
        setTimeout(() => {
          window.api.sendInput(msg)
        }, 500)
      }
    } else {
      await window.api.sendInput(msg)
    }
  }

  // Clear Terminal
  const handleClearTerminal = (): void => {
    setTerminalKey((prev) => prev + 1)
  }

  // Handle clicking file in tree
  const handleSelectFileFromTree = (file: FileNode): void => {
    let displayPath = file.path
    if (currentDir && file.path.startsWith(currentDir)) {
      displayPath = file.path.slice(currentDir.length).replace(/^[/\\]/, '')
    }
    window.api.sendInput(`/read ${displayPath}`)
  }

  // Check initial process state & exit listeners
  useEffect(() => {
    const unbindExit = window.api.onAgentExit(() => {
      setIsAgentRunning(false)
    })

    return () => {
      unbindExit()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen bg-[#18181b] text-zinc-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar
        currentDir={currentDir}
        fileTree={fileTree}
        onSelectDirectory={handleSelectDirectory}
        onRefreshDirectory={handleRefreshDirectory}
        onSelectFile={handleSelectFileFromTree}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#18181b]">
        {/* Top Header Bar */}
        <div className="h-12 border-b border-zinc-800/80 bg-[#141416] px-4 flex items-center justify-between select-none">
          <div className="flex items-center space-x-3 truncate">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isAgentRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className="text-xs font-semibold text-zinc-200">
                {isAgentRunning ? 'SPIRAL Agent Active' : 'Agent Idle'}
              </span>
            </div>

            {currentDir && (
              <div className="flex items-center space-x-1 text-xs text-zinc-400 truncate pl-3 border-l border-zinc-800">
                <FolderOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate font-mono text-[11px]">{currentDir}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearTerminal}
              title="Clear Terminal View"
              className="flex items-center space-x-1 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            {isAgentRunning ? (
              <button
                onClick={handleStopAgent}
                title="Stop Agent"
                className="flex items-center space-x-1 px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/40 rounded-lg text-xs transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleStartAgent}
                title="Launch SPIRAL Agent"
                className="flex items-center space-x-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-colors shadow-sm"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Agent</span>
              </button>
            )}
          </div>
        </div>

        {/* xterm.js Terminal Viewport */}
        <div className="flex-1 relative min-h-0 bg-[#18181b]">
          <Terminal key={terminalKey} />
        </div>

        {/* Claude-style Bottom Input Bar */}
        <InputBar
          onSendMessage={handleSendMessage}
          onStopAgent={handleStopAgent}
          isAgentRunning={isAgentRunning}
          currentDir={currentDir}
        />
      </div>
    </div>
  )
}
