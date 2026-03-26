/**
 * Command Execution Route
 * POST /api/execute - Execute commands with approval mechanism
 */

import type { Request, Response, NextFunction } from 'express'
import { getGatewayService, type GatewayCommand } from '../services/openclaw-gateway.js'
import { getExecutionQueue } from '../services/execution-queue.js'
import { getSessionManager } from '../services/session-manager.js'

export interface ExecuteRequest {
  sessionId: string
  command: string
  args?: Record<string, unknown>
  priority?: number
  requireApproval?: boolean
}

export interface ExecuteResponse {
  success: boolean
  commandId: string
  status: string
  message?: string
  requiresApproval?: boolean
}

/**
 * Execute a command
 * POST /api/execute
 */
export async function executeCommand(
  req: Request<unknown, ExecuteResponse, ExecuteRequest>,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { sessionId, command, args, priority = 0, requireApproval = true } = req.body

    // Validate required fields
    if (!sessionId || !command) {
      res.status(400).json({
        success: false,
        commandId: '',
        status: 'error',
        message: 'Missing required fields: sessionId and command',
      })
      return
    }

    const queue = getExecutionQueue()
    const sessionManager = getSessionManager()

    // Check if session exists
    const sessionState = sessionManager.getSession(sessionId)
    if (!sessionState) {
      res.status(404).json({
        success: false,
        commandId: '',
        status: 'error',
        message: `Session not found: ${sessionId}`,
      })
      return
    }

    // Create command
    const commandId = crypto.randomUUID()
    const gatewayCommand: GatewayCommand = {
      id: commandId,
      sessionId,
      command,
      args,
      status: requireApproval ? 'pending' : 'approved',
      createdAt: new Date(),
    }

    // Add to session
    sessionManager.addCommand(sessionId, gatewayCommand)

    if (requireApproval) {
      // Command requires approval before execution
      res.status(202).json({
        success: true,
        commandId,
        status: 'pending',
        message: 'Command pending approval',
        requiresApproval: true,
      })
    } else {
      // Auto-approve and queue for execution
      const item = queue.enqueue(gatewayCommand, priority)

      if (!item) {
        res.status(503).json({
          success: false,
          commandId,
          status: 'error',
          message: 'Execution queue is full',
        })
        return
      }

      res.status(200).json({
        success: true,
        commandId,
        status: 'queued',
        message: 'Command queued for execution',
        requiresApproval: false,
      })
    }
  } catch (error) {
    console.error('❌ Execute command error:', error)
    res.status(500).json({
      success: false,
      commandId: '',
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * Approve a pending command
 * POST /api/execute/:commandId/approve
 */
export async function approveCommand(
  req: Request<{ commandId: string }>,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { commandId } = req.params

    const gateway = getGatewayService()
    const queue = getExecutionQueue()

    const command = gateway.getCommand(commandId)
    if (!command) {
      res.status(404).json({
        success: false,
        message: `Command not found: ${commandId}`,
      })
      return
    }

    // Approve the command
    gateway.approveCommand(commandId)

    // Queue for execution
    const item = queue.enqueue(command, 0)

    if (!item) {
      res.status(503).json({
        success: false,
        message: 'Execution queue is full',
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Command approved and queued for execution',
      commandId,
      status: 'queued',
    })
  } catch (error) {
    console.error('❌ Approve command error:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * Reject a pending command
 * POST /api/execute/:commandId/reject
 */
export async function rejectCommand(
  req: Request<{ commandId: string }, unknown, { reason?: string }>,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { commandId } = req.params
    const { reason } = req.body

    const gateway = getGatewayService()

    const command = gateway.getCommand(commandId)
    if (!command) {
      res.status(404).json({
        success: false,
        message: `Command not found: ${commandId}`,
      })
      return
    }

    // Reject the command
    gateway.rejectCommand(commandId, reason)

    res.status(200).json({
      success: true,
      message: 'Command rejected',
      commandId,
      status: 'rejected',
    })
  } catch (error) {
    console.error('❌ Reject command error:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * Get command status
 * GET /api/execute/:commandId
 */
export async function getCommandStatus(
  req: Request<{ commandId: string }>,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { commandId } = req.params

    const gateway = getGatewayService()
    const queue = getExecutionQueue()

    // Check in gateway first
    let command = gateway.getCommand(commandId)

    // Check in queue if not in gateway
    if (!command) {
      const queueItem = queue.getItem(commandId)
      if (queueItem) {
        command = queueItem.command
      }
    }

    if (!command) {
      res.status(404).json({
        success: false,
        message: `Command not found: ${commandId}`,
      })
      return
    }

    res.status(200).json({
      success: true,
      command: {
        id: command.id,
        sessionId: command.sessionId,
        command: command.command,
        args: command.args,
        status: command.status,
        createdAt: command.createdAt,
        approvedAt: command.approvedAt,
        executedAt: command.executedAt,
        completedAt: command.completedAt,
        result: command.result,
        error: command.error,
      },
    })
  } catch (error) {
    console.error('❌ Get command status error:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * List pending commands
 * GET /api/execute/pending
 */
export async function listPendingCommands(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const gateway = getGatewayService()
    const queue = getExecutionQueue()

    const pendingCommands = gateway.getPendingCommands()
    const queuedItems = queue.getQueuedItems()
    const runningItems = queue.getRunningItems()

    res.status(200).json({
      success: true,
      pending: pendingCommands,
      queued: queuedItems.map((item) => ({
        id: item.id,
        command: item.command.command,
        sessionId: item.command.sessionId,
        priority: item.priority,
        addedAt: item.addedAt,
      })),
      running: runningItems.map((item) => ({
        id: item.id,
        command: item.command.command,
        sessionId: item.command.sessionId,
        startedAt: item.startedAt,
      })),
    })
  } catch (error) {
    console.error('❌ List pending commands error:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * Get execution queue stats
 * GET /api/execute/stats
 */
export async function getExecutionStats(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const queue = getExecutionQueue()
    const stats = queue.getStats()

    res.status(200).json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('❌ Get execution stats error:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
