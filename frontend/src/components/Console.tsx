import React, { useEffect, useRef, useState, useCallback } from 'react'

export interface LogEntry {
  id: string
  sessionId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  source?: string
  data?: Record<string, unknown>
}

export interface ConsoleProps {
  logs: LogEntry[]
  sessionId?: string
  autoScroll?: boolean
  onClear?: () => void
  className?: string
}

const levelColors = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-gray-400',
}

const levelBgColors = {
  info: 'bg-blue-900/20',
  warn: 'bg-yellow-900/20',
  error: 'bg-red-900/20',
  debug: 'bg-gray-800/20',
}

export const Console: React.FC<ConsoleProps> = ({
  logs,
  sessionId,
  autoScroll = true,
  onClear,
  className = '',
}) => {
  const consoleRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<LogEntry['level'] | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter logs by session, level, and search term
  const filteredLogs = logs.filter((log) => {
    if (sessionId && log.sessionId !== sessionId) {
      return false
    }
    if (filter !== 'all' && log.level !== filter) {
      return false
    }
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleClear = useCallback(() => {
    onClear?.()
  }, [onClear])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono text-sm">Console</span>
          <span className="text-gray-500 text-xs">
            {filteredLogs.length} logs
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
          />
          {/* Level Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogEntry['level'] | 'all')}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          {/* Clear Button */}
          <button
            onClick={handleClear}
            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-400 rounded border border-red-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Console Output */}
      <div
        ref={consoleRef}
        className="flex-1 overflow-y-auto font-mono text-xs p-4 space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 px-2 py-1 rounded ${levelBgColors[log.level]}`}
            >
              <span className="text-gray-500 whitespace-nowrap">
                {formatTime(log.timestamp)}
              </span>
              <span className={`font-bold uppercase w-12 ${levelColors[log.level]}`}>
                {log.level}
              </span>
              {log.source && (
                <span className="text-purple-400 whitespace-nowrap">
                  [{log.source}]
                </span>
              )}
              <span className="text-gray-300 break-all flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Console
