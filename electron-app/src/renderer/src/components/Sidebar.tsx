import React from 'react'
import { FileNode } from '../../../preload/index'
import { FileTree } from './FileTree'
import { FolderPlus, RefreshCw, Terminal as TerminalIcon, Sparkles } from 'lucide-react'

interface SidebarProps {
  currentDir: string | null
  fileTree: FileNode[]
  onSelectDirectory: () => void
  onRefreshDirectory: () => void
  onSelectFile?: (file: FileNode) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentDir,
  fileTree,
  onSelectDirectory,
  onRefreshDirectory,
  onSelectFile
}) => {
  const dirName = currentDir ? currentDir.split(/[/\\]/).pop() || currentDir : 'No Directory'

  return (
    <div className="w-64 h-full bg-[#141416] border-r border-zinc-800/80 flex flex-col select-none">
      {/* Header / Brand */}
      <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider uppercase text-purple-300">SPIRAL GUI</h1>
            <p className="text-[10px] text-zinc-500">Autonomous Agent</p>
          </div>
        </div>
      </div>

      {/* Directory Selector Bar */}
      <div className="p-2 border-b border-zinc-800/60 bg-zinc-900/40">
        <div className="flex items-center justify-between text-xs mb-1.5 px-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Explorer</span>
          {currentDir && (
            <button
              onClick={onRefreshDirectory}
              title="Refresh directory"
              className="text-zinc-500 hover:text-purple-400 p-0.5 rounded transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={onSelectDirectory}
          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-800/60 hover:bg-purple-950/40 hover:border-purple-500/40 border border-zinc-700/50 rounded text-xs text-zinc-200 transition-all group"
        >
          <div className="flex items-center space-x-2 truncate">
            <FolderPlus className="w-4 h-4 text-purple-400 group-hover:scale-105 transition-transform shrink-0" />
            <span className="truncate font-mono text-[11px]">{dirName}</span>
          </div>
          <span className="text-[10px] bg-zinc-700/50 text-zinc-400 group-hover:bg-purple-800/40 group-hover:text-purple-300 px-1.5 py-0.5 rounded ml-1 shrink-0">
            Open
          </span>
        </button>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {currentDir ? (
          <FileTree nodes={fileTree} onSelectFile={onSelectFile} />
        ) : (
          <div className="p-4 text-center text-xs text-zinc-500 space-y-2 mt-8">
            <TerminalIcon className="w-8 h-8 text-zinc-600 mx-auto" />
            <p>Select a working folder to view files and route agent operations.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {currentDir && (
        <div className="p-2 border-t border-zinc-800/80 bg-zinc-950/40 text-[10px] text-zinc-500 truncate px-3 font-mono">
          {currentDir}
        </div>
      )}
    </div>
  )
}
