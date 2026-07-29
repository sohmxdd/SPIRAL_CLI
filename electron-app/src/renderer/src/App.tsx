import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ClaudeSidebar } from './components/ClaudeSidebar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { ChatMessageItem, Message } from './components/ChatMessage'
import { ClaudeInput } from './components/ClaudeInput'
import { FileNode } from './types'
import { FolderOpen, Bot } from 'lucide-react'

export default function App(): React.JSX.Element {
  const [currentDir, setCurrentDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [recentChats, setRecentChats] = useState<string[]>([])

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const activeMessageIdRef = useRef<string | null>(null)

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
        await window.api.spawnAgent(selected)
        setIsAgentRunning(true)
      }
    } catch (err) {
      console.error('Error selecting directory:', err)
    }
  }

  const handleRefreshDirectory = async (): Promise<void> => {
    if (currentDir) {
      await loadDirectoryTree(currentDir)
    }
  }

  const handleStopAgent = async (): Promise<void> => {
    await window.api.killAgent()
    setIsAgentRunning(false)
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    )
  }

  const handleNewChat = (): void => {
    setMessages([])
    activeMessageIdRef.current = null
  }

  const handleSendMessage = async (userText: string): Promise<void> => {
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: userText,
      timestamp: new Date()
    }

    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantId,
      sender: 'assistant',
      content: '',
      rawLogs: '',
      isStreaming: true,
      timestamp: new Date()
    }

    activeMessageIdRef.current = assistantId
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    // Update recent chats
    if (userText.length > 3) {
      const title = userText.slice(0, 35) + (userText.length > 35 ? '...' : '')
      setRecentChats((prev) => [title, ...prev.filter((t) => t !== title).slice(0, 9)])
    }

    // Ensure agent is running
    const running = await window.api.isAgentRunning()
    if (!running) {
      const res = await window.api.spawnAgent(currentDir || undefined)
      if (res.success) {
        setIsAgentRunning(true)
        setTimeout(() => {
          window.api.sendInput(userText)
        }, 500)
      }
    } else {
      await window.api.sendInput(userText)
    }
  }

  const handleSelectFileFromTree = (file: FileNode): void => {
    let displayPath = file.path
    if (currentDir && file.path.startsWith(currentDir)) {
      displayPath = file.path.slice(currentDir.length).replace(/^[/\\]/, '')
    }
    handleSendMessage(`/read ${displayPath}`)
  }

  // Subscribe to stdout/stderr IPC streams
  useEffect(() => {
    const unbindStdout = window.api.onAgentStdout((chunk: string) => {
      const currentId = activeMessageIdRef.current
      if (!currentId) return

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === currentId) {
            return {
              ...msg,
              content: msg.content + chunk,
              rawLogs: (msg.rawLogs || '') + chunk
            }
          }
          return msg
        })
      )
    })

    const unbindStderr = window.api.onAgentStderr((chunk: string) => {
      const currentId = activeMessageIdRef.current
      if (!currentId) return

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === currentId) {
            return {
              ...msg,
              rawLogs: (msg.rawLogs || '') + `\n[STDERR] ${chunk}`
            }
          }
          return msg
        })
      )
    })

    const unbindExit = window.api.onAgentExit(() => {
      setIsAgentRunning(false)
      setMessages((prev) =>
        prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
      )
    })

    return () => {
      unbindStdout()
      unbindStderr()
      unbindExit()
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex h-screen w-screen bg-[#18181b] text-zinc-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <ClaudeSidebar
        currentDir={currentDir}
        fileTree={fileTree}
        onNewChat={handleNewChat}
        onSelectDirectory={handleSelectDirectory}
        onRefreshDirectory={handleRefreshDirectory}
        onSelectFile={handleSelectFileFromTree}
        recentChats={recentChats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#18181b]">
        {/* Top Bar */}
        <div className="h-10 border-b border-zinc-800/60 bg-[#18181b] px-4 flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300 font-semibold">SPIRAL</span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400">Inference burning hot</span>
            {currentDir && (
              <span className="text-xs text-zinc-500 flex items-center space-x-1 pl-2 border-l border-zinc-800">
                <FolderOpen className="w-3 h-3 text-purple-400" />
                <span className="font-mono text-[11px] truncate max-w-xs">{currentDir}</span>
              </span>
            )}
          </div>
        </div>

        {/* Chat Body */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 space-y-6">
            <WelcomeScreen />
            <ClaudeInput
              onSendMessage={handleSendMessage}
              onStopAgent={handleStopAgent}
              isAgentRunning={isAgentRunning}
              currentDir={currentDir}
              centered
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Message List */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}
              </div>
            </div>

            {/* Bottom Floating Input Bar */}
            <ClaudeInput
              onSendMessage={handleSendMessage}
              onStopAgent={handleStopAgent}
              isAgentRunning={isAgentRunning}
              currentDir={currentDir}
            />
          </div>
        )}
      </div>
    </div>
  )
}
