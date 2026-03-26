/**
 * Architecture Analysis Routes
 * REST API for architecture analysis and optimization recommendations
 */

import { Router, Request, Response } from 'express'
import { getArchitectureAnalyzer } from '../services/architecture-analyzer.js'
import { getOptimizationAdvisor } from '../services/optimization-advisor.js'
import { getReportGenerator, type ReportFormat } from '../services/report-generator.js'

const router: Router = Router()

export interface AnalysisJob {
  id: string
  projectPath: string
  status: 'queued' | 'analyzing' | 'completed' | 'failed'
  progress: number
  createdAt: Date
  completedAt?: Date
  error?: string
}

const jobQueue = new Map<string, AnalysisJob>()
const resultCache = new Map<string, { analysis: unknown; optimization: unknown }>()

/**
 * POST /api/architecture/analyze
 * Start architecture analysis for a project
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { projectPath } = req.body

    if (!projectPath) {
      res.status(400).json({ error: 'projectPath is required' })
      return
    }

    const jobId = `arch-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const job: AnalysisJob = {
      id: jobId,
      projectPath,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    }

    jobQueue.set(jobId, job)

    // Start analysis in background
    runAnalysis(jobId, projectPath).catch(error => {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      jobQueue.set(jobId, job)
    })

    res.status(202).json({
      jobId,
      status: 'queued',
      message: 'Architecture analysis started',
    })
  } catch (error) {
    console.error('Error starting analysis:', error)
    res.status(500).json({
      error: 'Failed to start analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/architecture/job/:id
 * Get analysis job status and result
 */
router.get('/job/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const job = jobQueue.get(id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  const response: Record<string, unknown> = {
    id: job.id,
    projectPath: job.projectPath,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }

  if (job.error) {
    response.error = job.error
  }

  // Include result if completed
  if (job.status === 'completed') {
    const cached = resultCache.get(id)
    if (cached) {
      response.result = cached
    }
  }

  res.json(response)
})

/**
 * GET /api/architecture/result/:id
 * Get analysis result directly
 */
router.get('/result/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const cached = resultCache.get(id)
  if (!cached) {
    res.status(404).json({ error: 'Result not found' })
    return
  }

  res.json(cached)
})

/**
 * GET /api/architecture/report/:id
 * Generate and download report
 */
router.get('/report/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { format = 'markdown' } = req.query

    const cached = resultCache.get(id)
    if (!cached) {
      res.status(404).json({ error: 'Result not found' })
      return
    }

    const reportGenerator = getReportGenerator()
    const report = await reportGenerator.generateReport(
      cached.analysis as any,
      cached.optimization as any,
      format as ReportFormat
    )

    const filename = `architecture-report-${id}.${format === 'markdown' ? 'md' : format}`

    res.setHeader('Content-Type', getContentType(format as ReportFormat))
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(report.content)
  } catch (error) {
    console.error('Error generating report:', error)
    res.status(500).json({
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/architecture/visualization/:id
 * Get visualization data for charts
 */
router.get('/visualization/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const cached = resultCache.get(id)
    if (!cached) {
      res.status(404).json({ error: 'Result not found' })
      return
    }

    const reportGenerator = getReportGenerator()
    const vizData = reportGenerator.generateVisualizationData(
      cached.analysis as any,
      cached.optimization as any
    )

    res.json(vizData)
  } catch (error) {
    console.error('Error generating visualization:', error)
    res.status(500).json({
      error: 'Failed to generate visualization',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/architecture/jobs
 * List all analysis jobs
 */
router.get('/jobs', (_req: Request, res: Response) => {
  const jobs = Array.from(jobQueue.values()).map(job => ({
    id: job.id,
    projectPath: job.projectPath,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }))

  res.json({ jobs })
})

/**
 * DELETE /api/architecture/cache
 * Clear result cache
 */
router.delete('/cache', (_req: Request, res: Response) => {
  resultCache.clear()
  res.json({ message: 'Cache cleared' })
})

/**
 * Run analysis in background
 */
async function runAnalysis(jobId: string, projectPath: string): Promise<void> {
  const job = jobQueue.get(jobId)!

  try {
    // Update status to analyzing
    job.status = 'analyzing'
    job.progress = 10
    jobQueue.set(jobId, job)

    // Run architecture analysis
    const analyzer = getArchitectureAnalyzer()
    job.progress = 30
    jobQueue.set(jobId, job)

    const analysis = await analyzer.analyze(projectPath)

    job.progress = 60
    jobQueue.set(jobId, job)

    // Generate optimization plan
    const advisor = getOptimizationAdvisor()
    const optimization = await advisor.generateOptimizationPlan(analysis)

    job.progress = 90
    jobQueue.set(jobId, job)

    // Cache results
    resultCache.set(jobId, { analysis, optimization })

    // Complete job
    job.status = 'completed'
    job.progress = 100
    job.completedAt = new Date()
    jobQueue.set(jobId, job)
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    jobQueue.set(jobId, job)
    throw error
  }
}

/**
 * Get content type for report format
 */
function getContentType(format: ReportFormat): string {
  switch (format) {
    case 'markdown':
      return 'text/markdown'
    case 'html':
      return 'text/html'
    case 'pdf':
      return 'application/pdf'
    case 'json':
      return 'application/json'
    default:
      return 'text/plain'
  }
}

export { router as architectureRoutes }
