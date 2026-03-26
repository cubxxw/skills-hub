import React, { useEffect, useState, useCallback } from 'react'

export interface StatusIndicatorProps {
  sessionId?: string
  showDetails?: boolean
  className?: string
  refreshInterval?: number
}

export interface ConnectionStatus {
  gateway: {
    connected: boolean
    url: string
    reconnectAttempts: number
  }
  websocket: {
    connected: boolean
    clientCount: number
  }
  logStream: {
    connected: boolean
  }
  execution: {
    queued: number
    running: number
  }
}

const defaultStatus: ConnectionStatus = {
  gateway: {
    connected: false,
    url: '',
    reconnectAttempts: 0,
  },
  websocket: {
    connected: false,
    clientCount: 0,
  },
  logStream: {
    connected: false,
  },
  execution: {
    queued: 0,
    running: 0,
  },
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  sessionId,
  showDetails = false,
  className = '',
  refreshInterval = 5000,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>(defaultStatus)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch gateway status
      const gatewayResponse = await fetch('/api/gateway/status')
      if (gatewayResponse.ok) {
        const gatewayData = await gatewayResponse.json()
        setStatus((prev) => ({
          ...prev,
          gateway: {
            connected: gatewayData.connected,
            url: gatewayData.url,
            reconnectAttempts: gatewayData.reconnectAttempts,
          },
          websocket: {
            ...prev.websocket,
            clientCount: gatewayData.clientCount,
          },
        }))
      }

      // Fetch execution stats
      const statsResponse = await fetch('/api/execute/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStatus((prev) => ({
          ...prev,
          execution: {
            queued: statsData.stats.queued,
            running: statsData.stats.running,
          },
        }))
      }

      // Check log stream connection (simplified check)
      setStatus((prev) => ({
        ...prev,
        logStream: {
          connected: true, // Will be updated by actual WebSocket connection
        },
      }))

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchStatus()

    const interval = setInterval(fetchStatus, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchStatus, refreshInterval])

  const getStatusColor = useCallback(() => {
    if (error) return 'bg-red-500'
    if (status.gateway.connected && status.websocket.connected) {
      return 'bg-green-500'
    }
    if (status.gateway.connected || status.websocket.connected) {
      return 'bg-yellow-500'
    }
    return 'bg-red-500'
  }, [status, error])

  const getStatusText = useCallback(() => {
    if (error) return 'Error'
    if (isLoading) return 'Loading...'
    if (status.gateway.connected && status.websocket.connected) {
      return 'Connected'
    }
    if (status.gateway.connected) {
      return 'Gateway Only'
    }
    if (status.websocket.connected) {
      return 'WebSocket Only'
    }
    return 'Disconnected'
  }, [status, error, isLoading])

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Status Indicator Dot */}
      <div className="relative">
        <div
          className={`w-3 h-3 rounded-full ${getStatusColor()} transition-colors`}
          title={getStatusText()}
        />
        <div
          className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor()} animate-ping opacity-75`}
        />
      </div>

      {/* Status Text */}
      <span className="text-sm text-gray-300">{getStatusText()}</span>

      {/* Last Updated */}
      {!isLoading && (
        <span className="text-xs text-gray-500">
          Updated: {lastUpdated.toLocaleTimeString()}
        </span>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchStatus}
        disabled={isLoading}
        className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
        title="Refresh status"
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

      {/* Details Dropdown */}
      {showDetails && (
        <div className="relative">
          <details className="group">
            <summary className="list-none cursor-pointer">
              <svg
                className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-10">
              <h4 className="text-sm font-medium text-white mb-3">
                Connection Details
              </h4>

              {/* Gateway Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Gateway</span>
                  <span
                    className={`text-xs ${
                      status.gateway.connected
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {status.gateway.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {status.gateway.url && (
                  <div className="text-xs text-gray-500 truncate">
                    {status.gateway.url}
                  </div>
                )}
                {status.gateway.reconnectAttempts > 0 && (
                  <div className="text-xs text-yellow-400">
                    Reconnect attempts: {status.gateway.reconnectAttempts}
                  </div>
                )}
              </div>

              {/* WebSocket Status */}
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">WebSocket</span>
                  <span
                    className={`text-xs ${
                      status.websocket.connected
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {status.websocket.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Clients: {status.websocket.clientCount}
                </div>
              </div>

              {/* Log Stream Status */}
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Log Stream</span>
                  <span
                    className={`text-xs ${
                      status.logStream.connected
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {status.logStream.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Execution Queue */}
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Queue</span>
                  <div className="flex gap-2">
                    <span className="text-xs text-blue-400">
                      Queued: {status.execution.queued}
                    </span>
                    <span className="text-xs text-yellow-400">
                      Running: {status.execution.running}
                    </span>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              {sessionId && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400">Session</div>
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {sessionId}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export default StatusIndicator
