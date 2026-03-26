/**
 * Session Manager Service
 * Manages multiple concurrent sessions with log streaming and command tracking
 */

import type { ClientSession } from '../ag-ui-handler.js'
import type { GatewayCommand } from './openclaw-gateway.js'

export interface LogEntry {
  id: string
  sessionId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  source?: string
  data?: Record<string, unknown>
}

export interface SessionState {
  session: ClientSession
  logs: LogEntry[]
  commands: GatewayCommand[]
  status: 'idle' | 'running' | 'paused' | 'error'
  createdAt: Date
  lastActivity: Date
  metadata: Record<string, unknown>
}

export type LogListener = (entry: LogEntry) => void
export type SessionListener = (sessionId: string, state: SessionState) => void

export interface SessionManagerOptions {
  maxLogsPerSession?: number
  maxSessions?: number
  logRetentionMinutes?: number
}

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map()
  private logListeners: Set<LogListener> = new Set()
  private sessionListeners: Set<SessionListener> = new Set()
  private maxLogsPerSession: number
  private maxSessions: number
  private logRetentionMinutes: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(options: SessionManagerOptions = {}) {
    this.maxLogsPerSession = options.maxLogsPerSession ?? 1000
    this.maxSessions = options.maxSessions ?? 50
    this.logRetentionMinutes = options.logRetentionMinutes ?? 60

    // Start cleanup interval
    this.startCleanupInterval()
  }

  /**
   * Create a new session
   */
  createSession(clientSession: ClientSession): SessionState {
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest inactive session
      this.removeOldestSession()
    }

    const state: SessionState = {
      session: clientSession,
      logs: [],
      commands: [],
      status: 'idle',
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {},
    }

    this.sessions.set(clientSession.id, state)
    console.log(`📋 Created session ${clientSession.id}`)

    this.notifySessionUpdate(clientSession.id, state)
    return state
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Update session status
   */
  updateSessionStatus(sessionId: string, status: SessionState['status']): void {
    const state = this.sessions.get(sessionId)
    if (state) {
      state.status = status
      state.lastActivity = new Date()
      this.notifySessionUpdate(sessionId, state)
    }
  }

  /**
   * Add log entry to session
   */
  addLog(sessionId: string, entry: Omit<LogEntry, 'id' | 'sessionId' | 'timestamp'>): LogEntry {
    const state = this.sessions.get(sessionId)
    if (!state) {
      console.error(`❌ Session not found: ${sessionId}`)
      return {
        id: crypto.randomUUID(),
        sessionId,
        level: 'error',
        message: `Session not found: ${sessionId}`,
        timestamp: new Date().toISOString(),
      } as LogEntry
    }

    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      ...entry,
    }

    state.logs.push(logEntry)
    state.lastActivity = new Date()

    // Trim logs if exceeding limit
    if (state.logs.length > this.maxLogsPerSession) {
      state.logs = state.logs.slice(-this.maxLogsPerSession)
    }

    // Notify log listeners
    this.notifyLogEntry(logEntry)
    this.notifySessionUpdate(sessionId, state)

    return logEntry
  }

  /**
   * Get logs for a session
   */
  getLogs(sessionId: string, limit: number = 100, level?: LogEntry['level']): LogEntry[] {
    const state = this.sessions.get(sessionId)
    if (!state) {
      return []
    }

    let logs = state.logs
    if (level) {
      logs = logs.filter((log) => log.level === level)
    }

    return logs.slice(-limit)
  }

  /**
   * Get all recent logs (for streaming)
   */
  getAllRecentLogs(limit: number = 200): LogEntry[] {
    const allLogs: LogEntry[] = []
    for (const state of this.sessions.values()) {
      allLogs.push(...state.logs)
    }

    // Sort by timestamp and return most recent
    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Add command to session
   */
  addCommand(sessionId: string, command: GatewayCommand): void {
    const state = this.sessions.get(sessionId)
    if (!state) {
      console.error(`❌ Session not found: ${sessionId}`)
      return
    }

    state.commands.push(command)
    state.lastActivity = new Date()

    // Trim old commands
    if (state.commands.length > 100) {
      state.commands = state.commands.slice(-100)
    }

    this.notifySessionUpdate(sessionId, state)
  }

  /**
   * Get commands for a session
   */
  getCommands(sessionId: string): GatewayCommand[] {
    const state = this.sessions.get(sessionId)
    return state?.commands || []
  }

  /**
   * Update session metadata
   */
  updateMetadata(sessionId: string, metadata: Record<string, unknown>): void {
    const state = this.sessions.get(sessionId)
    if (state) {
      state.metadata = { ...state.metadata, ...metadata }
      state.lastActivity = new Date()
      this.notifySessionUpdate(sessionId, state)
    }
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): boolean {
    const state = this.sessions.get(sessionId)
    if (state) {
      this.sessions.delete(sessionId)
      console.log(`🗑️ Removed session ${sessionId}`)
      return true
    }
    return false
  }

  /**
   * Remove oldest inactive session
   */
  private removeOldestSession(): void {
    let oldestId: string | null = null
    let oldestTime = Date.now()

    for (const [id, state] of this.sessions.entries()) {
      const lastActivity = state.lastActivity.getTime()
      if (lastActivity < oldestTime) {
        oldestTime = lastActivity
        oldestId = id
      }
    }

    if (oldestId) {
      this.removeSession(oldestId)
    }
  }

  /**
   * Add log listener (for WebSocket streaming)
   */
  addLogListener(listener: LogListener): void {
    this.logListeners.add(listener)
  }

  /**
   * Remove log listener
   */
  removeLogListener(listener: LogListener): void {
    this.logListeners.delete(listener)
  }

  /**
   * Add session listener
   */
  addSessionListener(listener: SessionListener): void {
    this.sessionListeners.add(listener)
  }

  /**
   * Remove session listener
   */
  removeSessionListener(listener: SessionListener): void {
    this.sessionListeners.delete(listener)
  }

  /**
   * Notify log listeners
   */
  private notifyLogEntry(entry: LogEntry): void {
    this.logListeners.forEach((listener) => {
      try {
        listener(entry)
      } catch (error) {
        console.error('❌ Log listener error:', error)
      }
    })
  }

  /**
   * Notify session listeners
   */
  private notifySessionUpdate(sessionId: string, state: SessionState): void {
    this.sessionListeners.forEach((listener) => {
      try {
        listener(sessionId, state)
      } catch (error) {
        console.error('❌ Session listener error:', error)
      }
    })
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // Run every minute
  }

  /**
   * Cleanup old logs and sessions
   */
  private cleanup(): void {
    const now = Date.now()
    const retentionMs = this.logRetentionMinutes * 60 * 1000

    for (const [sessionId, state] of this.sessions.entries()) {
      // Remove old logs
      state.logs = state.logs.filter(
        (log) => now - new Date(log.timestamp).getTime() < retentionMs
      )

      // Remove inactive sessions (no activity for 2x retention time)
      if (now - state.lastActivity.getTime() > retentionMs * 2) {
        this.removeSession(sessionId)
      }
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }

  /**
   * Get active session count (running or paused)
   */
  getActiveSessionCount(): number {
    let count = 0
    for (const state of this.sessions.values()) {
      if (state.status === 'running' || state.status === 'paused') {
        count++
      }
    }
    return count
  }

  /**
   * Get sessions by status
   */
  getSessionsByStatus(status: SessionState['status']): SessionState[] {
    return Array.from(this.sessions.values()).filter((state) => state.status === status)
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear()
    console.log('🗑️ All sessions cleared')
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager()
  }
  return sessionManagerInstance
}

export function initializeSessionManager(options: SessionManagerOptions = {}): SessionManager {
  sessionManagerInstance = new SessionManager(options)
  return sessionManagerInstance
}
