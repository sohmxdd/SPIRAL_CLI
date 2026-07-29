import React, { useState, useRef, KeyboardEvent } from 'react'
import { Paperclip, ArrowUp, Square } from 'lucide-react'

interface InputBarProps {
  onSendMessage: (message: string) => void
  onStopAgent: () => void
  isAgentRunning: boolean
  currentDir: string | null
}

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  onStopAgent,
  isAgentRunning,
  currentDir
}) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setText('')
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
    setText(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  return (
    <div className="p-3 bg-[#18181b] border-t border-zinc-800/80">
      <div className="max-w-4xl mx-auto relative bg-[#1f1f23] border border-zinc-700/60 rounded-2xl p-2 shadow-lg focus-within:border-purple-500/60 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask SPIRAL a question or give it a coding task..."
          rows={1}
          className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-xs px-2 pt-1 pb-2 focus:outline-none resize-none max-h-32 min-h-[36px]"
        />

        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 px-1">
          <div className="flex items-center space-x-1">
            <button
              onClick={handleAttachFile}
              title="Attach File (/read <path>)"
              type="button"
              className="flex items-center space-x-1 px-2 py-1 text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 rounded-lg text-xs transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Attach file</span>
            </button>

            <button
              onClick={() => setText((prev) => (prev ? `${prev} /status` : '/status'))}
              title="Insert /status command"
              type="button"
              className="px-2 py-1 text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 rounded-lg text-[11px] font-mono transition-colors"
            >
              /status
            </button>
            <button
              onClick={() => setText((prev) => (prev ? `${prev} /help` : '/help'))}
              title="Insert /help command"
              type="button"
              className="px-2 py-1 text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 rounded-lg text-[11px] font-mono transition-colors"
            >
              /help
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {isAgentRunning ? (
              <button
                onClick={onStopAgent}
                title="Stop Agent Process"
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                title="Send Task to Agent"
                className={`p-1.5 rounded-xl text-white transition-all ${
                  text.trim()
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/30'
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
