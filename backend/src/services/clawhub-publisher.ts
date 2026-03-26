/**
 * ClawHub Publisher Service
 * Handles publishing skills to ClawHub registry
 * - Package skill into ZIP
 * - Validate SKILL.md format
 * - Publish to ClawHub API
 * - Track release status
 */

import { randomUUID } from 'crypto'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { createHash } from 'crypto'

export interface ClawHubPublisherConfig {
  apiUrl: string
  apiKey?: string
  registryUrl?: string
  timeout?: number
}

export interface SkillPackage {
  name: string
  version: string
  description: string
  author: string
  license: string
  files: string[]
  size: number
  hash: string
  skillMd: SkillMetadata
  metadata?: Record<string, unknown>
}

export interface SkillMetadata {
  name: string
  version: string
  description: string
  author: string
  license: string
  keywords?: string[]
  repository?: string
  homepage?: string
  bugs?: string
  main?: string
  types?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  engines?: Record<string, string>
  publishConfig?: Record<string, unknown>
}

export interface ReleaseRequest {
  skillPath: string
  version?: string
  changelog?: string
  isPrerelease?: boolean
  metadata?: Record<string, unknown>
}

export interface ReleaseResponse {
  id: string
  status: ReleaseStatus
  skillName: string
  version: string
  publishedAt?: Date
  url?: string
  message?: string
  errors?: ReleaseError[]
}

export type ReleaseStatus =
  | 'pending'
  | 'packaging'
  | 'validating'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export interface ReleaseError {
  code: string
  message: string
  field?: string
}

export interface ReleaseHistory {
  id: string
  skillName: string
  version: string
  status: ReleaseStatus
  publishedAt: Date
  publishedBy?: string
  changelog?: string
  size: number
  hash: string
  url?: string
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  field?: string
  line?: number
}

const DEFAULT_CONFIG: ClawHubPublisherConfig = {
  apiUrl: 'https://api.clawhub.io/v1',
  timeout: 30000,
}

export class ClawHubPublisher {
  private config: ClawHubPublisherConfig
  private releaseHistory: Map<string, ReleaseHistory[]> = new Map()
  private activeReleases: Map<string, ReleaseResponse> = new Map()

  constructor(config: Partial<ClawHubPublisherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Package skill into ZIP archive
   */
  async packageSkill(skillPath: string, outputPath?: string): Promise<{
    zipPath: string
    package: SkillPackage
    size: number
    hash: string
  }> {
    const zip = new AdmZip()
    const skillMdPath = join(skillPath, 'SKILL.md')

    // Validate SKILL.md exists
    if (!existsSync(skillMdPath)) {
      throw new Error('SKILL.md not found in skill directory')
    }

    // Parse and validate SKILL.md
    const skillMd = await this.parseSkillMd(skillMdPath)
    const validationIssues = this.validateSkillMd(skillMd)
    const errors = validationIssues.filter(i => i.severity === 'error')

    if (errors.length > 0) {
      throw new Error(`SKILL.md validation failed: ${errors.map(e => e.message).join(', ')}`)
    }

    // Add all files to ZIP
    const files = await this.collectFiles(skillPath)
    for (const file of files) {
      const relativePath = file.replace(skillPath + '/', '').replace(skillPath + '\\', '')
      zip.addLocalFile(file, relativePath)
    }

    // Generate output path if not provided
    const zipPath = outputPath || join(skillPath, `${skillMd.name}-${skillMd.version}.zip`)

    // Write ZIP file
    await zip.writeZipPromise(zipPath)

    // Calculate hash and size
    const zipBuffer = zip.toBuffer()
    const hash = createHash('sha256').update(zipBuffer).digest('hex')
    const size = zipBuffer.length

    const skillPackage: SkillPackage = {
      name: skillMd.name,
      version: skillMd.version,
      description: skillMd.description,
      author: skillMd.author,
      license: skillMd.license,
      files: files.map(f => f.replace(skillPath + '/', '').replace(skillPath + '\\', '')),
      size,
      hash,
      skillMd,
    }

    return {
      zipPath,
      package: skillPackage,
      size,
      hash,
    }
  }

  /**
   * Validate SKILL.md format
   */
  validateSkillMd(metadata: SkillMetadata): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    // Required fields
    const requiredFields: (keyof SkillMetadata)[] = ['name', 'version', 'description', 'author', 'license']
    for (const field of requiredFields) {
      if (!metadata[field]) {
        issues.push({
          severity: 'error',
          message: `Missing required field: ${field}`,
          field: field as string,
        })
      }
    }

    // Validate name format
    if (metadata.name && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(metadata.name)) {
      issues.push({
        severity: 'error',
        message: 'Skill name must be lowercase alphanumeric with hyphens',
        field: 'name',
      })
    }

    // Validate version format (semver)
    if (metadata.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(metadata.version)) {
      issues.push({
        severity: 'error',
        message: 'Version must follow semver format (e.g., 1.0.0)',
        field: 'version',
      })
    }

    // Validate license
    const validLicenses = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'UNLICENSED']
    if (metadata.license && !validLicenses.includes(metadata.license)) {
      issues.push({
        severity: 'warning',
        message: `License "${metadata.license}" may not be standard. Consider using MIT, Apache-2.0, etc.`,
        field: 'license',
      })
    }

    // Validate description length
    if (metadata.description && metadata.description.length < 10) {
      issues.push({
        severity: 'warning',
        message: 'Description should be at least 10 characters',
        field: 'description',
      })
    }

    // Validate keywords
    if (metadata.keywords && metadata.keywords.length > 20) {
      issues.push({
        severity: 'warning',
        message: 'Too many keywords (max 20)',
        field: 'keywords',
      })
    }

    return issues
  }

  /**
   * Publish skill to ClawHub
   */
  async publish(request: ReleaseRequest): Promise<ReleaseResponse> {
    const releaseId = randomUUID()
    const response: ReleaseResponse = {
      id: releaseId,
      status: 'pending',
      skillName: '',
      version: '',
    }

    this.activeReleases.set(releaseId, response)

    try {
      // Step 1: Package skill
      response.status = 'packaging'
      this.activeReleases.set(releaseId, { ...response })

      const { zipPath, package: skillPackage, size, hash } = await this.packageSkill(request.skillPath)

      response.skillName = skillPackage.name
      response.version = request.version || skillPackage.version

      // Step 2: Validate
      response.status = 'validating'
      this.activeReleases.set(releaseId, { ...response })

      const validationIssues = this.validateSkillMd(skillPackage.skillMd)
      const errors = validationIssues.filter(i => i.severity === 'error')
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`)
      }

      // Step 3: Publish to ClawHub API
      response.status = 'publishing'
      this.activeReleases.set(releaseId, { ...response })

      const publishResult = await this.publishToClawHub({
        ...skillPackage,
        version: response.version,
        changelog: request.changelog,
        isPrerelease: request.isPrerelease,
        metadata: request.metadata,
      })

      // Step 4: Success
      response.status = 'published'
      response.publishedAt = new Date()
      response.url = publishResult.url
      response.message = `Successfully published ${skillPackage.name}@${response.version}`

      // Add to history
      this.addToHistory({
        id: releaseId,
        skillName: skillPackage.name,
        version: response.version,
        status: 'published',
        publishedAt: response.publishedAt,
        changelog: request.changelog,
        size,
        hash,
        url: publishResult.url,
      })

      // Clean up ZIP file
      try {
        rmSync(zipPath)
      } catch (e) {
        // Ignore cleanup errors
      }

      this.activeReleases.set(releaseId, response)
      return response
    } catch (error) {
      response.status = 'failed'
      response.message = error instanceof Error ? error.message : 'Unknown error occurred'
      response.errors = [
        {
          code: 'PUBLISH_ERROR',
          message: response.message,
        },
      ]

      this.activeReleases.set(releaseId, response)
      return response
    }
  }

  /**
   * Publish to ClawHub API (simulated)
   */
  private async publishToClawHub(skillPackage: SkillPackage & {
    changelog?: string
    isPrerelease?: boolean
  }): Promise<{ url: string }> {
    // In production, this would make an HTTP request to ClawHub API
    // For now, simulate the response

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const registryUrl = this.config.registryUrl || 'https://clawhub.io'
    const url = `${registryUrl}/skills/${skillPackage.name}/${skillPackage.version}`

    return { url }
  }

  /**
   * Get release status
   */
  getReleaseStatus(releaseId: string): ReleaseResponse | undefined {
    return this.activeReleases.get(releaseId)
  }

  /**
   * Get release history for a skill
   */
  getReleaseHistory(skillName: string): ReleaseHistory[] {
    return this.releaseHistory.get(skillName) || []
  }

  /**
   * Get all release history
   */
  getAllReleaseHistory(): ReleaseHistory[] {
    const all: ReleaseHistory[] = []
    for (const history of this.releaseHistory.values()) {
      all.push(...history)
    }
    return all.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
  }

  /**
   * Parse SKILL.md file
   */
  private async parseSkillMd(filePath: string): Promise<SkillMetadata> {
    const fs = await import('fs/promises')
    const content = await fs.readFile(filePath, 'utf-8')

    // Parse YAML-like format
    const metadata: SkillMetadata = {
      name: '',
      version: '',
      description: '',
      author: '',
      license: 'MIT',
    }

    const lines = content.split('\n')
    let inFrontmatter = false

    for (const line of lines) {
      if (line.trim() === '---') {
        inFrontmatter = !inFrontmatter
        continue
      }

      if (inFrontmatter) {
        const match = line.match(/^(\w+):\s*(.+)$/)
        if (match) {
          const [, key, value] = match
          const trimmedValue = value.replace(/["']/g, '').trim()

          if (key === 'keywords') {
            metadata.keywords = trimmedValue.split(',').map(k => k.trim())
          } else if (key in metadata && typeof metadata[key as keyof SkillMetadata] === 'string') {
            metadata[key as keyof SkillMetadata] = trimmedValue as never
          }
        }
      }
    }

    return metadata
  }

  /**
   * Collect all files from directory
   */
  private async collectFiles(dirPath: string, baseDir = dirPath): Promise<string[]> {
    const fs = await import('fs/promises')
    const files: string[] = []

    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      // Skip node_modules, dist, .git, etc.
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name.startsWith('.')
      ) {
        continue
      }

      if (entry.isDirectory()) {
        const subFiles = await this.collectFiles(fullPath, baseDir)
        files.push(...subFiles)
      } else {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Add to release history
   */
  private addToHistory(history: ReleaseHistory): void {
    const skillHistory = this.releaseHistory.get(history.skillName) || []
    skillHistory.push(history)

    // Keep only last 50 releases per skill
    if (skillHistory.length > 50) {
      skillHistory.shift()
    }

    this.releaseHistory.set(history.skillName, skillHistory)
  }

  /**
   * Cancel active release
   */
  cancelRelease(releaseId: string): boolean {
    const release = this.activeReleases.get(releaseId)
    if (!release || release.status === 'published' || release.status === 'failed') {
      return false
    }

    release.status = 'cancelled'
    release.message = 'Release cancelled by user'
    this.activeReleases.set(releaseId, release)

    return true
  }

  /**
   * Get configuration
   */
  getConfig(): ClawHubPublisherConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClawHubPublisherConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Singleton instance
let clawHubPublisher: ClawHubPublisher | null = null

export function getClawHubPublisher(config?: Partial<ClawHubPublisherConfig>): ClawHubPublisher {
  if (!clawHubPublisher) {
    clawHubPublisher = new ClawHubPublisher(config)
  }
  return clawHubPublisher
}

export function initializeClawHubPublisher(config?: Partial<ClawHubPublisherConfig>): ClawHubPublisher {
  clawHubPublisher = new ClawHubPublisher(config)
  return clawHubPublisher
}
