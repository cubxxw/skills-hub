/**
 * Validation API Routes
 * Provides endpoints for skill validation with AI review
 */

import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { getValidationQueue, type ValidationResult } from '../services/validation-queue.js'
import { getScoringService } from '../services/scoring-service.js'

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

export interface ValidationRequest {
  skillName?: string
  skillVersion?: string
  priority?: number
}

export interface ValidationJobResponse {
  jobId: string
  status: string
  skillName: string
  skillVersion: string
  addedAt: string
  estimatedWaitTime?: number
}

export interface ValidationStatusResponse {
  jobId: string
  status: string
  skillName: string
  skillVersion: string
  progress: number
  addedAt?: string
  startedAt?: string
  completedAt?: string
  result?: ValidationResult
  error?: string
  queuePosition?: number
}

export interface ValidationStatsResponse {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  timeout: number
  avgDuration: number
  estimatedWaitTime: number
}

export interface ValidationHistoryResponse {
  jobs: ValidationStatusResponse[]
  total: number
}

/**
 * POST /api/validation/validate
 * Upload skill package for validation
 */
export async function uploadAndValidate(
  req: Request,
  res: Response<ValidationJobResponse | { error: string }>
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Please upload a ZIP file.' })
      return
    }

    const { skillName, skillVersion, priority } = req.body as ValidationRequest

    // Extract files from ZIP
    const files = extractFilesFromZip(req.file.buffer)
    
    if (files.size === 0) {
      res.status(400).json({ error: 'Invalid ZIP file or empty package' })
      return
    }

    // Extract skill name/version from SKILL.md if not provided
    let name = skillName
    let version = skillVersion || '0.0.0'

    const skillMd = files.get('SKILL.md')
    if (skillMd && (!name || !version)) {
      const content = skillMd.toString('utf-8')
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1]
        const nameMatch = frontmatter.match(/name:\s*(.+)/)
        const versionMatch = frontmatter.match(/version:\s*(.+)/)
        if (!name && nameMatch) {
          name = nameMatch[1].trim()
        }
        if (!version && versionMatch) {
          version = versionMatch[1].trim()
        }
      }
    }

    if (!name) {
      name = req.file.originalname.replace('.zip', '')
    }

    // Add to validation queue
    const queue = getValidationQueue()
    const job = queue.enqueue(name, version, files, priority || 0)

    if (!job) {
      res.status(503).json({ error: 'Validation queue is full. Please try again later.' })
      return
    }

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      skillName: job.skillName,
      skillVersion: job.skillVersion,
      addedAt: job.addedAt.toISOString(),
      estimatedWaitTime: queue.getEstimatedWaitTime(),
    })
  } catch (error) {
    console.error('Validation upload error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process validation request' 
    })
  }
}

/**
 * GET /api/validation/job/:id
 * Get validation job status and result
 */
export function getValidationJob(
  req: Request,
  res: Response<ValidationStatusResponse | { error: string }>
): void {
  const { id } = req.params
  const queue = getValidationQueue()
  const job = queue.getJob(id)

  if (!job) {
    res.status(404).json({ error: `Validation job '${id}' not found` })
    return
  }

  const response: ValidationStatusResponse = {
    jobId: job.id,
    status: job.status,
    skillName: job.skillName,
    skillVersion: job.skillVersion,
    progress: job.progress,
    addedAt: job.addedAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    result: job.result,
    error: job.error,
  }

  // Add queue position if still queued
  if (job.status === 'queued') {
    const queuedJobs = queue.getQueuedJobs()
    response.queuePosition = queuedJobs.findIndex(j => j.id === job.id) + 1
  }

  res.json(response)
}

/**
 * GET /api/validation/stats
 * Get validation queue statistics
 */
export function getValidationStats(
  _req: Request,
  res: Response<ValidationStatsResponse>
): void {
  const queue = getValidationQueue()
  const stats = queue.getStats()

  res.json({
    ...stats,
    estimatedWaitTime: queue.getEstimatedWaitTime(),
  })
}

/**
 * GET /api/validation/history
 * Get validation history
 */
export function getValidationHistory(
  req: Request,
  res: Response<ValidationHistoryResponse>
): void {
  const { skill, limit = 50 } = req.query
  const queue = getValidationQueue()
  
  let jobs = queue.getCompletedJobs(Number(limit))
  
  if (skill) {
    jobs = queue.getJobsBySkill(String(skill))
  }

  const response: ValidationHistoryResponse = {
    jobs: jobs.map(job => ({
      jobId: job.id,
      status: job.status,
      skillName: job.skillName,
      skillVersion: job.skillVersion,
      progress: job.progress,
      addedAt: job.addedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      result: job.result,
      error: job.error,
    })),
    total: jobs.length,
  }

  res.json(response)
}

/**
 * POST /api/validation/cancel/:id
 * Cancel a validation job
 */
export function cancelValidation(
  req: Request,
  res: Response<{ success: boolean; jobId?: string } | { error: string }>
): void {
  const { id } = req.params
  const queue = getValidationQueue()
  
  const success = queue.cancel(id)
  
  if (success) {
    res.json({ success: true, jobId: id })
  } else {
    res.status(404).json({ error: `Validation job '${id}' not found or already completed` })
  }
}

/**
 * GET /api/validation/score/:jobId
 * Get detailed score breakdown for a completed validation
 */
export function getValidationScore(
  req: Request,
  res: Response<{ score: any } | { error: string }>
): void {
  const { jobId } = req.params
  const queue = getValidationQueue()
  const job = queue.getJob(jobId)

  if (!job) {
    res.status(404).json({ error: `Validation job '${jobId}' not found` })
    return
  }

  if (!job.result) {
    res.status(400).json({ error: 'Validation not completed yet' })
    return
  }

  res.json({ score: job.result.score })
}

/**
 * GET /api/validation/report/:jobId
 * Get validation report (detailed)
 */
export function getValidationReport(
  req: Request,
  res: Response<{ report: string } | { error: string }>
): void {
  const { jobId } = req.params
  const queue = getValidationQueue()
  const job = queue.getJob(jobId)

  if (!job) {
    res.status(404).json({ error: `Validation job '${jobId}' not found` })
    return
  }

  if (!job.result) {
    res.status(400).json({ error: 'Validation not completed yet' })
    return
  }

  const scoringService = getScoringService()
  const report = scoringService.generateReport(job.result.score)

  res.json({ report })
}

/**
 * DELETE /api/validation/cache
 * Clear validation result cache
 */
export function clearValidationCache(
  _req: Request,
  res: Response<{ cleared: number }>
): void {
  const queue = getValidationQueue()
  const cleared = queue.clearCache()
  res.json({ cleared })
}

/**
 * Extract files from ZIP buffer
 */
function extractFilesFromZip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  
  try {
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    for (const entry of entries) {
      if (!entry.isDirectory) {
        // Normalize path (remove leading slashes and dots)
        const normalizedPath = entry.entryName.replace(/^[/\\]+/, '')
        if (normalizedPath && !normalizedPath.includes('..')) {
          files.set(normalizedPath, entry.getData())
        }
      }
    }
  } catch (error) {
    console.error('Failed to extract ZIP:', error)
    throw new Error('Invalid ZIP file')
  }

  return files
}

// Export multer middleware for use in routes
export const uploadMiddleware = upload.single('package') as (req: Request, res: Response, next: NextFunction) => void
