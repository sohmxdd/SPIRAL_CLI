import React, { useState } from 'react'
import { FileNode, ChatSessionMeta } from '../types'
import { FileTree } from './FileTree'
import {
  Plus,
  Home,
  FolderPlus,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Trash2
} from 'lucide-react'

interface ClaudeSidebarProps {
  currentDir: string | null
  fileTree: FileNode[]
  onNewChat: () => void
  onSelectDirectory: () => void
  onRefreshDirectory: () => void
  onSelectFile?: (file: FileNode) => void
  sessionList: ChatSessionMeta[]
  activeSessionId: string | null
  onLoadSession: (id: string) => void
  onDeleteSession: (id: string) => void
}

export const ClaudeSidebar: React.FC<ClaudeSidebarProps> = ({
  currentDir,
  fileTree,
  onNewChat,
  onSelectDirectory,
  onRefreshDirectory,
  onSelectFile,
  sessionList,
  activeSessionId,
  onLoadSession,
  onDeleteSession
}) => {
  const [showFiles, setShowFiles] = useState(false)
  const dirName = currentDir ? currentDir.split(/[/\\]/).pop() || currentDir : 'No Directory'

  // Group sessions: Today, Yesterday, Previous 7 Days, Older
  const groupSessions = (): Record<string, ChatSessionMeta[]> => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const lastWeek = new Date(today.getTime() - 7 * 86400000)

    const groups: Record<string, ChatSessionMeta[]> = {}

    for (const s of sessionList) {
      const d = new Date(s.updatedAt)
      let group: string
      if (d >= today) {
        group = 'Today'
      } else if (d >= yesterday) {
        group = 'Yesterday'
      } else if (d >= lastWeek) {
        group = 'Previous 7 Days'
      } else {
        group = 'Older'
      }
      if (!groups[group]) groups[group] = []
      groups[group].push(s)
    }

    return groups
  }

  const grouped = groupSessions()
  const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older']

  return (
    <div className="w-64 h-full bg-[#18181b] border-r border-zinc-800/80 flex flex-col justify-between select-none text-zinc-300">
      {/* Top Menu Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Navigation Tabs */}
        <div className="p-3 space-y-1">
          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-[#27272a] hover:bg-zinc-700/80 text-zinc-100 rounded-xl font-medium text-xs transition-colors shadow-sm mb-3"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>New chat</span>
          </button>

          <div
            onClick={onNewChat}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#27272a]/60 text-zinc-100 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Home className="w-4 h-4 text-zinc-300" />
            <span>Home</span>
          </div>
        </div>

        {/* Working Directory Explorer */}
        <div className="px-3 py-2 border-t border-b border-zinc-800/60 bg-zinc-900/30">
          <div
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer mb-1"
          >
            <div className="flex items-center space-x-1.5">
              {showFiles ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="uppercase tracking-wider text-[10px]">Workspace Folder</span>
            </div>
            {currentDir && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRefreshDirectory()
                }}
                className="text-zinc-500 hover:text-purple-400 p-0.5 rounded"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={onSelectDirectory}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-800/60 hover:bg-purple-950/40 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 transition-all group"
          >
            <div className="flex items-center space-x-2 truncate">
              <FolderPlus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate font-mono text-[11px]">{dirName}</span>
            </div>
            <span className="text-[10px] text-zinc-400 group-hover:text-purple-300">Open</span>
          </button>

          {showFiles && currentDir && (
            <div className="mt-2 max-h-40 overflow-y-auto border-t border-zinc-800/60 pt-1">
              <FileTree nodes={fileTree} onSelectFile={onSelectFile} />
            </div>
          )}
        </div>

        {/* Chat Sessions List (persistent, grouped by time) */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {sessionList.length === 0 ? (
            <div className="text-[11px] text-zinc-600 px-2 py-4 text-center">
              No chat history yet
            </div>
          ) : (
            groupOrder.map((groupName) => {
              const sessions = grouped[groupName]
              if (!sessions || sessions.length === 0) return null

              return (
                <div key={groupName}>
                  <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-2 py-1">
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => onLoadSession(session.id)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          activeSessionId === session.id
                            ? 'bg-purple-950/40 text-purple-200 border border-purple-800/30'
                            : 'hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(session.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-0.5 rounded transition-opacity shrink-0"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
