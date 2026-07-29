import React from 'react'

export const WelcomeScreen: React.FC = () => {
  const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour >= 21 || hour < 5) return 'Hello, night owl'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4 text-center select-none">
      <div className="flex items-center justify-center space-x-3 mb-6">
        <span className="text-3xl sm:text-4xl text-amber-500 font-serif">✳</span>
        <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-zinc-100 font-normal">
          {getGreeting()}
        </h1>
      </div>
    </div>
  )
}
