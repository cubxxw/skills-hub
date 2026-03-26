/**
 * Skill Upload Routes
 * Handles ZIP file uploads and GitHub imports
 */

import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { validateSkillPackage, meetsValidationThreshold } from '../validators/skill-validator.js'
import { skillsStore } from '../storage/skills-store.js'
import type { SkillMetadata } from '../validators/skill-validator.js'

// Configure multer for file uploads
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only ZIP files
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('Only ZIP files are allowed'))
    }
  },
})

export { upload }

/**
 * Extract ZIP file contents
 */
function extractZipContents(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()

  for (const entry of entries) {
    if (!entry.isDirectory) {
      // Normalize path (remove leading slashes, handle Windows paths)
      const normalizedPath = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '')
      files.set(normalizedPath, entry.getData())
    }
  }

  return files
}

/**
 * Upload skill response
 */
export interface UploadSkillResponse {
  success: boolean
  skill?: {
    id: string
    name: string
    description: string
    version: string
    author?: string
    status: string
    validationScore: number
  }
  validation?: {
    valid: boolean
    errors: string[]
    warnings: string[]
    score: number
    metadata: SkillMetadata
  }
  error?: string
}

/**
 * POST /api/skills/upload
 * Upload a skill ZIP file
 */
export async function uploadSkill(req: Request, res: Response<UploadSkillResponse>): Promise<void> {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a ZIP file containing your skill.',
      })
      return
    }

    console.log(`📦 Received upload: ${req.file.originalname} (${req.file.size} bytes)`)

    // Extract ZIP contents
    let files: Map<string, Buffer>
    try {
      files = extractZipContents(req.file.buffer)
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to extract ZIP file. Make sure it\'s a valid ZIP archive.',
      })
      return
    }

    console.log(`📂 Extracted ${files.size} files from ZIP`)

    // Validate skill package
    const validation = validateSkillPackage(files)
    console.log(`✅ Validation complete: score=${validation.score}, valid=${validation.valid}`)

    // Check if validation meets threshold
    if (!meetsValidationThreshold(validation.score, 0.6)) {
      res.status(400).json({
        success: false,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          score: validation.score,
          metadata: validation.metadata || {} as SkillMetadata,
        },
        error: `Validation score too low: ${validation.score.toFixed(2)} (minimum: 0.60)`,
      })
      return
    }

    // Store the skill
    const metadata = validation.metadata || {
      name: 'unknown',
      version: '1.0.0',
      description: 'No description provided',
    }

    try {
      const storedSkill = await skillsStore.storeSkill(
        metadata.name || 'unknown-skill',
        metadata.description || 'No description',
        metadata.version || '1.0.0',
        files,
        metadata,
        validation.score,
        'upload'
      )

      // Return success response
      res.status(validation.valid ? 201 : 200).json({
        success: true,
        skill: {
          id: storedSkill.id,
          name: storedSkill.name,
          description: storedSkill.description,
          version: storedSkill.version,
          author: storedSkill.author,
          status: storedSkill.status,
          validationScore: storedSkill.validationScore,
        },
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          score: validation.score,
          metadata: validation.metadata || ({} as SkillMetadata),
        },
      })
    } catch (error) {
      console.error('❌ Failed to store skill:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to store skill. Please try again.',
      })
    }
  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
}

/**
 * GitHub import request
 */
export interface GitHubImportRequest {
  url: string
  branch?: string
}

/**
 * GitHub import response
 */
export interface GitHubImportResponse {
  success: boolean
  skill?: {
    id: string
    name: string
    description: string
    version: string
    author?: string
    status: string
    validationScore: number
    githubUrl?: string
  }
  validation?: {
    valid: boolean
    errors: string[]
    warnings: string[]
    score: number
    metadata: SkillMetadata
  }
  error?: string
}

/**
 * POST /api/skills/import
 * Import skill from GitHub repository
 */
export async function importFromGitHub(req: Request, res: Response<GitHubImportResponse>): Promise<void> {
  try {
    const { url, branch = 'main' }: GitHubImportRequest = req.body

    if (!url) {
      res.status(400).json({
        success: false,
        error: 'GitHub repository URL is required',
      })
      return
    }

    // Parse GitHub URL
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?/)
    if (!match) {
      res.status(400).json({
        success: false,
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
      })
      return
    }

    const [, owner, repo, urlBranch] = match
    const usedBranch = urlBranch || branch

    console.log(`📥 Importing from GitHub: ${owner}/${repo} (branch: ${usedBranch})`)

    // Fetch repository as ZIP
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${usedBranch}.zip`
    
    let zipBuffer: Buffer
    try {
      const response = await fetch(zipUrl)
      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}: ${response.statusText}`)
      }
      zipBuffer = Buffer.from(await response.arrayBuffer())
    } catch (error) {
      console.error('❌ Failed to fetch from GitHub:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch repository from GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      return
    }

    console.log(`📦 Downloaded ZIP: ${zipBuffer.length} bytes`)

    // Extract ZIP contents
    let files: Map<string, Buffer>
    try {
      files = extractZipContents(zipBuffer)
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to extract ZIP file from GitHub',
      })
      return
    }

    // Remove the first directory level (repo-branch-name/)
    const normalizedFiles = new Map<string, Buffer>()
    const prefixPattern = /^[^/]+\//
    for (const [path, content] of files.entries()) {
      const normalizedPath = path.replace(prefixPattern, '')
      if (normalizedPath) {
        normalizedFiles.set(normalizedPath, content)
      }
    }
    files = normalizedFiles

    console.log(`📂 Extracted ${files.size} files from GitHub ZIP`)

    // Validate skill package
    const validation = validateSkillPackage(files)
    console.log(`✅ Validation complete: score=${validation.score}, valid=${validation.valid}`)

    // Check if validation meets threshold
    if (!meetsValidationThreshold(validation.score, 0.6)) {
      res.status(400).json({
        success: false,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          score: validation.score,
          metadata: validation.metadata || {} as SkillMetadata,
        },
        error: `Validation score too low: ${validation.score.toFixed(2)} (minimum: 0.60)`,
      })
      return
    }

    // Store the skill
    const metadata = validation.metadata || {
      name: repo,
      version: '1.0.0',
      description: `Imported from ${owner}/${repo}`,
    }

    try {
      const storedSkill = await skillsStore.storeSkill(
        metadata.name || repo,
        metadata.description || `Imported from GitHub: ${owner}/${repo}`,
        metadata.version || '1.0.0',
        files,
        metadata,
        validation.score,
        'github',
        url
      )

      // Return success response
      res.status(validation.valid ? 201 : 200).json({
        success: true,
        skill: {
          id: storedSkill.id,
          name: storedSkill.name,
          description: storedSkill.description,
          version: storedSkill.version,
          author: storedSkill.author,
          status: storedSkill.status,
          validationScore: storedSkill.validationScore,
          githubUrl: url,
        },
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          score: validation.score,
          metadata: validation.metadata || ({} as SkillMetadata),
        },
      })
    } catch (error) {
      console.error('❌ Failed to store skill:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to store skill. Please try again.',
      })
    }
  } catch (error) {
    console.error('❌ GitHub import error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
}

/**
 * Multer error handler middleware
 */
export function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB.',
      })
      return
    }
    res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    })
    return
  }
  next(err)
}
