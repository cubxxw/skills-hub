/**
 * WebSocket Server
 * Manages WebSocket connections and integrates with AG-UI protocol
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { AGUIEventHandler } from './ag-ui-handler.js'
import { createErrorMessage } from './types/ag-ui-protocol.js'

export interface WebSocketServerOptions {
  port?: number
  path?: string
  heartbeatInterval?: number
}

export interface GatewayConnection {
  ws: WebSocket | null
  connected: boolean
  url: string
  reconnectAttempts: number
  lastReconnectAttempt?: Date
}

export class WSServer {
  private wss: WebSocketServer | null = null
  private eventHandler: AGUIEventHandler
  private heartbeatInterval: number
  private interval: NodeJS.Timeout | null = null
  private gatewayConnection: GatewayConnection

  constructor(options: WebSocketServerOptions = {}, eventHandler?: AGUIEventHandler) {
    this.heartbeatInterval = options.heartbeatInterval || 30000
    this.eventHandler = eventHandler || new AGUIEventHandler()
    this.gatewayConnection = {
      ws: null,
      connected: false,
      url: 'ws://127.0.0.1:18789',
      reconnectAttempts: 0,
    }
  }

  /**
   * Get WebSocket server instance
   */
  get server(): WebSocketServer | null {
    return this.wss
  }

  /**
   * Attach WebSocket server to existing HTTP server
   */
  attach(httpServer: Server): void {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
    })
    this.setupWebSocketHandlers()
    this.startHeartbeat()
  }

  /**
   * Start standalone WebSocket server
   */
  start(port: number): void {
    this.wss = new WebSocketServer({
      port,
      path: '/ws',
    })
    this.setupWebSocketHandlers()
    this.startHeartbeat()

    console.log(`🔌 WebSocket server running on ws://localhost:${port}/ws`)
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = crypto.randomUUID()
      const clientIp = request.socket.remoteAddress || 'unknown'

      console.log(`🔗 Client connected: ${clientId} from ${clientIp}`)

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          await this.eventHandler.handleMessage(ws, data.toString())
        } catch (error) {
          const errorMessage = createErrorMessage(
            error instanceof Error ? error.message : 'Message handling error',
            'MESSAGE_ERROR'
          )
          ws.send(JSON.stringify(errorMessage))
        }
      })

      // Handle close
      ws.on('close', (code: number) => {
        console.log(`🔌 Client disconnected: ${clientId}, code: ${code}`)
        this.eventHandler.removeSession(ws)
      })

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message)
      })

      // Send welcome message
      const welcomeMessage = {
        type: 'data' as const,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        payload: {
          data: {
            status: 'connected',
            clientId,
            message: 'Welcome to AG-UI Skill Platform',
            timestamp: new Date().toISOString(),
          },
        },
      }
      ws.send(JSON.stringify(welcomeMessage))
    })

    this.wss.on('error', (error: Error) => {
      console.error('❌ WebSocket server error:', error.message)
    })

    this.wss.on('close', () => {
      console.log('🔌 WebSocket server closed')
    })
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.interval = setInterval(() => {
      if (!this.wss) return

      this.wss.clients.forEach((ws: WebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate()
        }

        ws.isAlive = false
        ws.ping()
      })
    }, this.heartbeatInterval)

    this.wss?.on('pong', (ws: WebSocket) => {
      ws.isAlive = true
    })
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  /**
   * Connect to OpenClaw Gateway
   */
  connectToGateway(url?: string): void {
    const gatewayUrl = url || this.gatewayConnection.url

    console.log(`🔗 Connecting to OpenClaw Gateway: ${gatewayUrl}`)

    try {
      const ws = new WebSocket(gatewayUrl)

      ws.on('open', () => {
        console.log('✅ Connected to OpenClaw Gateway')
        this.gatewayConnection.ws = ws
        this.gatewayConnection.connected = true
        this.gatewayConnection.reconnectAttempts = 0

        // Send initialization message
        const initMessage = {
          type: 'initialize',
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          payload: {
            clientVersion: '0.1.0',
            capabilities: ['skills', 'validation', 'remote-control'],
          },
        }
        ws.send(JSON.stringify(initMessage))
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          console.log('📨 Gateway message:', message.type)

          // Broadcast to connected clients
          this.broadcastToClients(message)
        } catch (error) {
          console.error('❌ Error parsing gateway message:', error)
        }
      })

      ws.on('close', (code: number) => {
        console.log(`🔌 Gateway disconnected: code ${code}`)
        this.gatewayConnection.ws = null
        this.gatewayConnection.connected = false

        // Attempt reconnection
        this.scheduleReconnect(gatewayUrl)
      })

      ws.on('error', (error: Error) => {
        console.error('❌ Gateway WebSocket error:', error.message)
        this.gatewayConnection.connected = false
      })
    } catch (error) {
      console.error('❌ Failed to connect to Gateway:', error instanceof Error ? error.message : error)
      this.scheduleReconnect(gatewayUrl)
    }
  }

  /**
   * Schedule reconnection to Gateway
   */
  private scheduleReconnect(gatewayUrl: string): void {
    const maxReconnectAttempts = 5
    const reconnectDelay = Math.min(1000 * Math.pow(2, this.gatewayConnection.reconnectAttempts), 30000)

    if (this.gatewayConnection.reconnectAttempts >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up on Gateway.')
      return
    }

    this.gatewayConnection.reconnectAttempts++
    this.gatewayConnection.lastReconnectAttempt = new Date()

    console.log(`🔄 Reconnecting to Gateway in ${reconnectDelay}ms (attempt ${this.gatewayConnection.reconnectAttempts}/${maxReconnectAttempts})`)

    setTimeout(() => {
      if (!this.gatewayConnection.connected) {
        this.connectToGateway(gatewayUrl)
      }
    }, reconnectDelay)
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToClients(message: unknown): void {
    if (!this.wss) return

    const data = typeof message === 'string' ? message : JSON.stringify(message)

    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })
  }

  /**
   * Disconnect from Gateway
   */
  disconnectFromGateway(): void {
    if (this.gatewayConnection.ws) {
      this.gatewayConnection.ws.close()
      this.gatewayConnection.ws = null
      this.gatewayConnection.connected = false
      console.log('🔌 Disconnected from OpenClaw Gateway')
    }
  }

  /**
   * Get Gateway connection status
   */
  getGatewayStatus(): GatewayConnection {
    return { ...this.gatewayConnection }
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    this.stopHeartbeat()
    this.disconnectFromGateway()

    if (this.wss) {
      this.wss.close(() => {
        console.log('🔌 WebSocket server closed')
      })
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.wss?.clients.size || 0
  }
}

// Extend WebSocket type with isAlive property
declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean
  }
}
