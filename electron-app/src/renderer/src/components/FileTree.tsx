import React, { useState } from 'react'
import { FileNode } from '../types'
import { Folder, FolderOpen, FileText, FileCode, ChevronRight, ChevronDown } from 'lucide-react'

interface FileTreeProps {
  nodes: FileNode[]
  onSelectFile?: (file: FileNode) => void
  level?: number
}

const FileItem: React.FC<{ node: FileNode; onSelectFile?: (file: FileNode) => void; level: number }> = ({
  node,
  onSelectFile,
  level
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const isCode = /\.(py|ts|tsx|js|jsx|json|html|css|md|bat|sh)$/i.test(node.name)

  const handleToggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (node.isDirectory) {
      setIsOpen(!isOpen)
    } else {
      if (onSelectFile) onSelectFile(node)
    }
  }

  return (
    <div className="select-none">
      <div
        onClick={handleToggle}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        className="flex items-center py-1 px-2 text-xs text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100 rounded cursor-pointer transition-colors group"
      >
        {node.isDirectory ? (
          <span className="mr-1.5 text-zinc-400 group-hover:text-zinc-200">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />}
          </span>
        ) : (
          <span className="w-3.5 mr-1.5" />
        )}

        {node.isDirectory ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 text-purple-400 mr-2 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-purple-400/80 mr-2 shrink-0" />
          )
        ) : isCode ? (
          <FileCode className="w-4 h-4 text-purple-300/80 mr-2 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
        )}

        <span className="truncate">{node.name}</span>
      </div>

      {node.isDirectory && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileItem key={child.path} node={child} onSelectFile={onSelectFile} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, onSelectFile, level = 0 }) => {
  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-zinc-500 p-3 italic">No files found</div>
  }

  return (
    <div className="space-y-0.5 py-1">
      {nodes.map((node) => (
        <FileItem key={node.path} node={node} onSelectFile={onSelectFile} level={level} />
      ))}
    </div>
  )
}
