import React, { useState, useCallback, useEffect, useRef } from 'react'
import Console, { type LogEntry } from './Console'
import CommandInput from './CommandInput'
import StatusIndicator from './StatusIndicator'
import SessionManager from './SessionManager'

export interface ConsolePageProps {
  title?: string
  showSessionManager?: boolean
  showStatusIndicator?: boolean
  className?: string
}

export const ConsolePage: React.FC<ConsolePageProps> = ({
  title = 'Control Console',
  showSessionManager = true,
  showStatusIndicator = true,
  className = '',
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Connect to log stream WebSocket
  useEffect(() => {
    const connectLogStream = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/logs`

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ Connected to log stream')
        showNotification('Connected to log stream', 'success')

        // Subscribe to all logs
        ws.send(JSON.stringify({
          type: 'subscribe',
          payload: {},
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'log') {
            const logEntry: LogEntry = message.payload
            setLogs((prev) => [...prev, logEntry].slice(-1000)) // Keep last 1000 logs
          } else if (message.type === 'welcome') {
            // Load recent logs from welcome message
            if (message.payload.recentLogs) {
              setLogs(message.payload.recentLogs)
            }
          } else if (message.type === 'command_update') {
            const { status, commandId } = message.payload
            if (status === 'completed') {
              showNotification(`Command ${commandId} completed`, 'success')
            } else if (status === 'failed') {
              showNotification(`Command ${commandId} failed`, 'error')
            }
          }
        } catch (err) {
          console.error('Failed to parse log stream message:', err)
        }
      }

      ws.onclose = () => {
        console.log('🔌 Log stream disconnected')
        showNotification('Log stream disconnected. Reconnecting...', 'error')
        setTimeout(connectLogStream, 3000)
      }

      ws.onerror = (err) => {
        console.error('Log stream error:', err)
        showNotification('Log stream error', 'error')
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

  // Show notification
  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      setNotification({ message, type })
      setTimeout(() => setNotification(null), 5000)
    },
    []
  )

  // Handle session select
  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [])

  // Handle command execution
  const handleCommandExecute = useCallback(
    (commandId: string, status: string) => {
      showNotification(`Command ${status}: ${commandId}`, 'info')
    },
    [showNotification]
  )

  // Handle command error
  const handleCommandError = useCallback(
    (error: string) => {
      showNotification(error, 'error')
    },
    [showNotification]
  )

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <div className={`flex flex-col h-screen bg-gray-900 ${className}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <div className="flex items-center gap-4">
          {showStatusIndicator && (
            <StatusIndicator sessionId={selectedSessionId || undefined} showDetails />
          )}
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div
          className={`mx-6 mt-4 px-4 py-2 rounded-lg ${
            notification.type === 'success'
              ? 'bg-green-900/50 text-green-400 border border-green-700'
              : notification.type === 'error'
              ? 'bg-red-900/50 text-red-400 border border-red-700'
              : 'bg-blue-900/50 text-blue-400 border border-blue-700'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-6 overflow-hidden">
        {/* Session Manager Sidebar */}
        {showSessionManager && (
          <div className="w-80 flex-shrink-0">
            <SessionManager
              onSessionSelect={handleSessionSelect}
              className="h-full"
            />
          </div>
        )}

        {/* Main Console Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Console */}
          <div className="flex-1 min-h-0">
            <Console
              logs={logs}
              sessionId={selectedSessionId || undefined}
              onClear={handleClearLogs}
              className="h-full"
            />
          </div>

          {/* Command Input */}
          <div className="flex-shrink-0">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h3 className="text-white font-medium mb-3">Execute Command</h3>
              {selectedSessionId ? (
                <CommandInput
                  sessionId={selectedSessionId}
                  onExecute={handleCommandExecute}
                  onError={handleCommandError}
                  requireApproval
                />
              ) : (
                <div className="text-gray-400 text-sm py-8 text-center">
                  Select a session from the sidebar to execute commands
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsolePage
