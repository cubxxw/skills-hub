/**
 * AG-UI Skill Platform - Backend API Server
 * Main entry point for Express + WebSocket server
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer, type Server } from 'http'
import type { Express, Request, Response, NextFunction } from 'express'
import { helloWorld } from './routes/health.js'
import { getSkills, getSkillById, getSkillStatus } from './routes/skills.js'
import { uploadSkill, importFromGitHub, handleMulterError, upload } from './routes/skill-upload.js'
import { WSServer } from './websocket.js'
import { AGUIEventHandler } from './ag-ui-handler.js'
import type { ClientSession } from './ag-ui-handler.js'
import type { InitializeMessage, TextMessage } from './types/ag-ui-protocol.js'
import { createDataMessage } from './types/ag-ui-protocol.js'
import {
  executeCommand,
  approveCommand,
  rejectCommand,
  getCommandStatus,
  listPendingCommands,
  getExecutionStats,
} from './routes/execute.js'
import { getLogStreamHandler } from './routes/log-stream.js'
import type { LogEntry } from './services/session-manager.js'
import {
  initializeGatewayService,
} from './services/openclaw-gateway.js'
import { initializeExecutionQueue } from './services/execution-queue.js'
import { initializeSessionManager } from './services/session-manager.js'
import { initializeValidationQueue } from './services/validation-queue.js'
import {
  uploadAndValidate,
  getValidationJob,
  getValidationStats,
  getValidationHistory,
  cancelValidation,
  getValidationScore,
  getValidationReport,
  clearValidationCache,
  uploadMiddleware,
} from './routes/validation.js'
import { architectureRoutes } from './routes/architecture.js'
import {
  publishSkill,
  queueRelease,
  getReleaseJob,
  cancelReleaseJob,
  getReleaseHistory,
  getSkillReleaseHistory,
  getReleaseStats,
  getReleaseQueueStatus,
  validateSkillMd,
  previewRelease,
  getVersionHistory,
  getCurrentVersion,
  getLatestVersion,
  bumpVersion,
  suggestVersion,
  rollbackVersion,
  getChangelog,
  generateChangelog,
  getSkillMetadata,
} from './routes/release.js'

const PORT = process.env.PORT || 4000
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789'

const app: Express = express()
const httpServer: Server = createServer(app)

// Initialize services
const gatewayService = initializeGatewayService({ url: GATEWAY_URL })
const executionQueue = initializeExecutionQueue({ maxConcurrent: 3 })
const sessionManager = initializeSessionManager({ maxLogsPerSession: 1000 })
const validationQueue = initializeValidationQueue({ maxConcurrent: 2, defaultTimeout: 300000 })

// Expose validation queue for potential external access
void validationQueue // Prevent unused variable warning

// Initialize AG-UI Event Handler with custom handlers
const eventHandler = new AGUIEventHandler({
  onInitialize: async (session: ClientSession, message: InitializeMessage): Promise<{ success: boolean; response: ReturnType<typeof createDataMessage> }> => {
    console.log(`🔐 Client ${session.id} initialized with version ${message.payload.clientVersion}`)

    // Register session with gateway and session manager
    gatewayService.registerSession(session)
    sessionManager.createSession(session)

    return {
      success: true,
      response: createDataMessage({
        status: 'initialized',
        serverVersion: '0.2.0',
        capabilities: ['skills', 'validation', 'remote-control', 'log-stream'],
        sessionId: session.id,
      }),
    }
  },
  onMessage: async (session: ClientSession, message: TextMessage): Promise<{ success: boolean; response: ReturnType<typeof createDataMessage> }> => {
    console.log(`💬 Message from ${session.id}: ${message.payload.content.substring(0, 50)}...`)

    // Add log entry for the message
    sessionManager.addLog(session.id, {
      level: 'info',
      message: `Received: ${message.payload.content.substring(0, 100)}`,
      source: 'ag-ui',
    })

    // Process message and send to gateway if connected
    return {
      success: true,
      response: createDataMessage({
        status: 'processed',
        messageId: message.id,
        contentLength: message.payload.content.length,
        processedAt: new Date().toISOString(),
      }),
    }
  },
})

// Initialize WebSocket server (will attach to httpServer on port 4000)
const wsServer = new WSServer({}, eventHandler)

// Initialize log stream handler
const logStreamHandler = getLogStreamHandler()

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('❌ Error:', err.message)

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  })
})

// Routes
app.get('/', (_req, res) => {
  res.json({
    name: 'AG-UI Skill Platform API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      skills: '/api/skills',
      websocket: `/ws (port ${WS_PORT})`,
    },
  })
})

// Health check endpoint
app.get('/api/health', helloWorld)

// Skills endpoints
app.get('/api/skills', getSkills)
app.get('/api/skills/:id', getSkillById)
app.get('/api/skills/status/:id', getSkillStatus)

// Skill upload endpoints
app.post('/api/skills/upload', upload.single('skill'), uploadSkill, handleMulterError)
app.post('/api/skills/import', importFromGitHub)

// Gateway status endpoint
app.get('/api/gateway/status', (_req, res) => {
  const status = wsServer.getGatewayStatus()
  res.json({
    connected: status.connected,
    url: status.url,
    reconnectAttempts: status.reconnectAttempts,
    lastReconnectAttempt: status.lastReconnectAttempt,
    clientCount: wsServer.getClientCount(),
    timestamp: new Date().toISOString(),
  })
})

// Command execution endpoints
app.post('/api/execute', executeCommand)
app.post('/api/execute/:commandId/approve', approveCommand)
app.post('/api/execute/:commandId/reject', rejectCommand)
app.get('/api/execute/:commandId', getCommandStatus)
app.get('/api/execute/pending', listPendingCommands)
app.get('/api/execute/stats', getExecutionStats)

// Session management endpoints
app.get('/api/sessions', (_req, res) => {
  const sessions = sessionManager.getAllSessions()
  res.json({
    success: true,
    sessions: sessions.map((s) => ({
      id: s.session.id,
      status: s.status,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      logCount: s.logs.length,
      commandCount: s.commands.length,
    })),
  })
})

app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId)
  if (!session) {
    res.status(404).json({ success: false, message: 'Session not found' })
    return
  }
  res.json({
    success: true,
    session: {
      id: session.session.id,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      metadata: session.metadata,
    },
  })
})

app.get('/api/sessions/:sessionId/logs', (req, res) => {
  const { limit = 100, level } = req.query
  const logs = sessionManager.getLogs(
    req.params.sessionId,
    parseInt(limit as string, 10),
    level as LogEntry['level']
  )
  res.json({ success: true, logs })
})

app.get('/api/sessions/:sessionId/commands', (req, res) => {
  const commands = sessionManager.getCommands(req.params.sessionId)
  res.json({ success: true, commands })
})

app.delete('/api/sessions/:sessionId', (req, res) => {
  const removed = sessionManager.removeSession(req.params.sessionId)
  if (removed) {
    res.json({ success: true, message: 'Session removed' })
  } else {
    res.status(404).json({ success: false, message: 'Session not found' })
  }
})

// Execution queue endpoints
app.get('/api/queue/stats', (_req, res) => {
  const stats = executionQueue.getStats()
  res.json({ success: true, stats })
})

app.get('/api/queue/queued', (_req, res) => {
  const items = executionQueue.getQueuedItems()
  res.json({ success: true, items })
})

app.get('/api/queue/running', (_req, res) => {
  const items = executionQueue.getRunningItems()
  res.json({ success: true, items })
})

app.post('/api/queue/:itemId/cancel', (req, res) => {
  const cancelled = executionQueue.cancel(req.params.itemId)
  if (cancelled) {
    res.json({ success: true, message: 'Execution cancelled' })
  } else {
    res.status(404).json({ success: false, message: 'Item not found' })
  }
})

// Validation endpoints
app.post('/api/validation/validate', uploadMiddleware, uploadAndValidate)
app.get('/api/validation/job/:id', getValidationJob)
app.get('/api/validation/stats', getValidationStats)
app.get('/api/validation/history', getValidationHistory)
app.post('/api/validation/cancel/:id', cancelValidation)
app.get('/api/validation/score/:jobId', getValidationScore)
app.get('/api/validation/report/:jobId', getValidationReport)
app.delete('/api/validation/cache', clearValidationCache)

// Architecture analysis endpoints
app.use('/api/architecture', architectureRoutes)

// Release endpoints
app.post('/api/release', publishSkill)
app.post('/api/release/queue', queueRelease)
app.get('/api/release/job/:id', getReleaseJob)
app.post('/api/release/job/:id/cancel', cancelReleaseJob)
app.get('/api/release/history', getReleaseHistory)
app.get('/api/release/history/:skillName', getSkillReleaseHistory)
app.get('/api/release/stats', getReleaseStats)
app.get('/api/release/queue', getReleaseQueueStatus)
app.post('/api/release/validate', validateSkillMd)
app.get('/api/release/preview', previewRelease)
app.get('/api/version/:skillName', getVersionHistory)
app.get('/api/version/:skillName/current', getCurrentVersion)
app.get('/api/version/:skillName/latest', getLatestVersion)
app.post('/api/version/bump', bumpVersion)
app.post('/api/version/suggest', suggestVersion)
app.post('/api/version/rollback', rollbackVersion)
app.get('/api/changelog/:skillName', getChangelog)
app.post('/api/changelog/generate', generateChangelog)
app.get('/api/release/metadata', getSkillMetadata)

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📝 API Health: http://localhost:${PORT}/api/health`)
  console.log(`📚 Skills List: http://localhost:${PORT}/api/skills`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`📋 Log Stream: ws://localhost:${PORT}/ws/logs`)

  // Attach WebSocket server to HTTP server (single port architecture)
  wsServer.attach(httpServer)

  // Setup log stream WebSocket handler
  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url
    if (url === '/ws/logs') {
      // Handle log stream WebSocket upgrade
      wsServer.server?.handleUpgrade(request, socket, head, (ws) => {
        logStreamHandler.handleConnection(ws, request)
      })
    }
    // Main WS server handles /ws path
    else if (url === '/ws') {
      wsServer.server?.handleUpgrade(request, socket, head, (ws) => {
        wsServer.server?.emit('connection', ws, request)
      })
    }
  })

  // Connect to OpenClaw Gateway
  wsServer.connectToGateway(GATEWAY_URL)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...')

  wsServer.close()
  httpServer.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...')

  wsServer.close()
  httpServer.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

// 404 handler - MUST be last after all routes
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not found',
    path: _req.path,
    timestamp: new Date().toISOString(),
  })
})

export default app
