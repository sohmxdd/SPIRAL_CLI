import React, { useState, useEffect } from 'react'
import { Key, Bot, Save, Check, RefreshCw, Eye, EyeOff } from 'lucide-react'

interface SettingsViewProps {
  onClose: () => void
  onSettingsSaved: () => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose, onSettingsSaved }) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const DEFAULT_PROMPT = `You are Nyx, the AI guide of SPIRAL — an autonomous coding agent.

Personality:
- Calm, intelligent, slightly witty
- Speaks in concise, sharp sentences
- Uses technical language naturally
- Helpful but never over-explains
- You ARE the system — not a separate entity

When answering questions:
- Be direct and informative
- Include code snippets when relevant (use proper formatting)
- For coding questions, give working examples
- Keep answers focused — no fluff

When responding to casual input:
- Be brief and personable
- Stay in character as a system presence
- Light humor is welcome

Always respond as Nyx. Never break character.`

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async (): Promise<void> => {
    try {
      const key = await window.api.getGroqKey()
      const prompt = await window.api.getSystemPrompt()
      setApiKey(key || '')
      setSystemPrompt(prompt || DEFAULT_PROMPT)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setSavedSuccess(false)
    try {
      await window.api.setGroqKey(apiKey)
      await window.api.setSystemPrompt(systemPrompt)
      setSavedSuccess(true)
      onSettingsSaved()
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPrompt = (): void => {
    setSystemPrompt(DEFAULT_PROMPT)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-zinc-100 overflow-y-auto p-6 max-w-4xl mx-auto w-full font-sans select-none">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center space-x-2">
            <span>Settings & Configuration</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure LLM API keys (encrypted via safeStorage) and agent personality prompt
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors"
        >
          Back to Chat
        </button>
      </div>

      <div className="space-y-6">
        {/* Section 1: LLM Provider & API Key */}
        <div className="bg-[#202024] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-3">
            <Key className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-zinc-200">LLM Provider & Credentials</h2>
          </div>

          {/* Provider selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Active Provider</label>
            <div className="text-xs text-zinc-200 font-mono py-1">
              Groq (llama-3.3-70b-versatile) — Supported
            </div>
            <p className="text-[11px] text-zinc-500 italic">
              Groq is the active backend provider.
            </p>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300 flex items-center space-x-2">
                <span>Groq API Key</span>
                {apiKey ? (
                  <span className="text-[11px] text-zinc-400 font-normal">
                    (Encrypted at rest via safeStorage)
                  </span>
                ) : (
                  <span className="text-xs text-rose-500 font-semibold">
                    Warning: API key missing
                  </span>
                )}
              </label>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-[#141416] border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: System Prompt & Personality Override */}
        <div className="bg-[#202024] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-zinc-200">System Prompt & Personality</h2>
            </div>
            <button
              type="button"
              onClick={handleResetPrompt}
              className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-purple-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset to default</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Customize Nyx system prompt (injected via <code className="text-purple-300">CHAT_SYSTEM_PROMPT</code> env var)
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="w-full bg-[#141416] border border-zinc-700/80 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center space-x-1 font-medium animate-in fade-in">
              <Check className="w-4 h-4" />
              <span>Settings saved & environment updated!</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/50 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
