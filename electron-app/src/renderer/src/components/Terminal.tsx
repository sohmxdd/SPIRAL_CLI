import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Trash2 } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  className?: string
}

export const Terminal: React.FC<TerminalProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const handleClear = (): void => {
    if (xtermRef.current) {
      xtermRef.current.clear()
      xtermRef.current.writeln('\x1b[38;2;113;113;122m[Terminal output cleared]\x1b[0m\r\n')
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#18181b',
        foreground: '#f4f4f5',
        cursor: '#a855f7',
        cursorAccent: '#18181b',
        selectionBackground: '#581c87',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      convertEol: true,
      rows: 30
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)

    const safeFit = (): void => {
      try {
        if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddon.fit()
        }
      } catch {
        // ignore
      }
    }

    safeFit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Initial banner inside xterm
    term.writeln('\x1b[38;2;168;85;247m===============================================\x1b[0m')
    term.writeln('\x1b[38;2;192;132;252m  SPIRAL CLI Agent Terminal Instance Ready\x1b[0m')
    term.writeln('\x1b[38;2;113;113;122m  Select a directory or type a command to start.\x1b[0m')
    term.writeln('\x1b[38;2;168;85;247m===============================================\x1b[0m\r\n')

    // Stream IPC stdout & stderr
    const unbindStdout = window.api.onAgentStdout((data: string) => {
      term.write(data)
    })

    const unbindStderr = window.api.onAgentStderr((data: string) => {
      term.write(`\x1b[31m${data}\x1b[0m`)
    })

    const unbindExit = window.api.onAgentExit((code: number | null) => {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`)
    })

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      safeFit()
    })

    resizeObserver.observe(containerRef.current)
    window.addEventListener('resize', safeFit)

    return () => {
      unbindStdout()
      unbindStderr()
      unbindExit()
      window.removeEventListener('resize', safeFit)
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [])

  return (
    <div className={`relative h-full w-full bg-[#18181b] p-2 overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between pb-1 px-1 text-[11px] text-zinc-500 font-mono select-none border-b border-zinc-800/60 mb-2">
        <span>Console Buffer</span>
        <button
          onClick={handleClear}
          className="flex items-center space-x-1 hover:text-zinc-300 transition-colors py-0.5 px-1.5 rounded hover:bg-zinc-800"
          title="Clear Terminal Output"
        >
          <Trash2 className="w-3 h-3 text-zinc-400" />
          <span>Clear</span>
        </button>
      </div>
      <div ref={containerRef} className="flex-1 w-full h-full min-h-0" />
    </div>
  )
}
