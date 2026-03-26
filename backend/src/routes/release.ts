/**
 * Release API Routes
 * Provides endpoints for publishing skills to ClawHub and version management
 */

import type { Request, Response } from 'express'
import {
  getClawHubPublisher,
  type ReleaseRequest,
  type ReleaseResponse,
  type ReleaseHistory,
  type SkillMetadata,
} from '../services/clawhub-publisher.js'
import { getVersionManager, type Changelog, type VersionInfo } from '../services/version-manager.js'
import { getReleaseQueue, type QueueStats } from '../services/release-queue.js'

/**
 * POST /api/release
 * Publish a skill to ClawHub
 */
export async function publishSkill(
  req: Request<unknown, ReleaseResponse | { error: string }, ReleaseRequest>,
  res: Response
): Promise<void> {
  try {
    const { skillPath, version, changelog, isPrerelease, metadata } = req.body

    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' })
      return
    }

    const publisher = getClawHubPublisher()
    const response = await publisher.publish({
      skillPath,
      version,
      changelog,
      isPrerelease,
      metadata,
    })

    if (response.status === 'published') {
      // Add to version manager
      const versionManager = getVersionManager()
      versionManager.addVersion(response.skillName, response.version, {
        changelog,
        publishedAt: response.publishedAt,
      })

      res.status(200).json(response)
    } else {
      res.status(response.status === 'failed' ? 500 : 202).json(response)
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to publish skill',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/release/queue
 * Queue a skill release for asynchronous processing
 */
export function queueRelease(
  req: Request<unknown, { jobId: string } | { error: string }, ReleaseRequest>,
  res: Response
): void {
  try {
    const { skillPath, version, changelog, isPrerelease, metadata } = req.body

    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' })
      return
    }

    const publisher = getClawHubPublisher()
    const queue = getReleaseQueue(publisher)

    const jobId = queue.enqueue({
      skillPath,
      version,
      changelog,
      isPrerelease,
      metadata,
    })

    res.status(202).json({ jobId })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to queue release',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/release/job/:id
 * Get release job status and progress
 */
export function getReleaseJob(req: Request, res: Response): void {
  const { id } = req.params

  const publisher = getClawHubPublisher()
  const queue = getReleaseQueue(publisher)

  const job = queue.getJob(id)

  if (!job) {
    // Check if it's a direct release (not queued)
    const response = publisher.getReleaseStatus(id)
    if (response) {
      res.json(response)
      return
    }

    res.status(404).json({ error: `Job with id '${id}' not found` })
    return
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    response: job.response,
    error: job.error,
  })
}

/**
 * POST /api/release/job/:id/cancel
 * Cancel a release job
 */
export function cancelReleaseJob(req: Request, res: Response): void {
  const { id } = req.params

  const publisher = getClawHubPublisher()
  const queue = getReleaseQueue(publisher)

  const cancelled = queue.cancelJob(id)

  if (cancelled) {
    res.json({ success: true, message: 'Release job cancelled' })
  } else {
    // Try to cancel direct release
    const cancelledDirect = publisher.cancelRelease(id)
    if (cancelledDirect) {
      res.json({ success: true, message: 'Release cancelled' })
    } else {
      res.status(404).json({ error: 'Job not found or cannot be cancelled' })
    }
  }
}

/**
 * GET /api/release/history
 * Get release history
 */
export function getReleaseHistory(req: Request, res: Response): void {
  const { skillName, limit = 50 } = req.query

  const publisher = getClawHubPublisher()

  let history: ReleaseHistory[]

  if (skillName) {
    history = publisher.getReleaseHistory(skillName as string).slice(0, parseInt(limit as string, 10))
  } else {
    history = publisher.getAllReleaseHistory().slice(0, parseInt(limit as string, 10))
  }

  res.json({
    success: true,
    history,
    total: history.length,
  })
}

/**
 * GET /api/release/history/:skillName
 * Get release history for a specific skill
 */
export function getSkillReleaseHistory(req: Request, res: Response): void {
  const { skillName } = req.params
  const { limit = 50 } = req.query

  const publisher = getClawHubPublisher()
  const history = publisher.getReleaseHistory(skillName).slice(0, parseInt(limit as string, 10))

  res.json({
    success: true,
    history,
    total: history.length,
  })
}

/**
 * GET /api/release/stats
 * Get release queue statistics
 */
export function getReleaseStats(_req: Request, res: Response): void {
  const publisher = getClawHubPublisher()
  const queue = getReleaseQueue(publisher)
  const stats: QueueStats = queue.getStats()

  res.json({
    success: true,
    stats,
  })
}

/**
 * GET /api/release/queue
 * Get queued and active release jobs
 */
export function getReleaseQueueStatus(_req: Request, res: Response): void {
  const publisher = getClawHubPublisher()
  const queue = getReleaseQueue(publisher)

  const pendingJobs = queue.getPendingJobs()
  const activeJobs = queue.getActiveJobs()
  const recentCompleted = queue.getCompletedJobs(20)

  res.json({
    success: true,
    queue: {
      pending: pendingJobs,
      active: activeJobs,
      completed: recentCompleted,
    },
  })
}

/**
 * POST /api/release/validate
 * Validate SKILL.md format without publishing
 */
export async function validateSkillMd(
  req: Request<unknown, { valid: boolean; issues: Array<{ severity: string; message: string; field?: string }> } | { error: string }, { skillPath: string }>,
  res: Response
): Promise<void> {
  try {
    const { skillPath } = req.body

    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' })
      return
    }

    const publisher = getClawHubPublisher()
    const { package: skillPackage } = await publisher.packageSkill(skillPath)

    const issues = publisher.validateSkillMd(skillPackage.skillMd)

    const hasErrors = issues.some((i: { severity: string }) => i.severity === 'error')

    res.json({
      valid: !hasErrors,
      issues: issues.map((i: { severity: string; message: string; field?: string }) => ({
        severity: i.severity,
        message: i.message,
        field: i.field,
      })),
      metadata: skillPackage.skillMd,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to validate SKILL.md',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/release/preview
 * Preview release package
 */
export async function previewRelease(
  req: Request<unknown, { package: unknown; size: number; files: string[] } | { error: string }, { skillPath: string }>,
  res: Response
): Promise<void> {
  try {
    const { skillPath } = req.body

    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' })
      return
    }

    const publisher = getClawHubPublisher()
    const { package: skillPackage, size, hash } = await publisher.packageSkill(skillPath)

    res.json({
      package: {
        name: skillPackage.name,
        version: skillPackage.version,
        description: skillPackage.description,
        author: skillPackage.author,
        license: skillPackage.license,
        files: skillPackage.files,
      },
      size,
      hash,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to preview release',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/version/:skillName
 * Get version history for a skill
 */
export function getVersionHistory(req: Request, res: Response): void {
  const { skillName } = req.params

  const versionManager = getVersionManager()
  const history = versionManager.getVersionHistory(skillName)

  if (!history) {
    res.status(404).json({ error: `No version history found for '${skillName}'` })
    return
  }

  res.json({
    success: true,
    history,
  })
}

/**
 * GET /api/version/:skillName/current
 * Get current version of a skill
 */
export function getCurrentVersion(req: Request, res: Response): void {
  const { skillName } = req.params

  const versionManager = getVersionManager()
  const version = versionManager.getCurrentVersion(skillName)

  if (!version) {
    res.status(404).json({ error: `No version found for '${skillName}'` })
    return
  }

  res.json({
    success: true,
    skillName,
    version,
  })
}

/**
 * GET /api/version/:skillName/latest
 * Get latest version of a skill
 */
export function getLatestVersion(req: Request, res: Response): void {
  const { skillName } = req.params

  const versionManager = getVersionManager()
  const version = versionManager.getLatestVersion(skillName)

  if (!version) {
    res.status(404).json({ error: `No version found for '${skillName}'` })
    return
  }

  res.json({
    success: true,
    skillName,
    version,
  })
}

/**
 * POST /api/version/bump
 * Bump version number
 */
export function bumpVersion(
  req: Request<
    unknown,
    { currentVersion: string; newVersion: string; type: 'major' | 'minor' | 'patch' } | { error: string },
    { currentVersion: string; type: 'major' | 'minor' | 'patch'; prerelease?: string }
  >,
  res: Response
): void {
  try {
    const { currentVersion, type, prerelease } = req.body

    if (!currentVersion || !type) {
      res.status(400).json({ error: 'currentVersion and type are required' })
      return
    }

    const versionManager = getVersionManager()
    const newVersion = versionManager.bumpVersion(currentVersion, type, { prerelease })

    res.json({
      currentVersion,
      newVersion,
      type,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to bump version',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/version/suggest
 * Suggest next version based on changes
 */
export function suggestVersion(
  req: Request<
    unknown,
    { suggestedVersion: string; reason: string } | { error: string },
    { currentVersion: string; changes?: Array<{ type: string; description: string }> }
  >,
  res: Response
): void {
  try {
    const { currentVersion, changes } = req.body

    if (!currentVersion) {
      res.status(400).json({ error: 'currentVersion is required' })
      return
    }

    const versionManager = getVersionManager()
    const suggestedVersion = versionManager.suggestNextVersion(
      currentVersion,
      changes?.map(c => ({
        type: c.type as 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'break',
        description: c.description,
      }))
    )

    const hasBreaking = changes?.some(c => c.type === 'break')
    const hasFeatures = changes?.some(c => c.type === 'feat')

    let reason = 'Patch release (bug fixes and minor improvements)'
    if (hasBreaking) {
      reason = 'Major release (breaking changes)'
    } else if (hasFeatures) {
      reason = 'Minor release (new features)'
    }

    res.json({
      suggestedVersion,
      reason,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to suggest version',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/version/rollback
 * Rollback to a previous version
 */
export function rollbackVersion(
  req: Request<
    unknown,
    { success: boolean; previousVersion: string; rolledbackVersion: string; timestamp: string } | { error: string },
    { skillName: string; targetVersion?: string }
  >,
  res: Response
): void {
  try {
    const { skillName, targetVersion } = req.body

    if (!skillName) {
      res.status(400).json({ error: 'skillName is required' })
      return
    }

    const versionManager = getVersionManager()
    const result = versionManager.rollback(skillName, targetVersion)

    if (result.success) {
      res.json({
        success: true,
        previousVersion: result.previousVersion,
        rolledbackVersion: result.rolledbackVersion,
        timestamp: result.timestamp.toISOString(),
      })
    } else {
      res.status(400).json({
        error: result.error || 'Rollback failed',
      })
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to rollback version',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/changelog/:skillName
 * Get changelog for a skill
 */
export function getChangelog(req: Request, res: Response): void {
  const { skillName, format = 'json' } = req.query

  const versionManager = getVersionManager()
  const changelog = versionManager.generateChangelog(skillName as string)

  if (!changelog || changelog.entries.length === 0) {
    res.status(404).json({ error: `No changelog found for '${skillName}'` })
    return
  }

  if (format === 'markdown') {
    const markdown = versionManager.formatChangelogMarkdown(skillName as string)
    res.type('text/markdown').send(markdown)
  } else {
    res.json({
      success: true,
      changelog,
    })
  }
}

/**
 * POST /api/changelog/generate
 * Generate changelog from changes
 */
export function generateChangelog(
  req: Request<
    unknown,
    { changelog: Changelog; markdown: string } | { error: string },
    { skillName: string; versions?: VersionInfo[] }
  >,
  res: Response
): void {
  try {
    const { skillName, versions } = req.body

    if (!skillName) {
      res.status(400).json({ error: 'skillName is required' })
      return
    }

    const versionManager = getVersionManager()

    // Add versions if provided
    if (versions) {
      for (const version of versions) {
        versionManager.addVersion(skillName, version.version, {
          changelog: version.changelog,
          size: version.size,
          hash: version.hash,
          publishedAt: version.publishedAt,
        })
      }
    }

    const changelog = versionManager.generateChangelog(skillName)
    const markdown = versionManager.formatChangelogMarkdown(skillName)

    res.json({
      changelog,
      markdown,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate changelog',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/release/metadata
 * Extract metadata from SKILL.md
 */
export async function getSkillMetadata(
  req: Request<unknown, { metadata: SkillMetadata } | { error: string }, { skillPath: string }>,
  res: Response
): Promise<void> {
  try {
    const { skillPath } = req.body

    if (!skillPath) {
      res.status(400).json({ error: 'skillPath is required' })
      return
    }

    const publisher = getClawHubPublisher()
    const { package: skillPackage } = await publisher.packageSkill(skillPath)

    res.json({
      metadata: skillPackage.skillMd,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to extract metadata',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
