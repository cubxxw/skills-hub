/**
 * Validation Queue Service
 * Manages skill validation queue with priority and timeout handling
 * - Queue management with priorities
 * - Timeout handling (5 minutes default)
 * - Progress tracking
 * - Result caching
 */

import { randomUUID } from 'crypto'
import { getAIReviewer, type AIReviewResult } from './ai-reviewer.js'
import { getScoringService, type ValidationScore } from './scoring-service.js'
import { getStaticAnalyzer, type StaticAnalysisResult } from '../validators/static-analyzer.js'

export interface ValidationJob {
  id: string
  skillName: string
  skillVersion: string
  files: Map<string, Buffer>
  priority: number
  status: ValidationStatus
  addedAt: Date
  startedAt?: Date
  completedAt?: Date
  timeoutAt?: Date
  result?: ValidationResult
  error?: string
  progress: number
  retryCount: number
  maxRetries: number
}

export type ValidationStatus =
  | 'queued'
  | 'validating'
  | 'static-analysis'
  | 'ai-review'
  | 'scoring'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'

export interface ValidationResult {
  id: string
  skillName: string
  skillVersion: string
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  passed: boolean
  score: ValidationScore
  aiReview: AIReviewResult
  staticAnalysis: StaticAnalysisResult
  duration: number
}

export interface ValidationQueueStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  timeout: number
  avgDuration: number
}

export interface ValidationQueueOptions {
  maxConcurrent?: number
  maxQueueSize?: number
  defaultTimeout?: number // milliseconds
  defaultMaxRetries?: number
  resultCacheSize?: number
}

export type ValidationListener = (job: ValidationJob) => void

const DEFAULT_TIMEOUT = 300000 // 5 minutes

export class ValidationQueue {
  private queue: ValidationJob[] = []
  private running: Map<string, ValidationJob> = new Map()
  private completed: ValidationJob[] = []
  private resultCache: Map<string, ValidationResult> = new Map()
  
  private maxConcurrent: number
  private maxQueueSize: number
  private defaultTimeout: number
  private defaultMaxRetries: number
  private resultCacheSize: number
  
  private processing: boolean = false
  private listeners: Set<ValidationListener> = new Set()
  private durations: number[] = []

  private aiReviewer = getAIReviewer()
  private scoringService = getScoringService()
  private staticAnalyzer = getStaticAnalyzer()

  constructor(options: ValidationQueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2
    this.maxQueueSize = options.maxQueueSize ?? 50
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_TIMEOUT
    this.defaultMaxRetries = options.defaultMaxRetries ?? 1
    this.resultCacheSize = options.resultCacheSize ?? 100
  }

  /**
   * Add validation job to queue
   */
  enqueue(
    skillName: string,
    skillVersion: string,
    files: Map<string, Buffer>,
    priority: number = 0
  ): ValidationJob | null {
    if (this.queue.length + this.running.size >= this.maxQueueSize) {
      console.error('❌ Validation queue is full')
      return null
    }

    // Check cache for existing result
    const cacheKey = `${skillName}@${skillVersion}`
    const cachedResult = this.resultCache.get(cacheKey)
    if (cachedResult) {
      console.log(`✅ Using cached validation result for ${cacheKey}`)
      const job: ValidationJob = {
        id: randomUUID(),
        skillName,
        skillVersion,
        files,
        priority,
        status: 'completed',
        addedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        result: cachedResult,
        progress: 100,
        retryCount: 0,
        maxRetries: this.defaultMaxRetries,
      }
      this.completed.push(job)
      this.notifyListeners(job)
      return job
    }

    const job: ValidationJob = {
      id: randomUUID(),
      skillName,
      skillVersion,
      files,
      priority,
      status: 'queued',
      addedAt: new Date(),
      progress: 0,
      retryCount: 0,
      maxRetries: this.defaultMaxRetries,
    }

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex((existing) => existing.priority < priority)
    if (insertIndex === -1) {
      this.queue.push(job)
    } else {
      this.queue.splice(insertIndex, 0, job)
    }

    console.log(`📋 Enqueued validation job ${job.id} for ${skillName}@${skillVersion} with priority ${priority}`)
    this.notifyListeners(job)

    // Start processing if not already running
    this.processQueue()

    return job
  }

  /**
   * Process queue jobs
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true

    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift()
      if (!job) {
        break
      }

      // Start validation
      this.running.set(job.id, job)
      job.status = 'validating'
      job.startedAt = new Date()
      job.timeoutAt = new Date(Date.now() + this.defaultTimeout)
      this.notifyListeners(job)

      // Execute validation without awaiting to allow concurrent execution
      this.validateJob(job).catch((error) => {
        console.error(`❌ Validation error for ${job.id}:`, error)
      })
    }

    this.processing = false
  }

  /**
   * Execute validation for a job
   */
  private async validateJob(job: ValidationJob): Promise<void> {
    const startTime = Date.now()

    try {
      // Step 1: Static Analysis
      job.status = 'static-analysis'
      job.progress = 10
      this.notifyListeners(job)

      const staticAnalysis = await this.staticAnalyzer.analyze(job.files)
      
      job.progress = 40
      this.notifyListeners(job)

      // Check if static analysis found critical issues
      const hasCriticalIssues = staticAnalysis.errors.some(
        e => e.severity === 'critical' || e.severity === 'high'
      )

      // Step 2: AI Review (skip if critical static issues found)
      let aiReview: AIReviewResult
      if (hasCriticalIssues) {
        console.log(`⚠️ Skipping AI review due to critical static issues for ${job.skillName}`)
        aiReview = {
          id: randomUUID(),
          skillName: job.skillName,
          skillVersion: job.skillVersion,
          overallScore: staticAnalysis.score * 0.8,
          securityScore: staticAnalysis.score * 0.7,
          qualityScore: staticAnalysis.score * 0.8,
          performanceScore: staticAnalysis.score * 0.9,
          documentationScore: staticAnalysis.score,
          riskLevel: 'high',
          issues: staticAnalysis.errors.map(e => ({
            id: e.id,
            severity: e.severity,
            category: staticAnalyzerCategoryToAICategory(e.category),
            source: 'static' as const,
            message: e.message,
            file: e.file,
            line: e.line,
          })),
          suggestions: [],
          summary: 'AI review skipped due to critical static analysis issues',
          detailedReport: 'Static analysis found critical issues that need immediate attention.',
          staticAnalysis,
          aiReview: [],
          timestamp: new Date(),
          reviewDuration: 0,
        }
      } else {
        job.status = 'ai-review'
        job.progress = 50
        this.notifyListeners(job)

        aiReview = await this.aiReviewer.review({
          files: job.files,
          skillName: job.skillName,
          skillVersion: job.skillVersion,
          reviewDepth: 'standard',
          focusAreas: ['security', 'quality', 'performance', 'documentation'],
        })
      }

      // Step 3: Scoring
      job.status = 'scoring'
      job.progress = 80
      this.notifyListeners(job)

      const score = this.scoringService.calculateScore(aiReview)

      // Step 4: Complete
      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date()

      const duration = Date.now() - startTime
      this.durations.push(duration)
      if (this.durations.length > 50) {
        this.durations.shift()
      }

      const result: ValidationResult = {
        id: randomUUID(),
        skillName: job.skillName,
        skillVersion: job.skillVersion,
        overallScore: score.overall,
        riskLevel: score.riskLevel,
        passed: score.passed,
        score,
        aiReview,
        staticAnalysis,
        duration,
      }

      job.result = result

      // Cache result
      const cacheKey = `${job.skillName}@${job.skillVersion}`
      this.resultCache.set(cacheKey, result)
      
      // Maintain cache size
      if (this.resultCache.size > this.resultCacheSize) {
        const firstKey = this.resultCache.keys().next().value
        if (firstKey) {
          this.resultCache.delete(firstKey)
        }
      }

      console.log(`✅ Validation completed for ${job.skillName}@${job.skillVersion} in ${duration}ms`)
    } catch (error) {
      console.error(`❌ Validation failed for ${job.id}:`, error)

      // Check for timeout
      if (job.timeoutAt && new Date() > job.timeoutAt) {
        job.status = 'timeout'
        job.error = `Validation timed out after ${this.defaultTimeout / 1000} seconds`
      } else if (job.retryCount < job.maxRetries) {
        // Retry
        job.retryCount++
        job.status = 'queued'
        job.startedAt = undefined
        job.timeoutAt = undefined
        this.queue.push(job)
        this.notifyListeners(job)
        this.processQueue()
        return
      } else {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'
      }

      job.completedAt = new Date()
    }

    // Move to completed
    this.running.delete(job.id)
    this.completed.push(job)
    this.notifyListeners(job)

    // Keep only last 100 completed jobs
    if (this.completed.length > 100) {
      this.completed.shift()
    }

    // Process next job
    this.processQueue()
  }

  /**
   * Cancel a validation job
   */
  cancel(jobId: string): boolean {
    // Check running jobs
    const runningJob = this.running.get(jobId)
    if (runningJob) {
      runningJob.status = 'cancelled'
      runningJob.completedAt = new Date()
      runningJob.error = 'Cancelled by user'
      this.running.delete(jobId)
      this.completed.push(runningJob)
      this.notifyListeners(runningJob)
      return true
    }

    // Check queued jobs
    const queueIndex = this.queue.findIndex((job) => job.id === jobId)
    if (queueIndex !== -1) {
      const job = this.queue[queueIndex]
      job.status = 'cancelled'
      job.completedAt = new Date()
      this.queue.splice(queueIndex, 1)
      this.completed.push(job)
      this.notifyListeners(job)
      return true
    }

    return false
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ValidationJob | undefined {
    return (
      this.running.get(jobId) ||
      this.queue.find((job) => job.id === jobId) ||
      this.completed.find((job) => job.id === jobId)
    )
  }

  /**
   * Get all queued jobs
   */
  getQueuedJobs(): ValidationJob[] {
    return [...this.queue]
  }

  /**
   * Get all running jobs
   */
  getRunningJobs(): ValidationJob[] {
    return Array.from(this.running.values())
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(limit: number = 50): ValidationJob[] {
    return this.completed.slice(-limit)
  }

  /**
   * Get jobs by skill name
   */
  getJobsBySkill(skillName: string): ValidationJob[] {
    return [
      ...this.queue.filter(j => j.skillName === skillName),
      ...Array.from(this.running.values()).filter(j => j.skillName === skillName),
      ...this.completed.filter(j => j.skillName === skillName),
    ]
  }

  /**
   * Get queue statistics
   */
  getStats(): ValidationQueueStats {
    const total = this.queue.length + this.running.size + this.completed.length
    const queued = this.queue.length
    const running = this.running.size
    const completed = this.completed.filter((job) => job.status === 'completed').length
    const failed = this.completed.filter((job) => job.status === 'failed').length
    const timeout = this.completed.filter((job) => job.status === 'timeout').length

    const avgDuration =
      this.durations.length > 0
        ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length
        : 0

    return {
      total,
      queued,
      running,
      completed,
      failed,
      timeout,
      avgDuration,
    }
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): number {
    const count = this.completed.length
    this.completed = []
    return count
  }

  /**
   * Clear result cache
   */
  clearCache(): number {
    const count = this.resultCache.size
    this.resultCache.clear()
    return count
  }

  /**
   * Add validation listener
   */
  addListener(listener: ValidationListener): void {
    this.listeners.add(listener)
  }

  /**
   * Remove validation listener
   */
  removeListener(listener: ValidationListener): void {
    this.listeners.delete(listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(job: ValidationJob): void {
    this.listeners.forEach((listener) => {
      try {
        listener(job)
      } catch (error) {
        console.error('❌ Validation listener error:', error)
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

  /**
   * Get estimated wait time for new job
   */
  getEstimatedWaitTime(): number {
    const avgDuration = this.durations.length > 0
      ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length
      : this.defaultTimeout
    
    const aheadInQueue = this.queue.length
    const aheadRunning = Math.min(this.running.size, this.maxConcurrent)
    
    return Math.round((aheadInQueue + aheadRunning) / this.maxConcurrent * avgDuration)
  }
}

// Singleton instance
let validationQueue: ValidationQueue | null = null

export function getValidationQueue(): ValidationQueue {
  if (!validationQueue) {
    validationQueue = new ValidationQueue({
      maxConcurrent: 2,
      maxQueueSize: 50,
      defaultTimeout: DEFAULT_TIMEOUT,
      defaultMaxRetries: 1,
      resultCacheSize: 100,
    })
  }
  return validationQueue
}

export function initializeValidationQueue(options?: ValidationQueueOptions): ValidationQueue {
  validationQueue = new ValidationQueue(options)
  return validationQueue
}

/**
 * Map static analyzer category to AI review category
 */
function staticAnalyzerCategoryToAICategory(category: string): 'security' | 'quality' | 'performance' | 'documentation' | 'style' {
  switch (category) {
    case 'security':
      return 'security'
    case 'dependency':
      return 'security'
    case 'code-quality':
      return 'quality'
    case 'format':
      return 'style'
    default:
      return 'quality'
  }
}
