/**
 * OpenClaw Gateway Service
 * Manages WebSocket connection to OpenClaw Gateway for remote control
 */

import { WebSocket } from 'ws'
import type { ClientSession } from '../ag-ui-handler.js'

export interface GatewayConfig {
  url: string
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

export interface GatewayMessage {
  type: string
  id: string
  timestamp: number
  payload: Record<string, unknown>
}

export interface GatewayCommand {
  id: string
  sessionId: string
  command: string
  args?: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'
  createdAt: Date
  approvedAt?: Date
  executedAt?: Date
  completedAt?: Date
  result?: unknown
  error?: string
}

export type GatewayListener = (message: GatewayMessage) => void

export class OpenClawGatewayService {
  private ws: WebSocket | null = null
  private config: GatewayConfig
  private connected: boolean = false
  private reconnectAttempts: number = 0
  private listeners: Set<GatewayListener> = new Set()
  private pendingCommands: Map<string, GatewayCommand> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private sessionMap: Map<string, ClientSession> = new Map()

  constructor(config: GatewayConfig) {
    this.config = {
      url: config.url,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 3000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    }
  }

  /**
   * Connect to OpenClaw Gateway
   */
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`🔗 Connecting to OpenClaw Gateway: ${this.config.url}`)

      try {
        this.ws = new WebSocket(this.config.url)

        this.ws.on('open', () => {
          console.log('✅ Connected to OpenClaw Gateway')
          this.connected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.sendInitializeMessage()
          resolve(true)
        })

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as GatewayMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('❌ Error parsing gateway message:', error)
          }
        })

        this.ws.on('close', (code: number) => {
          console.log(`🔌 Gateway disconnected: code ${code}`)
          this.connected = false
          this.stopHeartbeat()
          this.scheduleReconnect()
        })

        this.ws.on('error', (error: Error) => {
          console.error('❌ Gateway WebSocket error:', error.message)
          this.connected = false
          resolve(false)
        })
      } catch (error) {
        console.error('❌ Failed to connect to Gateway:', error instanceof Error ? error.message : error)
        resolve(false)
      }
    })
  }

  /**
   * Send initialize message to gateway
   */
  private sendInitializeMessage(): void {
    const initMessage: GatewayMessage = {
      type: 'initialize',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        clientVersion: '0.2.0',
        capabilities: ['skills', 'validation', 'remote-control', 'log-stream'],
      },
    }
    this.send(initMessage)
  }

  /**
   * Handle incoming gateway message
   */
  private handleMessage(message: GatewayMessage): void {
    console.log(`📨 Gateway message: ${message.type}`)

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(message)
      } catch (error) {
        console.error('❌ Listener error:', error)
      }
    })

    // Handle specific message types
    switch (message.type) {
      case 'command_request':
        this.handleCommandRequest(message)
        break
      case 'command_response':
        this.handleCommandResponse(message)
        break
      case 'log':
        this.handleLogMessage(message)
        break
    }
  }

  /**
   * Handle command request from gateway
   */
  private handleCommandRequest(message: GatewayMessage): void {
    const { sessionId, command, args } = message.payload as {
      sessionId: string
      command: string
      args?: Record<string, unknown>
    }

    const commandId = crypto.randomUUID()
    const gatewayCommand: GatewayCommand = {
      id: commandId,
      sessionId,
      command,
      args,
      status: 'pending',
      createdAt: new Date(),
    }

    this.pendingCommands.set(commandId, gatewayCommand)

    // Notify listeners about pending command
    this.notifyCommandUpdate(gatewayCommand)
  }

  /**
   * Handle command response from gateway
   */
  private handleCommandResponse(message: GatewayMessage): void {
    const { commandId, status, result, error } = message.payload as {
      commandId: string
      status: string
      result?: unknown
      error?: string
    }

    const command = this.pendingCommands.get(commandId)
    if (command) {
      command.status = status as GatewayCommand['status']
      command.result = result
      command.error = error
      command.completedAt = new Date()

      this.notifyCommandUpdate(command)
    }
  }

  /**
   * Handle log message from gateway
   */
  private handleLogMessage(message: GatewayMessage): void {
    // Forward log to listeners for streaming
    const logData = {
      type: 'log',
      level: message.payload.level as string,
      message: message.payload.message as string,
      timestamp: message.payload.timestamp as string,
      sessionId: message.payload.sessionId as string,
    }
    this.listeners.forEach((listener) => {
      try {
        listener({ type: 'log', id: crypto.randomUUID(), timestamp: Date.now(), payload: logData })
      } catch (error) {
        console.error('❌ Log listener error:', error)
      }
    })
  }

  /**
   * Send message to gateway
   */
  send(message: GatewayMessage): boolean {
    if (!this.ws || !this.connected) {
      console.error('❌ Gateway not connected')
      return false
    }

    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('❌ Failed to send message:', error)
      return false
    }
  }

  /**
   * Approve a pending command
   */
  approveCommand(commandId: string): boolean {
    const command = this.pendingCommands.get(commandId)
    if (!command) {
      return false
    }

    command.status = 'approved'
    command.approvedAt = new Date()

    const response: GatewayMessage = {
      type: 'command_approve',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        commandId,
        sessionId: command.sessionId,
        approved: true,
      },
    }

    this.send(response)
    this.notifyCommandUpdate(command)
    return true
  }

  /**
   * Reject a pending command
   */
  rejectCommand(commandId: string, reason?: string): boolean {
    const command = this.pendingCommands.get(commandId)
    if (!command) {
      return false
    }

    command.status = 'rejected'
    command.completedAt = new Date()

    const response: GatewayMessage = {
      type: 'command_reject',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        commandId,
        sessionId: command.sessionId,
        approved: false,
        reason,
      },
    }

    this.send(response)
    this.notifyCommandUpdate(command)
    return true
  }

  /**
   * Execute a command
   */
  async executeCommand(command: GatewayCommand): Promise<GatewayCommand> {
    command.status = 'executing'
    command.executedAt = new Date()
    this.notifyCommandUpdate(command)

    try {
      // Execute the command based on type
      switch (command.command) {
        case 'run_skill':
          command.result = await this.executeSkillCommand(command)
          break
        case 'stop_skill':
          command.result = await this.stopSkillCommand(command)
          break
        default:
          throw new Error(`Unknown command: ${command.command}`)
      }

      command.status = 'completed'
      command.completedAt = new Date()
    } catch (error) {
      command.status = 'failed'
      command.error = error instanceof Error ? error.message : 'Unknown error'
      command.completedAt = new Date()
    }

    this.notifyCommandUpdate(command)
    return command
  }

  /**
   * Execute a skill command
   */
  private async executeSkillCommand(command: GatewayCommand): Promise<unknown> {
    const { skillId, parameters } = command.args || {}
    
    // Get session for this command
    const session = this.sessionMap.get(command.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${command.sessionId}`)
    }

    // Send execute message to gateway
    const executeMessage: GatewayMessage = {
      type: 'execute',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        commandId: command.id,
        sessionId: command.sessionId,
        skillId,
        parameters,
      },
    }

    this.send(executeMessage)

    // Wait for completion (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout'))
      }, 60000)

      const checkStatus = () => {
        const updated = this.pendingCommands.get(command.id)
        if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
          clearTimeout(timeout)
          if (updated.status === 'completed') {
            resolve(updated.result)
          } else {
            reject(new Error(updated.error || 'Command failed'))
          }
        } else {
          setTimeout(checkStatus, 100)
        }
      }

      checkStatus()
    })
  }

  /**
   * Stop a skill command
   */
  private async stopSkillCommand(command: GatewayCommand): Promise<unknown> {
    const { skillId } = command.args || {}

    const stopMessage: GatewayMessage = {
      type: 'stop',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        commandId: command.id,
        sessionId: command.sessionId,
        skillId,
      },
    }

    this.send(stopMessage)

    return { stopped: true, skillId }
  }

  /**
   * Register a session
   */
  registerSession(session: ClientSession): void {
    this.sessionMap.set(session.id, session)
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId: string): void {
    this.sessionMap.delete(sessionId)
  }

  /**
   * Add message listener
   */
  addListener(listener: GatewayListener): void {
    this.listeners.add(listener)
  }

  /**
   * Remove message listener
   */
  removeListener(listener: GatewayListener): void {
    this.listeners.delete(listener)
  }

  /**
   * Notify listeners about command update
   */
  private notifyCommandUpdate(command: GatewayCommand): void {
    const updateMessage: GatewayMessage = {
      type: 'command_update',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: {
        commandId: command.id,
        status: command.status,
        sessionId: command.sessionId,
        command: command.command,
        createdAt: command.createdAt.toISOString(),
        approvedAt: command.approvedAt?.toISOString(),
        executedAt: command.executedAt?.toISOString(),
        completedAt: command.completedAt?.toISOString(),
        result: command.result,
        error: command.error,
      },
    }

    this.listeners.forEach((listener) => {
      try {
        listener(updateMessage)
      } catch (error) {
        console.error('❌ Listener notification error:', error)
      }
    })
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.connected && this.ws) {
        const pingMessage: GatewayMessage = {
          type: 'ping',
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          payload: {},
        }
        this.send(pingMessage)
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) {
      console.error('❌ Max reconnection attempts reached')
      return
    }

    const delay = Math.min(
      (this.config.reconnectDelay || 3000) * Math.pow(2, this.reconnectAttempts),
      30000
    )

    this.reconnectAttempts++
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (!this.connected) {
        this.connect()
      }
    }, delay)
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get pending commands
   */
  getPendingCommands(): GatewayCommand[] {
    return Array.from(this.pendingCommands.values()).filter(
      (cmd) => cmd.status === 'pending' || cmd.status === 'approved' || cmd.status === 'executing'
    )
  }

  /**
   * Get command by ID
   */
  getCommand(commandId: string): GatewayCommand | undefined {
    return this.pendingCommands.get(commandId)
  }

  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }
}

// Singleton instance
let gatewayInstance: OpenClawGatewayService | null = null

export function getGatewayService(): OpenClawGatewayService {
  if (!gatewayInstance) {
    const gatewayUrl = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789'
    gatewayInstance = new OpenClawGatewayService({ url: gatewayUrl })
  }
  return gatewayInstance
}

export function initializeGatewayService(config: GatewayConfig): OpenClawGatewayService {
  gatewayInstance = new OpenClawGatewayService(config)
  return gatewayInstance
}
