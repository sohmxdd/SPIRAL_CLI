import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/atom-one-dark.css'
import { Copy, Check, Bot, User, Terminal, ChevronDown, ChevronRight } from 'lucide-react'
import { AgentPlanning } from './ui/agent-planning'
import { ParsedPlanState } from '../types'

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

    // ── Banner / Startup Info / Status Lines ──
    if (
      trimmed.includes('████') ||
      trimmed.includes('___') ||
      trimmed.includes('___|') ||
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
      trimmed.includes('Testing Groq connection') ||
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
      logLines.push(trimmed)
      continue
    }

    // ── Prompt box borders & ASCII box drawing characters ──
    if (
      trimmed.startsWith('╭') ||
      trimmed.startsWith('╰') ||
      trimmed.includes('(spiral) ➤') ||
      trimmed.includes('(spiral) >') ||
      trimmed === '│' ||
      trimmed.startsWith('│ (spiral)') ||
      trimmed.startsWith('━') ||
      trimmed.startsWith('───') ||
      trimmed.startsWith('---') ||
      trimmed.includes('┌') ||
      trimmed.includes('└') ||
      trimmed.includes('┐') ||
      trimmed.includes('┘') ||
      trimmed.includes('├') ||
      trimmed.includes('┤') ||
      trimmed.includes('┬') ||
      trimmed.includes('┴') ||
      trimmed.includes('┼') ||
      trimmed.includes('═')
    ) {
      logLines.push(trimmed)
      continue
    }

    // ── Thinking / Planning / Status noise / File execution logs (ALL variants) ──
    if (
      trimmed.startsWith('Analyzing intent') ||
      trimmed.startsWith('Analyzing') ||
      trimmed.includes('Thinking...') ||
      trimmed.startsWith('Thinking') ||
      trimmed.startsWith('Testing') ||
      trimmed.startsWith('Planning') ||
      trimmed.startsWith('Writing code') ||
      trimmed.startsWith('Running tests') ||
      trimmed.startsWith('Verifying') ||
      trimmed.startsWith('Final verification') ||
      trimmed.startsWith('Debug attempt') ||
      trimmed.startsWith('Re-running') ||
      trimmed.startsWith('!') ||
      trimmed.startsWith('→') ||
      trimmed.startsWith('||') ||
      trimmed.includes('Written:') ||
      trimmed.includes('[FILE_OK]') ||
      trimmed.includes('[FILE_ERR]') ||
      trimmed.includes('[FILE_READ]') ||
      trimmed.includes('[FILE_WRITE]') ||
      trimmed.includes('[write_file]') ||
      trimmed.includes('[modify_file]') ||
      trimmed.includes('[execute]') ||
      /^\[\d+\/\d+\]/.test(trimmed) ||
      (trimmed.startsWith('Executing') && trimmed.includes('...')) ||
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
      trimmed.startsWith('✓') ||
      trimmed.startsWith('X') ||
      trimmed.startsWith('✗') ||
      (/^[^\w\s"'`({\[]/.test(trimmed) && trimmed.length < 50 && trimmed.includes('...'))
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
// Code Block: Premium Claude-style dark code block with syntax highlighting & line numbers
// ──────────────────────────────────────────────────────────────
const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Pre-process pipe-formatted single line code snippets into multiline code if needed
  let displayValue = value
  if (value.includes(' | ') && (value.includes('def ') || value.includes('function ') || value.includes('const '))) {
    displayValue = value.replace(/ \| /g, '\n')
  }

  const lines = displayValue.split('\n')

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-zinc-800/90 bg-[#121215] shadow-2xl">
      {/* Header bar with language + copy */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1e] border-b border-zinc-800/80 text-xs font-mono select-none">
        <span className="text-purple-300 font-semibold text-[11px] uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px] bg-zinc-800/60 hover:bg-zinc-700/80 px-2.5 py-1 rounded-lg border border-zinc-700/50"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with line numbers */}
      <div className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-zinc-200">
        <div className="table w-full border-collapse">
          {lines.map((line, lineIdx) => {
            const tokens: React.ReactNode[] = []
            let remaining = line

            const commentMatch = remaining.match(/(\/\/.*|#.*)/)
            let commentText = ''
            if (commentMatch && commentMatch.index !== undefined) {
              commentText = commentMatch[0]
              remaining = line.slice(0, commentMatch.index)
            }

            const tokenRegex =
              /(".*?"|'.*?'|`.*?`|\b(?:const|let|var|function|return|import|export|from|def|class|if|else|elif|while|for|in|try|except|async|await|with|as|break|continue|yield|pass|True|False|None|true|false|null|undefined)\b|\b\d+\b|\b[a-zA-Z_]\w*(?=\s*\())/g

            let lastIdx = 0
            let match: RegExpExecArray | null

            while ((match = tokenRegex.exec(remaining)) !== null) {
              const matchStr = match[0]
              const matchIdx = match.index

              if (matchIdx > lastIdx) {
                tokens.push(remaining.slice(lastIdx, matchIdx))
              }

              if (/^["'`]/.test(matchStr)) {
                tokens.push(
                  <span key={`${lineIdx}-${matchIdx}`} className="text-emerald-300">
                    {matchStr}
                  </span>
                )
              } else if (
                /^(const|let|var|function|return|import|export|from|def|class|if|else|elif|while|for|in|try|except|async|await|with|as|break|continue|yield|pass|True|False|None|true|false|null|undefined)$/.test(
                  matchStr
                )
              ) {
                tokens.push(
                  <span key={`${lineIdx}-${matchIdx}`} className="text-purple-400 font-semibold">
                    {matchStr}
                  </span>
                )
              } else if (/^\d+$/.test(matchStr)) {
                tokens.push(
                  <span key={`${lineIdx}-${matchIdx}`} className="text-amber-400">
                    {matchStr}
                  </span>
                )
              } else {
                tokens.push(
                  <span key={`${lineIdx}-${matchIdx}`} className="text-blue-400">
                    {matchStr}
                  </span>
                )
              }

              lastIdx = matchIdx + matchStr.length
            }

            if (lastIdx < remaining.length) {
              tokens.push(remaining.slice(lastIdx))
            }

            if (commentText) {
              tokens.push(
                <span key={`${lineIdx}-comment`} className="text-zinc-500 italic">
                  {commentText}
                </span>
              )
            }

            return (
              <div key={lineIdx} className="table-row">
                <span className="table-cell select-none text-right pr-4 text-zinc-600 text-[11px] font-mono w-8">
                  {lineIdx + 1}
                </span>
                <span className="table-cell whitespace-pre">{tokens}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ChatMessageItem: renders user or assistant message with markdown
// ──────────────────────────────────────────────────────────────
export const ChatMessageItem: React.FC<{
  message: Message
  planPhase?: 'idle' | 'active' | 'complete' | 'error'
  planState?: ParsedPlanState | null
}> = ({ message, planPhase, planState }) => {
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
        <div className={`flex-1 space-y-1.5 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Header info */}
          <div className={`flex items-center space-x-2 text-xs ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <span className="font-semibold text-zinc-300">
              {isUser ? 'You' : 'SPIRAL Agent'}
            </span>
            <span className="text-[10px] text-zinc-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Integrated Thought Process / AgentPlanning Block */}
          {!isUser && planState && planState.steps.length > 0 && (
            <div className="w-full my-1">
              <AgentPlanning
                title={planState.title}
                currentPhase={planState.currentPhase}
                activeSkill={planState.activeSkill}
                steps={planState.steps}
              />
            </div>
          )}

          {/* Message Content */}
          <div
            className={`text-sm text-zinc-200 leading-relaxed max-w-none break-words ${
              isUser
                ? 'bg-[#27272a] p-3.5 rounded-2xl rounded-tr-none max-w-[85%]'
                : 'w-full'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : cleanText ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    return <>{children}</>
                  },
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const contentStr = String(children).replace(/\n$/, '')
                    const isMultiLine = contentStr.includes('\n') || contentStr.includes(' | ')

                    if (!inline || match || isMultiLine) {
                      return (
                        <CodeBlock
                          language={match ? match[1] : undefined}
                          value={contentStr}
                          {...props}
                        />
                      )
                    }

                    return (
                      <code className="bg-zinc-800/80 text-purple-300 font-mono text-[13px] px-1.5 py-0.5 rounded border border-zinc-700/50" {...props}>
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
