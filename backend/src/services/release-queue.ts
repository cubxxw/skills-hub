/**
 * Release Queue Service
 * Manages asynchronous release jobs
 * - Queue management
 * - Progress tracking
 * - Job prioritization
 * - Concurrent release handling
 */

import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type { ReleaseRequest, ReleaseResponse, ReleaseStatus } from './clawhub-publisher.js'
import type { ClawHubPublisher } from './clawhub-publisher.js'

export interface ReleaseJob {
  id: string
  request: ReleaseRequest
  status: ReleaseStatus
  priority: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  progress: number
  response?: ReleaseResponse
  error?: string
  retryCount: number
  maxRetries: number
}

export interface QueueStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  averageWaitTime: number
  averageProcessingTime: number
}

export interface QueueOptions {
  concurrency?: number
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

const DEFAULT_OPTIONS: QueueOptions = {
  concurrency: 3,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 300000, // 5 minutes
}

export class ReleaseQueue extends EventEmitter {
  private queue: ReleaseJob[] = []
  private activeJobs: Map<string, ReleaseJob> = new Map()
  private completedJobs: Map<string, ReleaseJob> = new Map()
  private options: QueueOptions
  private publisher: ClawHubPublisher
  private processing: boolean = false
  private activeCount: number = 0

  constructor(publisher: ClawHubPublisher, options?: Partial<QueueOptions>) {
    super()
    this.publisher = publisher
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Add release job to queue
   */
  enqueue(request: ReleaseRequest, priority: number = 0): string {
    const job: ReleaseJob = {
      id: randomUUID(),
      request,
      status: 'pending',
      priority,
      createdAt: new Date(),
      progress: 0,
      retryCount: 0,
      maxRetries: this.options.maxRetries || 3,
    }

    this.queue.push(job)

    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority)

    this.emit('job:queued', job)

    // Start processing if not already running
    this.processQueue()

    return job.id
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && this.activeCount < (this.options.concurrency || 3)) {
      const job = this.queue.shift()
      if (!job) break

      this.activeJobs.set(job.id, job)
      this.activeCount++

      // Process job asynchronously
      this.processJob(job).catch(error => {
        console.error(`Job ${job.id} failed:`, error)
      })
    }

    this.processing = false
  }

  /**
   * Process individual job
   */
  private async processJob(job: ReleaseJob): Promise<void> {
    job.status = 'processing' as ReleaseStatus
    job.startedAt = new Date()
    job.progress = 10

    this.emit('job:started', job)

    try {
      // Update progress through stages
      const progressInterval = setInterval(() => {
        if (job.progress < 90) {
          job.progress += 10
          this.emit('job:progress', { jobId: job.id, progress: job.progress })
        }
      }, 500)

      // Publish to ClawHub
      const response = await this.publisher.publish(job.request)

      clearInterval(progressInterval)
      job.progress = 100
      job.response = response
      job.completedAt = new Date()

      if (response.status === 'published') {
        job.status = 'completed' as ReleaseStatus
        this.emit('job:completed', job)
      } else if (response.status === 'failed') {
        job.status = 'failed' as ReleaseStatus
        job.error = response.message
        this.emit('job:failed', job)
        await this.handleRetry(job)
      } else {
        job.status = response.status
        this.emit('job:completed', job)
      }
    } catch (error) {
      job.status = 'failed' as ReleaseStatus
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()
      this.emit('job:failed', job)

      await this.handleRetry(job)
    } finally {
      this.activeJobs.delete(job.id)
      this.completedJobs.set(job.id, job)
      this.activeCount--

      // Continue processing queue
      this.processQueue()
    }
  }

  /**
   * Handle job retry
   */
  private async handleRetry(job: ReleaseJob): Promise<void> {
    if (job.retryCount < job.maxRetries) {
      job.retryCount++
      job.status = 'pending'
      job.error = undefined
      job.startedAt = undefined
      job.completedAt = undefined
      job.progress = 0

      const delay = (this.options.retryDelay || 5000) * job.retryCount

      this.emit('job:retry', { job, delay, retryCount: job.retryCount })

      await new Promise(resolve => setTimeout(resolve, delay))
      this.queue.push(job)

      this.processQueue()
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ReleaseJob | undefined {
    return (
      this.activeJobs.get(jobId) ||
      this.completedJobs.get(jobId) ||
      this.queue.find(j => j.id === jobId)
    )
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ReleaseStatus | undefined {
    const job = this.getJob(jobId)
    return job?.status
  }

  /**
   * Get job progress
   */
  getJobProgress(jobId: string): number {
    const job = this.getJob(jobId)
    return job?.progress || 0
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    // Check active jobs
    const activeJob = this.activeJobs.get(jobId)
    if (activeJob) {
      activeJob.status = 'cancelled' as ReleaseStatus
      activeJob.completedAt = new Date()
      this.activeJobs.delete(jobId)
      this.completedJobs.set(jobId, activeJob)
      this.activeCount--
      this.emit('job:cancelled', activeJob)
      return true
    }

    // Check queued jobs
    const queuedIndex = this.queue.findIndex(j => j.id === jobId)
    if (queuedIndex !== -1) {
      const job = this.queue[queuedIndex]
      job.status = 'cancelled' as ReleaseStatus
      job.completedAt = new Date()
      this.queue.splice(queuedIndex, 1)
      this.completedJobs.set(jobId, job)
      this.emit('job:cancelled', job)
      return true
    }

    return false
  }

  /**
   * Get queue stats
   */
  getStats(): QueueStats {
    const allJobs = [...this.queue, ...Array.from(this.activeJobs.values()), ...Array.from(this.completedJobs.values())]

    const pending = this.queue.length
    const processing = this.activeJobs.size
    const completed = Array.from(this.completedJobs.values()).filter(j => j.response?.status === 'published').length
    const failed = Array.from(this.completedJobs.values()).filter(j => j.status === 'failed').length
    const cancelled = Array.from(this.completedJobs.values()).filter(j => j.status === 'cancelled').length

    // Calculate average wait time (time from created to started)
    const completedWithStart = Array.from(this.completedJobs.values()).filter(j => j.startedAt)
    const waitTimes = completedWithStart.map(j => j.startedAt!.getTime() - j.createdAt.getTime())
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0

    // Calculate average processing time
    const completedWithDuration = Array.from(this.completedJobs.values()).filter(j => j.startedAt && j.completedAt)
    const processingTimes = completedWithDuration.map(j => j.completedAt!.getTime() - j.startedAt!.getTime())
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0

    return {
      total: allJobs.length,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      averageWaitTime,
      averageProcessingTime,
    }
  }

  /**
   * Get pending jobs
   */
  getPendingJobs(): ReleaseJob[] {
    return [...this.queue].sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): ReleaseJob[] {
    return Array.from(this.activeJobs.values())
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(limit: number = 50): ReleaseJob[] {
    return Array.from(this.completedJobs.values())
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, limit)
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(olderThan?: Date): number {
    let cleared = 0

    for (const [id, job] of this.completedJobs.entries()) {
      if (!olderThan || (job.completedAt && job.completedAt < olderThan)) {
        this.completedJobs.delete(id)
        cleared++
      }
    }

    return cleared
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = false
    this.emit('queue:paused')
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.processQueue()
    this.emit('queue:resumed')
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0 && this.activeJobs.size === 0
  }

  /**
   * Wait for queue to drain
   */
  async drain(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.isEmpty) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }
}

// Singleton instance
let releaseQueue: ReleaseQueue | null = null

export function getReleaseQueue(publisher?: ClawHubPublisher, options?: Partial<QueueOptions>): ReleaseQueue {
  if (!releaseQueue) {
    if (!publisher) {
      throw new Error('ReleaseQueue requires a ClawHubPublisher instance')
    }
    releaseQueue = new ReleaseQueue(publisher, options)
  }
  return releaseQueue
}

export function initializeReleaseQueue(publisher: ClawHubPublisher, options?: Partial<QueueOptions>): ReleaseQueue {
  releaseQueue = new ReleaseQueue(publisher, options)
  return releaseQueue
}
