import React, { useState, useRef, KeyboardEvent } from 'react'
import { Plus, ArrowUp, Square, ChevronDown, Terminal, Cpu } from 'lucide-react'

interface ClaudeInputProps {
  onSendMessage: (message: string) => void
  onStopAgent: () => void
  isAgentRunning: boolean
  currentDir: string | null
  centered?: boolean
}

const SLASH_COMMANDS = [
  { cmd: '/help', desc: 'Show all SPIRAL agent commands' },
  { cmd: '/status', desc: 'Display session status & token usage' },
  { cmd: '/reset', desc: 'Reset memory & agent loop state' },
  { cmd: '/files', desc: 'List files in workspace' },
  { cmd: '/model', desc: 'Display current Groq LLM model' },
  { cmd: '/clear', desc: 'Clear terminal viewport' }
]

export const ClaudeInput: React.FC<ClaudeInputProps> = ({
  onSendMessage,
  onStopAgent,
  isAgentRunning,
  currentDir,
  centered = false
}) => {
  const [text, setText] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setText('')
    setShowSlashMenu(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachFile = async (): Promise<void> => {
    try {
      const selectedFile = await window.api.selectFile()
      if (selectedFile) {
        let displayPath = selectedFile
        if (currentDir && selectedFile.startsWith(currentDir)) {
          displayPath = selectedFile.slice(currentDir.length).replace(/^[/\\]/, '')
        }
        const insertText = `/read ${displayPath}`
        setText((prev) => (prev ? `${prev}\n${insertText}` : insertText))
        textareaRef.current?.focus()
      }
    } catch (err) {
      console.error('Error selecting file:', err)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value
    setText(val)

    if (val.startsWith('/')) {
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }

  const insertCommand = (cmd: string): void => {
    setText(cmd)
    setShowSlashMenu(false)
    textareaRef.current?.focus()
  }

  return (
    <div className={`w-full ${centered ? 'max-w-2xl mx-auto' : 'max-w-3xl mx-auto px-4 py-3'}`}>
      <div className="relative bg-[#242427] border border-zinc-700/60 rounded-3xl p-3.5 shadow-2xl focus-within:border-purple-500/60 transition-all">
        {/* Slash Command Suggestions Menu */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1b1b1e] border border-zinc-700/80 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
              <Terminal className="w-3 h-3" />
              <span>SPIRAL Commands & Tools</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {SLASH_COMMANDS.map((item) => (
                <div
                  key={item.cmd}
                  onClick={() => insertCommand(item.cmd)}
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-purple-950/40 hover:text-purple-300 rounded-xl cursor-pointer transition-colors text-xs"
                >
                  <span className="font-mono font-semibold text-purple-300">{item.cmd}</span>
                  <span className="text-[10px] text-zinc-400 truncate max-w-[140px]">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today? Type / for slash commands or attach files..."
          rows={centered ? 2 : 1}
          className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-sm px-2 pt-1 focus:outline-none resize-none max-h-40 min-h-[42px]"
        />

        {/* Bottom Bar Controls */}
        <div className="flex items-center justify-between pt-2 px-1 border-t border-zinc-800/60 mt-1">
          {/* Plus Attach & Slash Command Quick Chips */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleAttachFile}
              title="Attach file (/read <path>)"
              type="button"
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Slash Command Quick Chips */}
            <div className="hidden sm:flex items-center space-x-1">
              {['/help', '/status', '/files'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => insertCommand(cmd)}
                  type="button"
                  className="px-2 py-0.5 bg-zinc-800/60 hover:bg-purple-900/40 text-zinc-400 hover:text-purple-300 border border-zinc-700/40 rounded-full text-[11px] font-mono transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Model Pill + Send Button */}
          <div className="flex items-center space-x-2">
            <div
              onClick={() => insertCommand('/model')}
              title="Current LLM Model (Click to insert /model)"
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 rounded-full text-xs cursor-pointer border border-zinc-700/40 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium text-[11px]">Groq Llama 3.3 70B</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </div>

            {isAgentRunning ? (
              <button
                onClick={onStopAgent}
                title="Stop process"
                className="w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                title="Send Message"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  text.trim()
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
