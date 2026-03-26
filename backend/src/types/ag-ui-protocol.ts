/**
 * AG-UI Protocol Types
 * Based on CopilotKit AG-UI Protocol specification
 */

// Message types for AG-UI communication
export type MessageType =
  | 'initialize'
  | 'message'
  | 'chunk'
  | 'data'
  | 'error'
  | 'done'
  | 'ping'
  | 'pong'

// Base message interface
export interface AGUIMessage {
  type: MessageType
  id: string
  timestamp: number
}

// Initialize message from client
export interface InitializeMessage extends AGUIMessage {
  type: 'initialize'
  payload: {
    clientVersion: string
    capabilities: string[]
  }
}

// Text message from client
export interface TextMessage extends AGUIMessage {
  type: 'message'
  payload: {
    content: string
    metadata?: Record<string, unknown>
  }
}

// Streaming chunk response
export interface ChunkMessage extends AGUIMessage {
  type: 'chunk'
  payload: {
    content: string
    streamId: string
  }
}

// Data message for structured responses
export interface DataMessage extends AGUIMessage {
  type: 'data'
  payload: {
    data: unknown
    streamId?: string
  }
}

// Error message
export interface ErrorMessage extends AGUIMessage {
  type: 'error'
  payload: {
    error: string
    code?: string
    details?: Record<string, unknown>
  }
}

// Done message (stream complete)
export interface DoneMessage extends AGUIMessage {
  type: 'done'
  payload: {
    streamId?: string
    metadata?: Record<string, unknown>
  }
}

// Ping/Pong for keepalive
export interface PingMessage extends AGUIMessage {
  type: 'ping'
}

export interface PongMessage extends AGUIMessage {
  type: 'pong'
  payload: {
    latency?: number
  }
}

// Union type for all message types
export type AGUIMessageUnion =
  | InitializeMessage
  | TextMessage
  | ChunkMessage
  | DataMessage
  | ErrorMessage
  | DoneMessage
  | PingMessage
  | PongMessage

// Type guard functions
export function isInitializeMessage(msg: AGUIMessageUnion): msg is InitializeMessage {
  return msg.type === 'initialize'
}

export function isTextMessage(msg: AGUIMessageUnion): msg is TextMessage {
  return msg.type === 'message'
}

export function isChunkMessage(msg: AGUIMessageUnion): msg is ChunkMessage {
  return msg.type === 'chunk'
}

export function isDataMessage(msg: AGUIMessageUnion): msg is DataMessage {
  return msg.type === 'data'
}

export function isErrorMessage(msg: AGUIMessageUnion): msg is ErrorMessage {
  return msg.type === 'error'
}

export function isDoneMessage(msg: AGUIMessageUnion): msg is DoneMessage {
  return msg.type === 'done'
}

export function isPingMessage(msg: AGUIMessageUnion): msg is PingMessage {
  return msg.type === 'ping'
}

export function isPongMessage(msg: AGUIMessageUnion): msg is PongMessage {
  return msg.type === 'pong'
}

// Message creator functions
export function createMessage<T extends MessageType>(
  type: T,
  payload?: unknown
): AGUIMessageUnion {
  const baseMessage = {
    type,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }

  if (payload !== undefined) {
    return { ...baseMessage, payload } as AGUIMessageUnion
  }

  return baseMessage as AGUIMessageUnion
}

export function createInitializeMessage(clientVersion: string, capabilities: string[]): InitializeMessage {
  return {
    type: 'initialize',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      clientVersion,
      capabilities,
    },
  }
}

export function createTextMessage(content: string, metadata?: Record<string, unknown>): TextMessage {
  return {
    type: 'message',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      content,
      metadata,
    },
  }
}

export function createChunkMessage(content: string, streamId: string): ChunkMessage {
  return {
    type: 'chunk',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      content,
      streamId,
    },
  }
}

export function createDataMessage(data: unknown, streamId?: string): DataMessage {
  return {
    type: 'data',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      data,
      streamId,
    },
  }
}

export function createErrorMessage(error: string, code?: string, details?: Record<string, unknown>): ErrorMessage {
  return {
    type: 'error',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      error,
      code,
      details,
    },
  }
}

export function createDoneMessage(streamId?: string, metadata?: Record<string, unknown>): DoneMessage {
  return {
    type: 'done',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      streamId,
      metadata,
    },
  }
}

export function createPingMessage(): PingMessage {
  return {
    type: 'ping',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }
}

export function createPongMessage(latency?: number): PongMessage {
  return {
    type: 'pong',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    payload: {
      latency,
    },
  }
}
