import React, { useEffect, useState, useCallback, useRef } from 'react'

export interface Session {
  id: string
  status: 'idle' | 'running' | 'paused' | 'error'
  createdAt: string
  lastActivity: string
  logCount: number
  commandCount: number
}

export interface SessionManagerProps {
  onSessionSelect?: (sessionId: string) => void
  onSessionCreate?: (sessionId: string) => void
  onSessionDelete?: (sessionId: string) => void
  className?: string
}

export interface PendingCommand {
  id: string
  sessionId: string
  command: string
  args?: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'
  createdAt: string
  approvedAt?: string
  executedAt?: string
  completedAt?: string
  result?: unknown
  error?: string
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  className = '',
}) => {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPendingCommands, setShowPendingCommands] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch pending commands
  const fetchPendingCommands = useCallback(async () => {
    try {
      const response = await fetch('/api/execute/pending')
      if (response.ok) {
        const data = await response.json()
        setPendingCommands(data.pending || [])
      }
    } catch (err) {
      console.error('Failed to fetch pending commands:', err)
    }
  }, [])

  // Connect to log stream WebSocket
  useEffect(() => {
    const connectLogStream = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/logs`

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ Connected to log stream')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          // Handle command updates
          if (message.type === 'command_update') {
            setPendingCommands((prev) => {
              const index = prev.findIndex((cmd) => cmd.id === message.payload.commandId)
              if (index !== -1) {
                const updated = [...prev]
                updated[index] = { ...updated[index], ...message.payload }
                return updated
              }
              return prev
            })
          }
        } catch (err) {
          console.error('Failed to parse log stream message:', err)
        }
      }

      ws.onclose = () => {
        console.log('🔌 Log stream disconnected')
        // Reconnect after 3 seconds
        setTimeout(connectLogStream, 3000)
      }

      ws.onerror = (err) => {
        console.error('Log stream error:', err)
      }

      wsRef.current = ws
    }

    connectLogStream()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchSessions()
    fetchPendingCommands()

    // Poll for pending commands every 3 seconds
    const interval = setInterval(fetchPendingCommands, 3000)
    return () => clearInterval(interval)
  }, [fetchSessions, fetchPendingCommands])

  // Create new session
  const handleCreateSession = useCallback(async () => {
    try {
      // For now, sessions are created automatically on WebSocket connection
      // This could be extended to create sessions via API
      await fetchSessions()
      onSessionCreate?.(crypto.randomUUID())
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }, [fetchSessions, onSessionCreate])

  // Delete session
  const handleDeleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation()

      if (!confirm(`Delete session ${sessionId}?`)) {
        return
      }

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId))
          if (selectedSessionId === sessionId) {
            setSelectedSessionId(null)
          }
          onSessionDelete?.(sessionId)
        }
      } catch (err) {
        console.error('Failed to delete session:', err)
      }
    },
    [selectedSessionId, onSessionDelete]
  )

  // Select session
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId)
      onSessionSelect?.(sessionId)
    },
    [onSessionSelect]
  )

  // Approve command
  const handleApproveCommand = useCallback(async (commandId: string) => {
    try {
      const response = await fetch(`/api/execute/${commandId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        setPendingCommands((prev) =>
          prev.filter((cmd) => cmd.id !== commandId)
        )
      }
    } catch (err) {
      console.error('Failed to approve command:', err)
    }
  }, [])

  // Reject command
  const handleRejectCommand = useCallback(async (commandId: string) => {
    try {
      const response = await fetch(`/api/execute/${commandId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Rejected by user' }),
      })

      if (response.ok) {
        setPendingCommands((prev) =>
          prev.filter((cmd) => cmd.id !== commandId)
        )
      }
    } catch (err) {
      console.error('Failed to reject command:', err)
    }
  }, [])

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'paused':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`flex flex-col h-full bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-white font-medium">Sessions</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateSession}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            + New Session
          </button>
          <button
            onClick={() => setShowPendingCommands(!showPendingCommands)}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors relative"
          >
            Pending
            {pendingCommands.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingCommands.length}
              </span>
            )}
          </button>
          <button
            onClick={fetchSessions}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Refresh"
          >
            <svg
              className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400 text-sm">Loading sessions...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 text-sm">No active sessions</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'bg-blue-900/30'
                    : 'hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(
                        session.status
                      )}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-mono truncate">
                        {session.id}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {session.logCount} logs • {session.commandCount} commands
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors"
                    title="Delete session"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Active: {new Date(session.lastActivity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Commands Panel */}
      {showPendingCommands && pendingCommands.length > 0 && (
        <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
          <div className="px-4 py-2 bg-purple-900/20 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-400">
                Pending Commands ({pendingCommands.length})
              </span>
              <button
                onClick={() => setShowPendingCommands(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <svg
                  className="w-3 h-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-700">
            {pendingCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="px-4 py-3 bg-gray-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-mono truncate">
                      {cmd.command}
                    </div>
                    <div className="text-gray-500 text-xs truncate">
                      Session: {cmd.sessionId}
                    </div>
                    {cmd.args && (
                      <div className="text-gray-600 text-xs mt-1 font-mono truncate">
                        {JSON.stringify(cmd.args)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleApproveCommand(cmd.id)}
                      className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                      title="Approve"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleRejectCommand(cmd.id)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                      title="Reject"
                    >
                      ✗
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {new Date(cmd.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-t border-red-700">
          <div className="text-red-400 text-xs">{error}</div>
        </div>
      )}
    </div>
  )
}

export default SessionManager
