import React from 'react'
import { Terminal } from './components/Terminal'

export default function App(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen bg-[#18181b] text-zinc-100 overflow-hidden">
      <div className="flex-1 h-full">
        <Terminal />
      </div>
    </div>
  )
}
