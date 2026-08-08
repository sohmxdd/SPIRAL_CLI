import React from 'react'
import { Sparkles, Code2, TestTube2, BookOpen } from 'lucide-react'

interface WelcomeScreenProps {
  currentDir?: string | null
  onSelectDirectory?: () => void
  onSendPrompt?: (prompt: string) => void
}

const QUICK_PROMPTS = [
  {
    icon: BookOpen,
    label: 'Explain algorithm',
    prompt: 'explain binary search algorithm with an example'
  },
  {
    icon: Code2,
    label: 'Code review',
    prompt: '/skill:code-review review target code quality and performance'
  },
  {
    icon: TestTube2,
    label: 'Unit testing',
    prompt: '/skill:unit-test generate comprehensive unit tests with edge cases'
  }
]

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentDir,
  onSelectDirectory,
  onSendPrompt
}) => {
  const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour >= 21 || hour < 5) return 'Hello, night owl'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center select-none space-y-4">
      <div className="flex items-center justify-center space-x-3">
        <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
        <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-zinc-100 font-normal">
          {getGreeting()}
        </h1>
      </div>

      {!currentDir && onSelectDirectory && (
        <button
          onClick={onSelectDirectory}
          className="text-xs text-zinc-500 hover:text-purple-300 transition-colors bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-800"
        >
          Select a workspace directory to begin execution
        </button>
      )}

      {/* Quick Prompt Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {QUICK_PROMPTS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={() => onSendPrompt && onSendPrompt(item.prompt)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-[#242427] hover:bg-purple-950/40 border border-zinc-700/60 hover:border-purple-600/50 rounded-xl text-xs text-zinc-300 hover:text-purple-200 transition-all shadow-sm group"
            >
              <Icon className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
