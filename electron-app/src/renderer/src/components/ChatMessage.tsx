import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Bot, User, Terminal, ChevronDown, ChevronRight } from 'lucide-react'

export interface Message {
  id: string
  sender: 'user' | 'assistant'
  content: string
  rawLogs?: string
  isStreaming?: boolean
  timestamp: Date
}

// Filter output stream to remove CLI noise, thinking/status lines, ASCII banners, and prompt borders.
// Thinking/planning lines are now rendered by the AgentPlanning UI component — they must NOT leak into chat bubbles.
export function filterStreamContent(raw: string): { cleanText: string; cleanLogs: string } {
  // Strip ANSI escape sequences first
  const noAnsi = raw.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
  const lines = noAnsi.split(/\r?\n/)

  const textLines: string[] = []
  const logLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines at the start (they accumulate from filtered blocks)
    if (!trimmed && textLines.length === 0) continue

    // 1. Filter out ASCII Banner & Startup Info
    if (
      trimmed.includes('████') ||
      trimmed.includes('Autonomous Coding Agent') ||
      trimmed.includes('Powered by Groq') ||
      trimmed.includes('Guided by Nyx') ||
      trimmed.includes('Welcome back!') ||
      trimmed.includes('Tips for getting started') ||
      trimmed.includes('Type a task to enter Agent Mode') ||
      trimmed.includes('Ask a question for Chat Mode') ||
      trimmed.includes('Type /help for all commands') ||
      trimmed.includes('SPIRAL Commands') ||
      trimmed.includes('Recent activity') ||
      trimmed.includes('Groq connected') ||
      (trimmed.includes('Model') && trimmed.includes('llama')) ||
      trimmed.includes('Working Dir') ||
      trimmed.includes('Token Budget') ||
      (trimmed.includes('Context') && trimmed.includes('files')) ||
      trimmed.includes('System nominal') ||
      trimmed.includes('files online') ||
      trimmed.includes('Ready to assist')
    ) {
      continue
    }

    // 2. Filter out Terminal Prompt Box borders & input prompts
    if (
      trimmed.startsWith('╭─') ||
      trimmed.startsWith('╰─') ||
      trimmed.startsWith('╭──') ||
      trimmed.startsWith('╰──') ||
      trimmed.includes('(spiral) ➤') ||
      trimmed.includes('(spiral) >') ||
      trimmed === '│' ||
      trimmed.startsWith('│ (spiral)') ||
      trimmed.startsWith('━━━') ||
      trimmed.startsWith('───')
    ) {
      continue
    }

    // 3. COMPLETELY FILTER all thinking/planning/status noise (now handled by AgentPlanning UI)
    if (
      trimmed.startsWith('Analyzing intent') ||
      trimmed.startsWith('Thinking') ||
      trimmed === 'Thinking...' ||
      trimmed.startsWith('[Nyx') ||
      trimmed.startsWith('[CHAT]') ||
      trimmed.startsWith('[AGENT]') ||
      trimmed.startsWith('[INTENT]') ||
      trimmed.startsWith('[PLAN]') ||
      trimmed.startsWith('[STEP]') ||
      trimmed.startsWith('[DEBUG]') ||
      trimmed.startsWith('[VERIFY]') ||
      trimmed.startsWith('[TEST]') ||
      trimmed.startsWith('[REFLECT]') ||
      trimmed.startsWith('nyx.') ||
      trimmed.startsWith('Step ') && /Step \d+\/\d+/.test(trimmed) ||
      trimmed.includes('Generating plan') ||
      trimmed.includes('Task complete') ||
      trimmed.includes('intent_detected') ||
      trimmed.includes('error_detected') ||
      trimmed.includes('step_start') ||
      trimmed.includes('PlannerAgent') ||
      trimmed.includes('CoderAgent') ||
      trimmed.includes('TesterAgent') ||
      trimmed.includes('VerifierAgent') ||
      trimmed.includes('DebuggerAgent') ||
      trimmed.includes('ReflectorAgent')
    ) {
      logLines.push(trimmed)
      continue
    }

    // 4. Genuine assistant response line
    textLines.push(line)
  }

  const cleanText = textLines.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')
  const cleanLogs = logLines.join('\n')

  return { cleanText, cleanLogs }
}

const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-zinc-800 bg-[#141416] shadow-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#1b1b1e] border-b border-zinc-800/80 text-xs text-zinc-400 font-mono select-none">
        <span className="text-zinc-300 font-medium">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-purple-300 transition-colors text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed bg-[#141416]">
        <code>{value}</code>
      </pre>
    </div>
  )
}

export const ChatMessageItem: React.FC<{ message: Message }> = ({ message }) => {
  const [showLogs, setShowLogs] = useState(false)
  const isUser = message.sender === 'user'

  const { cleanText, cleanLogs } = isUser
    ? { cleanText: message.content, cleanLogs: '' }
    : filterStreamContent(message.content)

  const rawLogs = message.rawLogs || cleanLogs

  return (
    <div className={`py-4 px-4 sm:px-8 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl flex space-x-3 w-full ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isUser
              ? 'bg-zinc-700 text-zinc-200'
              : 'bg-purple-600/20 border border-purple-500/40 text-purple-400'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Content Box */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-zinc-300">
              {isUser ? 'You' : 'SPIRAL Agent'}
            </span>
            <span className="text-[10px] text-zinc-500">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Message Body */}
          <div
            className={`text-sm text-zinc-200 leading-relaxed ${
              isUser ? 'bg-[#27272a] py-2.5 px-4 rounded-2xl inline-block max-w-full float-right' : ''
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{cleanText}</p>
            ) : cleanText ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline ? (
                      <CodeBlock
                        language={match ? match[1] : ''}
                        value={String(children).replace(/\n$/, '')}
                      />
                    ) : (
                      <code className="bg-zinc-800/80 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p className="mb-2 leading-relaxed text-zinc-200">{children}</p>
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-5 mb-2 space-y-1 text-zinc-200">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-5 mb-2 space-y-1 text-zinc-200">{children}</ol>
                  },
                  h1({ children }) {
                    return <h1 className="text-lg font-bold text-zinc-100 mt-3 mb-1">{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 className="text-base font-semibold text-zinc-100 mt-2 mb-1">{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 className="text-sm font-semibold text-zinc-200 mt-2 mb-1">{children}</h3>
                  }
                }}
              >
                {cleanText}
              </ReactMarkdown>
            ) : (
              !message.isStreaming && <p className="italic text-zinc-500 text-xs">Response completed.</p>
            )}
          </div>

          {/* Collapsible Execution Logs for Assistant */}
          {!isUser && rawLogs && (
            <div className="mt-2 clear-both">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center space-x-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Execution Steps & Logs</span>
                {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              {showLogs && (
                <div className="mt-1.5 p-3 bg-[#141416] border border-zinc-800/80 rounded-xl text-xs font-mono text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {rawLogs}
                </div>
              )}
            </div>
          )}

          {message.isStreaming && (
            <div className="flex items-center space-x-1.5 text-xs text-purple-400 py-1 clear-both">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              <span className="italic">SPIRAL is thinking & coding...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
