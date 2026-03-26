/**
 * AG-UI Event Handler
 * Handles incoming AG-UI protocol messages and routes them to appropriate handlers
 */

import type WebSocket from 'ws'
import type {
  AGUIMessageUnion,
  InitializeMessage,
  TextMessage,
  ChunkMessage,
  DataMessage,
  ErrorMessage,
  DoneMessage,
  PingMessage,
} from './types/ag-ui-protocol.js'
import {
  isInitializeMessage,
  isTextMessage,
  isChunkMessage,
  isDataMessage,
  isErrorMessage,
  isDoneMessage,
  isPingMessage,
  createErrorMessage,
  createPongMessage,
} from './types/ag-ui-protocol.js'

export interface ClientSession {
  id: string
  ws: WebSocket
  initialized: boolean
  clientVersion?: string
  capabilities: string[]
  connectedAt: Date
  lastActivity: Date
}

export interface EventHandlerResult {
  success: boolean
  response?: AGUIMessageUnion
  error?: string
}

export interface EventHandlers {
  onInitialize?: (session: ClientSession, message: InitializeMessage) => Promise<EventHandlerResult>
  onMessage?: (session: ClientSession, message: TextMessage) => Promise<EventHandlerResult>
  onChunk?: (session: ClientSession, message: ChunkMessage) => Promise<EventHandlerResult>
  onData?: (session: ClientSession, message: DataMessage) => Promise<EventHandlerResult>
  onError?: (session: ClientSession, message: ErrorMessage) => Promise<EventHandlerResult>
  onDone?: (session: ClientSession, message: DoneMessage) => Promise<EventHandlerResult>
  onPing?: (session: ClientSession, message: PingMessage) => Promise<EventHandlerResult>
}

export class AGUIEventHandler {
  private sessions: Map<string, ClientSession>
  private handlers: EventHandlers

  constructor(handlers: EventHandlers = {}) {
    this.sessions = new Map()
    this.handlers = handlers
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: WebSocket, data: string): Promise<void> {
    let message: AGUIMessageUnion

    try {
      message = JSON.parse(data) as AGUIMessageUnion
    } catch (error) {
      const errorMessage = createErrorMessage(
        'Invalid JSON message',
        'PARSE_ERROR',
        { rawMessage: data.substring(0, 100) }
      )
      ws.send(JSON.stringify(errorMessage))
      return
    }

    // Validate message structure
    if (!message.type || !message.id) {
      const errorMessage = createErrorMessage(
        'Invalid message structure: missing type or id',
        'INVALID_MESSAGE'
      )
      ws.send(JSON.stringify(errorMessage))
      return
    }

    // Get or create session
    const session = this.getSessionByWebSocket(ws)
    if (!session && message.type !== 'initialize') {
      const errorMessage = createErrorMessage(
        'Session not initialized. Please send initialize message first.',
        'NOT_INITIALIZED'
      )
      ws.send(JSON.stringify(errorMessage))
      return
    }

    // Route message to appropriate handler
    try {
      let result: EventHandlerResult

      if (isInitializeMessage(message)) {
        result = await this.handleInitialize(session || this.createSession(ws), message)
      } else if (isTextMessage(message)) {
        result = await this.handleTextMessage(session!, message)
      } else if (isChunkMessage(message)) {
        result = await this.handleChunkMessage(session!, message)
      } else if (isDataMessage(message)) {
        result = await this.handleDataMessage(session!, message)
      } else if (isErrorMessage(message)) {
        result = await this.handleErrorMessage(session!, message)
      } else if (isDoneMessage(message)) {
        result = await this.handleDoneMessage(session!, message)
      } else if (isPingMessage(message)) {
        result = await this.handlePingMessage(session!, message)
      } else {
        result = {
          success: false,
          error: `Unknown message type: ${message.type}`,
        }
      }

      // Send response if available
      if (result.response) {
        ws.send(JSON.stringify(result.response))
      }

      if (!result.success && result.error) {
        console.error('[AG-UI Handler] Error:', result.error)
      }
    } catch (error) {
      const errorMessage = createErrorMessage(
        error instanceof Error ? error.message : 'Unknown error',
        'HANDLER_ERROR'
      )
      ws.send(JSON.stringify(errorMessage))
    }
  }

  /**
   * Handle initialize message
   */
  private async handleInitialize(session: ClientSession, message: InitializeMessage): Promise<EventHandlerResult> {
    session.initialized = true
    session.clientVersion = message.payload.clientVersion
    session.capabilities = message.payload.capabilities

    // Update last activity
    session.lastActivity = new Date()

    if (this.handlers.onInitialize) {
      return this.handlers.onInitialize(session, message)
    }

    // Default response: acknowledge initialization
    return {
      success: true,
      response: {
        type: 'data',
        id: message.id,
        timestamp: Date.now(),
        payload: {
          data: {
            status: 'initialized',
            serverVersion: '0.1.0',
            capabilities: ['skills', 'validation', 'remote-control'],
          },
        },
      },
    }
  }

  /**
   * Handle text message
   */
  private async handleTextMessage(session: ClientSession, message: TextMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    if (this.handlers.onMessage) {
      return this.handlers.onMessage(session, message)
    }

    // Default: echo back with acknowledgment
    return {
      success: true,
      response: {
        type: 'data',
        id: message.id,
        timestamp: Date.now(),
        payload: {
          data: {
            status: 'received',
            messageId: message.id,
            content: message.payload.content,
          },
        },
      },
    }
  }

  /**
   * Handle chunk message (streaming)
   */
  private async handleChunkMessage(session: ClientSession, message: ChunkMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    if (this.handlers.onChunk) {
      return this.handlers.onChunk(session, message)
    }

    return { success: true }
  }

  /**
   * Handle data message
   */
  private async handleDataMessage(session: ClientSession, message: DataMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    if (this.handlers.onData) {
      return this.handlers.onData(session, message)
    }

    return { success: true }
  }

  /**
   * Handle error message
   */
  private async handleErrorMessage(session: ClientSession, message: ErrorMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    console.error('[AG-UI Handler] Client error:', message.payload)

    if (this.handlers.onError) {
      return this.handlers.onError(session, message)
    }

    return { success: true }
  }

  /**
   * Handle done message
   */
  private async handleDoneMessage(session: ClientSession, message: DoneMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    if (this.handlers.onDone) {
      return this.handlers.onDone(session, message)
    }

    return { success: true }
  }

  /**
   * Handle ping message
   */
  private async handlePingMessage(session: ClientSession, message: PingMessage): Promise<EventHandlerResult> {
    session.lastActivity = new Date()

    if (this.handlers.onPing) {
      return this.handlers.onPing(session, message)
    }

    // Default: respond with pong
    return {
      success: true,
      response: createPongMessage(),
    }
  }

  /**
   * Create a new session for a WebSocket connection
   */
  private createSession(ws: WebSocket): ClientSession {
    const session: ClientSession = {
      id: crypto.randomUUID(),
      ws,
      initialized: false,
      capabilities: [],
      connectedAt: new Date(),
      lastActivity: new Date(),
    }
    this.sessions.set(session.id, session)
    return session
  }

  /**
   * Get session by WebSocket instance
   */
  private getSessionByWebSocket(ws: WebSocket): ClientSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.ws === ws) {
        return session
      }
    }
    return undefined
  }

  /**
   * Remove session when WebSocket closes
   */
  removeSession(ws: WebSocket): void {
    for (const [id, session] of this.sessions.entries()) {
      if (session.ws === ws) {
        this.sessions.delete(id)
        break
      }
    }
  }

  /**
   * Get all active sessions
   */
  getSessions(): ClientSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }
}
