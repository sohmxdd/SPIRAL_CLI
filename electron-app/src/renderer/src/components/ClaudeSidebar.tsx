import React, { useState } from 'react'
import { FileNode } from '../types'
import { FileTree } from './FileTree'
import {
  Plus,
  Home,
  Code2,
  FolderKanban,
  SlidersHorizontal,
  FolderPlus,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  ChevronDown
} from 'lucide-react'

interface ClaudeSidebarProps {
  currentDir: string | null
  fileTree: FileNode[]
  onNewChat: () => void
  onSelectDirectory: () => void
  onRefreshDirectory: () => void
  onSelectFile?: (file: FileNode) => void
  recentChats?: string[]
}

export const ClaudeSidebar: React.FC<ClaudeSidebarProps> = ({
  currentDir,
  fileTree,
  onNewChat,
  onSelectDirectory,
  onRefreshDirectory,
  onSelectFile,
  recentChats = [
    'Building an Electron JS project for Auto...',
    'Project review and improvement suggestions',
    'SPIRAL AI agent evaluation platform',
    'Coding agent prompt routing',
    'Dark theme palette design'
  ]
}) => {
  const [showFiles, setShowFiles] = useState(false)
  const dirName = currentDir ? currentDir.split(/[/\\]/).pop() || currentDir : 'No Directory'

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

          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#27272a]/60 text-zinc-100 rounded-lg text-xs font-medium">
            <Home className="w-4 h-4 text-zinc-300" />
            <span>Home</span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors cursor-pointer">
            <Code2 className="w-4 h-4" />
            <span>Code</span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors cursor-pointer">
            <FolderKanban className="w-4 h-4" />
            <span>Projects</span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors cursor-pointer">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Customize</span>
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

        {/* Recents List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-2 py-1">
            Recents
          </div>
          {recentChats.map((chat, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-zinc-800/60 rounded-lg text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer transition-colors truncate"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{chat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-zinc-800/80 bg-[#141416]">
        <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-zinc-800/60 rounded-xl cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300 font-semibold text-xs">
            S
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-200 truncate">Soham</div>
            <div className="text-[10px] text-zinc-500">Pro Plan</div>
          </div>
        </div>
      </div>
    </div>
  )
}
