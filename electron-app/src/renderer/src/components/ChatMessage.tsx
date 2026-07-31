import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/atom-one-dark.css'
import { Copy, Check, Bot, User, Terminal, ChevronDown, ChevronRight } from 'lucide-react'

export interface Message {
  id: string
  sender: 'user' | 'assistant'
  content: string
  rawLogs?: string
  isStreaming?: boolean
  timestamp: Date
}

// ──────────────────────────────────────────────────────────────
// Filter output stream: strips CLI banners, ANSI, thinking/status noise, prompt borders.
// Everything status-related is handled by AgentPlanning UI — must NOT leak into chat bubbles.
// ──────────────────────────────────────────────────────────────
export function filterStreamContent(raw: string): { cleanText: string; cleanLogs: string } {
  // 1. Strip ANSI escape sequences
  const noAnsi = raw.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  )

  // 2. Strip remaining Unicode Braille spinner characters (⣿ ⣾ ⣷ ⣯ etc.)
  const noSpinners = noAnsi.replace(/[\u2800-\u28FF]/g, '')

  const lines = noSpinners.split(/\r?\n/)

  const textLines: string[] = []
  const logLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines at the start
    if (!trimmed && textLines.length === 0) continue

    // ── Banner / Startup Info ──
    if (
      trimmed.includes('████') ||
      trimmed.includes('Autonomous Coding Agent') ||
      trimmed.includes('Powered by Groq') ||
      trimmed.includes('Guided by Nyx') ||
      trimmed.includes('Welcome back') ||
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
      trimmed.includes('Ready to assist') ||
      trimmed.includes('Session started') ||
      trimmed.includes('session_id')
    ) {
      continue
    }

    // ── Prompt box borders & input prompts ──
    if (
      trimmed.startsWith('╭') ||
      trimmed.startsWith('╰') ||
      trimmed.includes('(spiral) ➤') ||
      trimmed.includes('(spiral) >') ||
      trimmed === '│' ||
      trimmed.startsWith('│ (spiral)') ||
      trimmed.startsWith('━') ||
      trimmed.startsWith('───') ||
      trimmed.startsWith('---') && trimmed === '---'
    ) {
      continue
    }

    // ── Thinking / Planning / Status noise (ALL variants) ──
    // After stripping Braille spinners, "⣿ Thinking..." becomes "Thinking..."
    if (
      trimmed.startsWith('Analyzing intent') ||
      trimmed.startsWith('Analyzing') ||
      trimmed.includes('Thinking...') ||
      trimmed.startsWith('Thinking') ||
      trimmed.startsWith('Planning') ||
      trimmed.startsWith('Executing') && trimmed.includes('...') ||
      trimmed.startsWith('Generating plan') ||
      trimmed.startsWith('Reflecting') ||
      /^\[.*?(CHAT|AGENT|INTENT|PLAN|STEP|DEBUG|VERIFY|TEST|REFLECT|FILE|WRITE|READ|EXEC|Nyx).*?\]/.test(trimmed) ||
      trimmed.startsWith('nyx.') ||
      /^Step \d+\/\d+/.test(trimmed) ||
      trimmed.includes('Task complete') ||
      trimmed.includes('intent_detected') ||
      trimmed.includes('error_detected') ||
      trimmed.includes('step_start') ||
      trimmed.includes('PlannerAgent') ||
      trimmed.includes('CoderAgent') ||
      trimmed.includes('TesterAgent') ||
      trimmed.includes('VerifierAgent') ||
      trimmed.includes('DebuggerAgent') ||
      trimmed.includes('ReflectorAgent') ||
      trimmed.includes('ChatAgent') ||
      // Catch any remaining status emoji prefixed lines
      /^[^\w\s"'`({\[]/.test(trimmed) && trimmed.length < 40 && trimmed.includes('...')
    ) {
      logLines.push(trimmed)
      continue
    }

    // ── Genuine response line ──
    textLines.push(line)
  }

  const cleanText = textLines
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '')
  const cleanLogs = logLines.join('\n')

  return { cleanText, cleanLogs }
}

// ──────────────────────────────────────────────────────────────
// Code Block: Claude-style dark code block with language badge + copy button
// ──────────────────────────────────────────────────────────────
const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-zinc-800 bg-[#0d0d0f] shadow-lg">
      {/* Header bar with language + copy */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1e] border-b border-zinc-800/80 text-xs font-mono select-none">
        <span className="text-zinc-400 font-medium">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 hover:text-purple-300 transition-colors text-zinc-500 text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-4 text-[13px] font-mono text-zinc-200 overflow-x-auto leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ChatMessageItem: renders user or assistant message with markdown
// ──────────────────────────────────────────────────────────────
export const ChatMessageItem: React.FC<{
  message: Message
  planPhase?: 'idle' | 'active' | 'complete' | 'error'
}> = ({ message, planPhase }) => {
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

        {/* Message Bubble Container */}
        <div className="flex-1 space-y-1 min-w-0">
          {/* Header info */}
          <div className={`flex items-center space-x-2 text-xs ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <span className="font-semibold text-zinc-300">
              {isUser ? 'You' : 'SPIRAL Agent'}
            </span>
            <span className="text-[10px] text-zinc-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Message Content */}
          <div
            className={`text-sm text-zinc-200 leading-relaxed max-w-none break-words ${
              isUser
                ? 'bg-[#27272a] p-3.5 rounded-2xl rounded-tr-none inline-block max-w-[85%]'
                : 'w-full'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : cleanText ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <CodeBlock
                        language={match[1]}
                        value={String(children).replace(/\n$/, '')}
                        {...props}
                      />
                    ) : (
                      <code className="bg-zinc-800 text-purple-300 font-mono text-[13px] px-1.5 py-0.5 rounded" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
                  },
                  li({ children }) {
                    return <li className="leading-relaxed">{children}</li>
                  },
                  h1({ children }) {
                    return <h1 className="text-lg font-bold text-zinc-100 mb-2 mt-4">{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 className="text-base font-semibold text-zinc-100 mb-2 mt-3">{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 className="text-sm font-semibold text-zinc-200 mb-1 mt-2">{children}</h3>
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-2 border-purple-500/60 pl-3 py-1 my-2 italic text-zinc-400 bg-purple-950/20 rounded-r">
                        {children}
                      </blockquote>
                    )
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full divide-y divide-zinc-800 border border-zinc-800 rounded-lg text-xs">
                          {children}
                        </table>
                      </div>
                    )
                  },
                  th({ children }) {
                    return <th className="px-3 py-2 bg-zinc-800/60 font-semibold text-left text-zinc-300">{children}</th>
                  },
                  td({ children }) {
                    return <td className="px-3 py-2 border-t border-zinc-800/60 text-zinc-300">{children}</td>
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

  const [showLogs, setShowLogs] = useState(false)
  const isUser = message.sender === 'user'

  // Rest of ChatMessageItem component...
  // inside render:
  // ...
          {message.isStreaming && planPhase !== 'complete' && (
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
