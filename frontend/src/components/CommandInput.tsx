import React, { useState, useCallback, useRef, useEffect } from 'react'

export interface CommandInputProps {
  sessionId: string
  onExecute?: (commandId: string, status: string) => void
  onError?: (error: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  requireApproval?: boolean
}

export interface CommandHistoryItem {
  command: string
  args?: Record<string, unknown>
  timestamp: Date
}

const DEFAULT_COMMANDS = [
  'run_skill',
  'stop_skill',
  'list_skills',
  'get_status',
  'reload_config',
]

export const CommandInput: React.FC<CommandInputProps> = ({
  sessionId,
  onExecute,
  onError,
  disabled = false,
  className = '',
  placeholder = 'Enter command...',
  requireApproval = true,
}) => {
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('{}')
  const [priority, setPriority] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load command history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('commandHistory')
    if (saved) {
      try {
        const history = JSON.parse(saved).map(
          (item: CommandHistoryItem) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          })
        )
        setCommandHistory(history.slice(0, 50)) // Keep last 50
      } catch (e) {
        console.error('Failed to load command history:', e)
      }
    }
  }, [])

  // Save command to history
  const saveToHistory = useCallback((cmd: string, args?: Record<string, unknown>) => {
    setCommandHistory((prev) => {
      const newHistory = [
        { command: cmd, args, timestamp: new Date() },
        ...prev.filter((item) => item.command !== cmd),
      ].slice(0, 50)

      localStorage.setItem('commandHistory', JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  // Handle keyboard navigation for history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== inputRef.current) return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1
          const item = commandHistory[newIndex]
          if (item) {
            setCommand(item.command)
            if (item.args) {
              setArgs(JSON.stringify(item.args, null, 2))
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          const item = commandHistory[newIndex]
          if (item) {
            setCommand(item.command)
            if (item.args) {
              setArgs(JSON.stringify(item.args, null, 2))
            }
          }
        } else {
          setHistoryIndex(-1)
          setCommand('')
          setArgs('{}')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandHistory, historyIndex])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!command.trim() || !sessionId) return

      setIsSubmitting(true)

      try {
        let parsedArgs = {}
        if (args.trim()) {
          parsedArgs = JSON.parse(args)
        }

        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            command: command.trim(),
            args: parsedArgs,
            priority,
            requireApproval,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to execute command')
        }

        const result = await response.json()

        // Save to history
        saveToHistory(command.trim(), parsedArgs)

        // Notify parent
        onExecute?.(result.commandId, result.status)

        // Reset form
        setCommand('')
        setArgs('{}')
        setPriority(0)
        setHistoryIndex(-1)
      } catch (error) {
        console.error('Command execution error:', error)
        onError?.(error instanceof Error ? error.message : 'Failed to execute command')
      } finally {
        setIsSubmitting(false)
      }
    },
    [command, args, priority, sessionId, requireApproval, onExecute, onError, saveToHistory]
  )

  const filteredSuggestions = DEFAULT_COMMANDS.filter((cmd) =>
    cmd.toLowerCase().includes(command.toLowerCase())
  ).slice(0, 5)

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-3 ${className}`}
    >
      {/* Command Input */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value)
              setShowSuggestions(e.target.value.length > 0)
            }}
            onFocus={() => setShowSuggestions(command.length > 0)}
            placeholder={placeholder}
            disabled={disabled || isSubmitting}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || isSubmitting || !command.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Executing...' : 'Execute'}
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10"
          >
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setCommand(suggestion)
                  setShowSuggestions(false)
                  inputRef.current?.focus()
                }}
                className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 font-mono text-sm first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Arguments Input */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Arguments (JSON)
        </label>
        <textarea
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder='{"key": "value"}'
          disabled={disabled || isSubmitting}
          rows={3}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Priority Slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-400">Priority</label>
          <span className="text-xs text-gray-300">{priority}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value, 10))}
          disabled={disabled || isSubmitting}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500">
        <p>Use ↑/↓ arrows to navigate command history</p>
        <p>Approval required: {requireApproval ? 'Yes' : 'No'}</p>
      </div>
    </form>
  )
}

export default CommandInput
