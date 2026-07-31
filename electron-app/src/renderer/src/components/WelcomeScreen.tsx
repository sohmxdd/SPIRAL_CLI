import React from 'react'

interface WelcomeScreenProps {
  currentDir?: string | null
  onSelectDirectory?: () => void
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ currentDir, onSelectDirectory }) => {
  const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour >= 21 || hour < 5) return 'Hello, night owl'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center select-none space-y-3">
      <div className="flex items-center justify-center space-x-3">
        <span className="text-3xl sm:text-4xl text-purple-400 font-serif">✳</span>
        <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-zinc-100 font-normal">
          {getGreeting()}
        </h1>
      </div>

      {!currentDir && onSelectDirectory && (
        <button
          onClick={onSelectDirectory}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Select a workspace directory to begin execution
        </button>
      )}
    </div>
  )
}
