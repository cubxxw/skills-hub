/**
 * Log Stream WebSocket Handler
 * Handles WebSocket connections for real-time log streaming at /ws/logs
 */

import WebSocket from 'ws'
import type { IncomingMessage } from 'http'
import { getSessionManager, type LogEntry } from '../services/session-manager.js'

export interface LogStreamClient {
  id: string
  ws: WebSocket
  sessionId?: string
  levels: Set<LogEntry['level']>
  connectedAt: Date
}

export class LogStreamHandler {
  private clients: Map<string, LogStreamClient> = new Map()
  private sessionManager: ReturnType<typeof getSessionManager>

  constructor() {
    this.sessionManager = getSessionManager()

    // Subscribe to log events
    this.sessionManager.addLogListener((entry) => {
      this.broadcastLog(entry)
    })
  }

  /**
   * Handle WebSocket connection
   */
  handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = crypto.randomUUID()
    const clientIp = request.socket.remoteAddress || 'unknown'

    console.log(`📋 Log stream client connected: ${clientId} from ${clientIp}`)

    const client: LogStreamClient = {
      id: clientId,
      ws,
      levels: new Set(['info', 'warn', 'error', 'debug']),
      connectedAt: new Date(),
    }

    this.clients.set(clientId, client)

    // Send welcome message with recent logs
    this.sendWelcomeMessage(client)

    // Handle incoming messages (for filtering)
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        this.handleClientMessage(client, message)
      } catch (error) {
        console.error('❌ Log stream message error:', error)
      }
    })

    // Handle close
    ws.on('close', (code: number) => {
      console.log(`📋 Log stream client disconnected: ${clientId}, code: ${code}`)
      this.clients.delete(clientId)
    })

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error(`❌ Log stream error for ${clientId}:`, error.message)
      this.clients.delete(clientId)
    })
  }

  /**
   * Send welcome message with recent logs
   */
  private sendWelcomeMessage(client: LogStreamClient): void {
    const recentLogs = this.sessionManager.getAllRecentLogs(50)

    const welcomeMessage = {
      type: 'welcome',
      clientId: client.id,
      timestamp: Date.now(),
      payload: {
        message: 'Connected to log stream',
        recentLogs,
        levels: Array.from(client.levels),
      },
    }

    this.sendToClient(client, welcomeMessage)
  }

  /**
   * Handle client message (filtering, subscription)
   */
  private handleClientMessage(client: LogStreamClient, message: Record<string, unknown>): void {
    const { type, payload } = message

    switch (type) {
      case 'subscribe':
        this.handleSubscribe(client, payload as Record<string, unknown>)
        break
      case 'unsubscribe':
        this.handleUnsubscribe(client, payload as Record<string, unknown>)
        break
      case 'set_levels':
        this.handleSetLevels(client, payload as Record<string, unknown>)
        break
      case 'ping':
        this.handlePing(client)
        break
    }
  }

  /**
   * Handle subscribe to session logs
   */
  private handleSubscribe(
    client: LogStreamClient,
    payload: Record<string, unknown>
  ): void {
    const { sessionId } = payload

    if (typeof sessionId === 'string') {
      client.sessionId = sessionId
      const logs = this.sessionManager.getLogs(sessionId, 100)

      const response = {
        type: 'subscribed',
        timestamp: Date.now(),
        payload: {
          sessionId,
          logs,
        },
      }

      this.sendToClient(client, response)
    }
  }

  /**
   * Handle unsubscribe from session
   */
  private handleUnsubscribe(
    client: LogStreamClient,
    _payload: Record<string, unknown>
  ): void {
    client.sessionId = undefined

    const response = {
      type: 'unsubscribed',
      timestamp: Date.now(),
      payload: {
        message: 'Unsubscribed from session logs',
      },
    }

    this.sendToClient(client, response)
  }

  /**
   * Handle setting log level filters
   */
  private handleSetLevels(
    client: LogStreamClient,
    payload: Record<string, unknown>
  ): void {
    const { levels } = payload

    if (Array.isArray(levels)) {
      client.levels = new Set(levels as LogEntry['level'][])

      const response = {
        type: 'levels_updated',
        timestamp: Date.now(),
        payload: {
          levels: Array.from(client.levels),
        },
      }

      this.sendToClient(client, response)
    }
  }

  /**
   * Handle ping
   */
  private handlePing(client: LogStreamClient): void {
    const response = {
      type: 'pong',
      timestamp: Date.now(),
      payload: {
        clientId: client.id,
        connectedAt: client.connectedAt.toISOString(),
      },
    }

    this.sendToClient(client, response)
  }

  /**
   * Broadcast log entry to all subscribed clients
   */
  private broadcastLog(entry: LogEntry): void {
    for (const client of this.clients.values()) {
      // Check if client is subscribed to this session
      if (client.sessionId && client.sessionId !== entry.sessionId) {
        continue
      }

      // Check if client wants this log level
      if (!client.levels.has(entry.level)) {
        continue
      }

      const message = {
        type: 'log',
        timestamp: Date.now(),
        payload: entry,
      }

      this.sendToClient(client, message)
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: LogStreamClient, message: unknown): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('❌ Failed to send to client:', error)
      }
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Get all connected clients
   */
  getClients(): LogStreamClient[] {
    return Array.from(this.clients.values())
  }

  /**
   * Broadcast to all clients
   */
  broadcast(message: unknown): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message)
    }
  }
}

// Singleton instance
let logStreamHandlerInstance: LogStreamHandler | null = null

export function getLogStreamHandler(): LogStreamHandler {
  if (!logStreamHandlerInstance) {
    logStreamHandlerInstance = new LogStreamHandler()
  }
  return logStreamHandlerInstance
}
