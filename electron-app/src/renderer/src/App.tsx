import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ClaudeSidebar } from './components/ClaudeSidebar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { ChatMessageItem, Message } from './components/ChatMessage'
import { ClaudeInput } from './components/ClaudeInput'
import { Terminal } from './components/Terminal'
import { AgentPlanning } from './components/ui/agent-planning'
import { SettingsView } from './components/SettingsView'
import { FileNode, ParsedPlanState, ChatSessionMeta } from './types'
import { FolderOpen, Bot, TerminalSquare, AlertTriangle, X } from 'lucide-react'

// Generate a short unique ID
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat')
  const [currentDir, setCurrentDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false)
  const [showTerminal, setShowTerminal] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [planState, setPlanState] = useState<ParsedPlanState | null>(null)

  // ── Session management state ──
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionList, setSessionList] = useState<ChatSessionMeta[]>([])

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const activeMessageIdRef = useRef<string | null>(null)
  // Debounce saving so we don't write to disk on every stdout chunk
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load session list & workspace directory on app start ──
  useEffect(() => {
    refreshSessionList()
    const savedDir = localStorage.getItem('spiral_last_dir')
    if (savedDir) {
      setCurrentDir(savedDir)
      loadDirectoryTree(savedDir)
    }
  }, [])

  const refreshSessionList = async (): Promise<void> => {
    const list = await window.api.listSessions()
    setSessionList(list)
  }

  // ── Persist current session to disk (debounced) ──
  const persistSession = useCallback(
    (sessionId: string, msgs: Message[], title?: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        const sessionTitle =
          title ||
          (msgs.find((m) => m.sender === 'user')?.content.slice(0, 50) || 'Untitled Chat')

        await window.api.saveSession({
          id: sessionId,
          title: sessionTitle,
          messages: msgs.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            rawLogs: m.rawLogs,
            timestamp: m.timestamp.toISOString()
          })),
          createdAt: msgs[0]?.timestamp.toISOString() || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workingDir: currentDir
        })
        refreshSessionList()
      }, 600)
    },
    [currentDir]
  )

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
  const handleSelectDirectory = async (): Promise<string | null> => {
    try {
      const selected = await window.api.selectDirectory()
      if (selected) {
        setCurrentDir(selected)
        localStorage.setItem('spiral_last_dir', selected)
        await loadDirectoryTree(selected)
        setErrorMessage(null)
        return selected
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error selecting working directory.')
    }
    return null
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

  // ── New Chat ──
  const handleNewChat = (): void => {
    setMessages([])
    setPlanState(null)
    activeMessageIdRef.current = null
    setActiveSessionId(null)
    setCurrentView('chat')
  }

  // ── Load an existing session from sidebar ──
  const handleLoadSession = async (sessionId: string): Promise<void> => {
    const session = await window.api.loadSession(sessionId)
    if (!session) return

    setActiveSessionId(session.id)
    setPlanState(null)
    activeMessageIdRef.current = null
    setCurrentView('chat')

    // Restore messages from serialized format
    setMessages(
      session.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        rawLogs: m.rawLogs,
        isStreaming: false,
        timestamp: new Date(m.timestamp)
      }))
    )

    // Restore working directory if saved
    if (session.workingDir) {
      setCurrentDir(session.workingDir)
      await loadDirectoryTree(session.workingDir)
    }
  }

  // ── Delete a session ──
  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    await window.api.deleteSession(sessionId)
    if (activeSessionId === sessionId) {
      handleNewChat()
    }
    refreshSessionList()
  }

  // ── Settings Saved Callback ──
  const handleSettingsSaved = async (): Promise<void> => {
    // Check if a message is actively streaming
    const isStreaming = messages.some((m) => m.isStreaming)
    if (isStreaming) {
      console.log('[Settings] Agent is actively streaming a response. Deferring process restart until turn completes.')
      return
    }
    // Only kill idle agent processes so updated settings take effect on next turn without cutting off in-flight streams
    const running = await window.api.isAgentRunning()
    if (running) {
      await window.api.killAgent()
      setIsAgentRunning(false)
    }
  }

  // ── Send a message ──
  const handleSendMessage = async (userText: string): Promise<void> => {
    setErrorMessage(null)

    // Create or reuse session ID
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = uid()
      setActiveSessionId(sessionId)
    }

    const userMsg: Message = {
      id: uid(),
      sender: 'user',
      content: userText,
      timestamp: new Date()
    }

    const assistantId = uid()
    const assistantMsg: Message = {
      id: assistantId,
      sender: 'assistant',
      content: '',
      rawLogs: '',
      isStreaming: true,
      timestamp: new Date()
    }

    activeMessageIdRef.current = assistantId

    const nextMessages = [...messages, userMsg, assistantMsg]
    setMessages(nextMessages)

    // Persist immediately (creates session file on first message)
    persistSession(sessionId, nextMessages)

    // Ensure agent process is active
    const running = await window.api.isAgentRunning()
    if (!running) {
      const res = await window.api.spawnAgent(currentDir || undefined)
      if (res.success) {
        setIsAgentRunning(true)
        setTimeout(() => {
          window.api.sendInput(userText)
        }, 500)
      } else {
        setErrorMessage(res.error || 'Failed to start agent process.')
        setIsAgentRunning(false)
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

  // Subscribe to IPC streams & Plan updates
  useEffect(() => {
    const unbindStdout = window.api.onAgentStdout((chunk: string) => {
      const currentId = activeMessageIdRef.current

      // Auto-refresh file tree on file modifications
      if (chunk.includes('[FILE_OK]') || chunk.includes('Written:') || chunk.includes('Created:')) {
        if (currentDir) {
          loadDirectoryTree(currentDir)
        }
      }

      if (!currentId) return

      setMessages((prev) => {
        const updated = prev.map((msg) => {
          if (msg.id === currentId) {
            return {
              ...msg,
              content: msg.content + chunk,
              rawLogs: (msg.rawLogs || '') + chunk
            }
          }
          return msg
        })
        // Auto-persist as content streams in (debounced)
        if (activeSessionId) {
          persistSession(activeSessionId, updated)
        }
        return updated
      })
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

    const unbindExit = window.api.onAgentExit((code) => {
      setIsAgentRunning(false)
      if (code !== 0 && code !== null) {
        setErrorMessage(`Python agent process exited unexpectedly with code ${code}.`)
      }
      setMessages((prev) => {
        const updated = prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
        // Final persist when stream ends
        if (activeSessionId) {
          persistSession(activeSessionId, updated)
        }
        return updated
      })
    })

    const unbindPlan = window.api.onAgentPlanUpdate((plan) => {
      setPlanState(plan)
    })

    return () => {
      unbindStdout()
      unbindStderr()
      unbindExit()
      unbindPlan()
    }
  }, [activeSessionId, currentDir])

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, planState])

  // Find the currently-streaming assistant message ID for inline planning
  const streamingAssistantId = messages.find((m) => m.isStreaming && m.sender === 'assistant')?.id

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
        sessionList={sessionList}
        activeSessionId={activeSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setCurrentView('settings')}
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

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                showTerminal
                  ? 'bg-purple-900/40 text-purple-300 border-purple-500/40'
                  : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/40 hover:text-zinc-200'
              }`}
              title="Toggle Ground-Truth Terminal View (xterm.js)"
            >
              <TerminalSquare className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-950/80 border-b border-rose-800/60 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-100 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main View Area: Chat vs Settings View */}
        {currentView === 'settings' ? (
          <SettingsView
            onClose={() => setCurrentView('chat')}
            onSettingsSaved={handleSettingsSaved}
          />
        ) : (
          <div className="flex-1 flex min-h-0 relative">
            {/* Chat / Agent View */}
            <div className={`flex-1 flex flex-col min-h-0 ${showTerminal ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 space-y-6">
                  <WelcomeScreen currentDir={currentDir} onSelectDirectory={handleSelectDirectory} />
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
                    <div className="max-w-4xl mx-auto space-y-4 px-2">
                      {messages.map((msg) => (
                        <React.Fragment key={msg.id}>
                          <ChatMessageItem message={msg} />
                          {/* Show AgentPlanning inline under the currently-streaming assistant message */}
                          {msg.id === streamingAssistantId &&
                            planState &&
                            planState.isAgentMode &&
                            planState.steps.length > 0 && (
                              <div className="pl-10 pr-4">
                                <AgentPlanning
                                  title={planState.title}
                                  currentPhase={planState.currentPhase}
                                  activeSkill={planState.activeSkill}
                                  steps={planState.steps}
                                />
                              </div>
                            )}
                        </React.Fragment>
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

            {/* Ground-Truth Terminal Viewport (xterm.js) */}
            {showTerminal && (
              <div className="w-1/2 h-full bg-[#18181b] flex flex-col">
                <div className="px-3 py-1.5 bg-[#141416] border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span>xterm.js — Raw Terminal Stream</span>
                  <span className="text-purple-400">Ground Truth</span>
                </div>
                <div className="flex-1 relative">
                  <Terminal />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
