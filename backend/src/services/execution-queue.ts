/**
 * Execution Queue Service
 * Manages skill execution queue with priority and concurrency control
 */

import type { GatewayCommand } from './openclaw-gateway.js'

export interface QueueItem {
  id: string
  command: GatewayCommand
  priority: number
  addedAt: Date
  startedAt?: Date
  completedAt?: Date
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  retryCount: number
  maxRetries: number
}

export interface QueueStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  avgExecutionTime: number
}

export interface ExecutionQueueOptions {
  maxConcurrent?: number
  maxQueueSize?: number
  defaultMaxRetries?: number
}

export type QueueListener = (item: QueueItem) => void

export class ExecutionQueue {
  private queue: QueueItem[] = []
  private running: Map<string, QueueItem> = new Map()
  private completed: QueueItem[] = []
  private maxConcurrent: number
  private maxQueueSize: number
  private defaultMaxRetries: number
  private processing: boolean = false
  private listeners: Set<QueueListener> = new Set()
  private executionTimes: number[] = []

  constructor(options: ExecutionQueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.maxQueueSize = options.maxQueueSize ?? 100
    this.defaultMaxRetries = options.defaultMaxRetries ?? 3
  }

  /**
   * Add item to execution queue
   */
  enqueue(command: GatewayCommand, priority: number = 0): QueueItem | null {
    if (this.queue.length >= this.maxQueueSize) {
      console.error('❌ Queue is full')
      return null
    }

    const item: QueueItem = {
      id: command.id,
      command,
      priority,
      addedAt: new Date(),
      status: 'queued',
      retryCount: 0,
      maxRetries: this.defaultMaxRetries,
    }

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex((existing) => existing.priority < priority)
    if (insertIndex === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(insertIndex, 0, item)
    }

    console.log(`📋 Enqueued command ${command.id} with priority ${priority}`)
    this.notifyListeners(item)

    // Start processing if not already running
    this.processQueue()

    return item
  }

  /**
   * Process queue items
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true

    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) {
        break
      }

      // Start executing
      this.running.set(item.id, item)
      item.status = 'running'
      item.startedAt = new Date()
      this.notifyListeners(item)

      // Execute without awaiting to allow concurrent execution
      this.executeItem(item).catch((error) => {
        console.error(`❌ Execution error for ${item.id}:`, error)
      })
    }

    this.processing = false
  }

  /**
   * Execute a queue item
   */
  private async executeItem(item: QueueItem): Promise<void> {
    const startTime = Date.now()

    try {
      // Import gateway service dynamically to avoid circular dependency
      const { getGatewayService } = await import('./openclaw-gateway.js')
      const gateway = getGatewayService()

      await gateway.executeCommand(item.command)

      item.status = 'completed'
      item.completedAt = new Date()

      // Track execution time
      const executionTime = Date.now() - startTime
      this.executionTimes.push(executionTime)
      if (this.executionTimes.length > 100) {
        this.executionTimes.shift()
      }
    } catch (error) {
      console.error(`❌ Execution failed for ${item.id}:`, error)

      // Retry logic
      if (item.retryCount < item.maxRetries) {
        item.retryCount++
        item.status = 'queued'
        item.startedAt = undefined
        this.queue.push(item)
        this.notifyListeners(item)
        this.processQueue()
        return
      }

      item.status = 'failed'
      item.completedAt = new Date()
      item.command.error = error instanceof Error ? error.message : 'Unknown error'
    }

    // Move to completed
    this.running.delete(item.id)
    this.completed.push(item)
    this.notifyListeners(item)

    // Keep only last 100 completed items
    if (this.completed.length > 100) {
      this.completed.shift()
    }

    // Process next item
    this.processQueue()
  }

  /**
   * Cancel a queued or running item
   */
  cancel(itemId: string): boolean {
    // Check running items
    const runningItem = this.running.get(itemId)
    if (runningItem) {
      runningItem.status = 'cancelled'
      runningItem.completedAt = new Date()
      this.running.delete(itemId)
      this.completed.push(runningItem)
      this.notifyListeners(runningItem)
      return true
    }

    // Check queued items
    const queueIndex = this.queue.findIndex((item) => item.id === itemId)
    if (queueIndex !== -1) {
      const item = this.queue[queueIndex]
      item.status = 'cancelled'
      item.completedAt = new Date()
      this.queue.splice(queueIndex, 1)
      this.completed.push(item)
      this.notifyListeners(item)
      return true
    }

    return false
  }

  /**
   * Get queue item by ID
   */
  getItem(itemId: string): QueueItem | undefined {
    return (
      this.running.get(itemId) ||
      this.queue.find((item) => item.id === itemId) ||
      this.completed.find((item) => item.id === itemId)
    )
  }

  /**
   * Get all queued items
   */
  getQueuedItems(): QueueItem[] {
    return [...this.queue]
  }

  /**
   * Get all running items
   */
  getRunningItems(): QueueItem[] {
    return Array.from(this.running.values())
  }

  /**
   * Get completed items
   */
  getCompletedItems(limit: number = 50): QueueItem[] {
    return this.completed.slice(-limit)
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const total = this.queue.length + this.running.size + this.completed.length
    const queued = this.queue.length
    const running = this.running.size
    const completed = this.completed.filter((item) => item.status === 'completed').length
    const failed = this.completed.filter((item) => item.status === 'failed').length

    const avgExecutionTime =
      this.executionTimes.length > 0
        ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
        : 0

    return {
      total,
      queued,
      running,
      completed,
      failed,
      avgExecutionTime,
    }
  }

  /**
   * Clear completed items
   */
  clearCompleted(): number {
    const count = this.completed.length
    this.completed = []
    return count
  }

  /**
   * Add queue listener
   */
  addListener(listener: QueueListener): void {
    this.listeners.add(listener)
  }

  /**
   * Remove queue listener
   */
  removeListener(listener: QueueListener): void {
    this.listeners.delete(listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(item: QueueItem): void {
    this.listeners.forEach((listener) => {
      try {
        listener(item)
      } catch (error) {
        console.error('❌ Queue listener error:', error)
      }
    })
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length
  }

  /**
   * Get running count
   */
  get runningCount(): number {
    return this.running.size
  }
}

// Singleton instance
let queueInstance: ExecutionQueue | null = null

export function getExecutionQueue(): ExecutionQueue {
  if (!queueInstance) {
    queueInstance = new ExecutionQueue({
      maxConcurrent: 3,
      maxQueueSize: 100,
      defaultMaxRetries: 3,
    })
  }
  return queueInstance
}

export function initializeExecutionQueue(options: ExecutionQueueOptions = {}): ExecutionQueue {
  queueInstance = new ExecutionQueue(options)
  return queueInstance
}
