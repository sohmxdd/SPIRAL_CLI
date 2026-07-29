import React, { useState, useRef, KeyboardEvent } from 'react'
import { Plus, ArrowUp, Square, ChevronDown } from 'lucide-react'

interface ClaudeInputProps {
  onSendMessage: (message: string) => void
  onStopAgent: () => void
  isAgentRunning: boolean
  currentDir: string | null
  centered?: boolean
}

export const ClaudeInput: React.FC<ClaudeInputProps> = ({
  onSendMessage,
  onStopAgent,
  isAgentRunning,
  currentDir,
  centered = false
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }

  return (
    <div className={`w-full ${centered ? 'max-w-2xl mx-auto' : 'max-w-3xl mx-auto px-4 py-3'}`}>
      <div className="bg-[#242427] border border-zinc-700/60 rounded-3xl p-3.5 shadow-2xl focus-within:border-purple-500/60 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          rows={centered ? 2 : 1}
          className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-sm px-2 pt-1 focus:outline-none resize-none max-h-40 min-h-[42px]"
        />

        <div className="flex items-center justify-between pt-2 px-1">
          {/* Plus Attach Button */}
          <button
            onClick={handleAttachFile}
            title="Attach file (/read <path>)"
            type="button"
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Model Pill + Send Button */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 rounded-full text-xs cursor-pointer border border-zinc-700/40">
              <span className="font-medium">Groq Llama 3.3</span>
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
