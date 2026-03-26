/**
 * API Client for Web Control features
 * Handles command execution, sessions, and log streaming
 */

export interface ExecuteCommandRequest {
  sessionId: string
  command: string
  args?: Record<string, unknown>
  priority?: number
  requireApproval?: boolean
}

export interface ExecuteCommandResponse {
  success: boolean
  commandId: string
  status: string
  message?: string
  requiresApproval?: boolean
}

export interface CommandStatus {
  id: string
  sessionId: string
  command: string
  args?: Record<string, unknown>
  status: string
  createdAt: string
  approvedAt?: string
  executedAt?: string
  completedAt?: string
  result?: unknown
  error?: string
}

export interface Session {
  id: string
  status: string
  createdAt: string
  lastActivity: string
  logCount: number
  commandCount: number
}

export interface QueueStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  avgExecutionTime: number
}

export interface GatewayStatus {
  connected: boolean
  url: string
  reconnectAttempts: number
  lastReconnectAttempt?: string
  clientCount: number
  timestamp: string
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string = '') {
    this.baseURL = baseURL
  }

  /**
   * Execute a command
   */
  async executeCommand(
    request: ExecuteCommandRequest
  ): Promise<ExecuteCommandResponse> {
    const response = await fetch(`${this.baseURL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to execute command')
    }

    return response.json()
  }

  /**
   * Approve a pending command
   */
  async approveCommand(commandId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/api/execute/${commandId}/approve`,
      {
        method: 'POST',
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to approve command')
    }

    return response.json()
  }

  /**
   * Reject a pending command
   */
  async rejectCommand(
    commandId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/api/execute/${commandId}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to reject command')
    }

    return response.json()
  }

  /**
   * Get command status
   */
  async getCommandStatus(commandId: string): Promise<{ success: boolean; command: CommandStatus }> {
    const response = await fetch(
      `${this.baseURL}/api/execute/${commandId}`
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get command status')
    }

    return response.json()
  }

  /**
   * List pending commands
   */
  async listPendingCommands(): Promise<{
    success: boolean
    pending: CommandStatus[]
    queued: unknown[]
    running: unknown[]
  }> {
    const response = await fetch(`${this.baseURL}/api/execute/pending`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to list pending commands')
    }

    return response.json()
  }

  /**
   * Get execution queue stats
   */
  async getExecutionStats(): Promise<{ success: boolean; stats: QueueStats }> {
    const response = await fetch(`${this.baseURL}/api/execute/stats`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get execution stats')
    }

    return response.json()
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<{ success: boolean; sessions: Session[] }> {
    const response = await fetch(`${this.baseURL}/api/sessions`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to list sessions')
    }

    return response.json()
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<{ success: boolean; session: Session }> {
    const response = await fetch(`${this.baseURL}/api/sessions/${sessionId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get session')
    }

    return response.json()
  }

  /**
   * Get session logs
   */
  async getSessionLogs(
    sessionId: string,
    limit: number = 100,
    level?: 'info' | 'warn' | 'error' | 'debug'
  ): Promise<{ success: boolean; logs: unknown[] }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    })
    if (level) {
      params.append('level', level)
    }

    const response = await fetch(
      `${this.baseURL}/api/sessions/${sessionId}/logs?${params}`
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get session logs')
    }

    return response.json()
  }

  /**
   * Get session commands
   */
  async getSessionCommands(
    sessionId: string
  ): Promise<{ success: boolean; commands: CommandStatus[] }> {
    const response = await fetch(
      `${this.baseURL}/api/sessions/${sessionId}/commands`
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get session commands')
    }

    return response.json()
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseURL}/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete session')
    }

    return response.json()
  }

  /**
   * Get queue queued items
   */
  async getQueuedItems(): Promise<{ success: boolean; items: unknown[] }> {
    const response = await fetch(`${this.baseURL}/api/queue/queued`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get queued items')
    }

    return response.json()
  }

  /**
   * Get queue running items
   */
  async getRunningItems(): Promise<{ success: boolean; items: unknown[] }> {
    const response = await fetch(`${this.baseURL}/api/queue/running`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get running items')
    }

    return response.json()
  }

  /**
   * Cancel a queued item
   */
  async cancelItem(itemId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/api/queue/${itemId}/cancel`,
      {
        method: 'POST',
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to cancel item')
    }

    return response.json()
  }

  /**
   * Get gateway status
   */
  async getGatewayStatus(): Promise<GatewayStatus> {
    const response = await fetch(`${this.baseURL}/api/gateway/status`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get gateway status')
    }

    return response.json()
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Export class for custom instances
export { ApiClient }

export default apiClient
