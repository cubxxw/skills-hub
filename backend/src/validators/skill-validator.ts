/**
 * Skill Validator
 * Validates skill package structure and SKILL.md metadata
 */

export interface SkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  license?: string
  repository?: string
  keywords?: string[]
  main?: string
  scripts?: {
    build?: string
    test?: string
    start?: string
  }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: {
    node?: string
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  metadata?: SkillMetadata
  score: number
}

/**
 * Parse SKILL.md content and extract metadata
 * SKILL.md format:
 * ```markdown
 * ---
 * name: skill-name
 * version: 1.0.0
 * description: Skill description
 * author: Author Name
 * license: MIT
 * ---
 * ```
 */
export function parseSkillMarkdown(content: string): Partial<SkillMetadata> {
  const metadata: Partial<SkillMetadata> = {}
  
  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    
    // Parse key-value pairs
    const lines = frontmatter.split('\n')
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim()
        const normalizedKey = key.trim() as keyof SkillMetadata
        
        // Handle arrays (keywords)
        if (normalizedKey === 'keywords') {
          metadata[normalizedKey] = value.split(',').map(k => k.trim()).filter(Boolean) as string[]
        } else if (['name', 'version', 'description', 'author', 'license', 'repository', 'main'].includes(normalizedKey)) {
          ;(metadata as Record<string, unknown>)[normalizedKey] = value
        }
      }
    }
  }
  
  return metadata
}

/**
 * Validate skill metadata
 */
export function validateSkillMetadata(metadata: Partial<SkillMetadata>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let score = 1.0
  
  // Required fields
  if (!metadata.name) {
    errors.push('Missing required field: name')
    score -= 0.3
  } else if (!/^[a-z0-9-]+$/.test(metadata.name)) {
    errors.push('Invalid name format. Use lowercase letters, numbers, and hyphens only')
    score -= 0.2
  }
  
  if (!metadata.version) {
    errors.push('Missing required field: version')
    score -= 0.2
  } else if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    warnings.push('Version should follow semver format (e.g., 1.0.0)')
    score -= 0.05
  }
  
  if (!metadata.description) {
    errors.push('Missing required field: description')
    score -= 0.2
  } else if (metadata.description.length < 10) {
    warnings.push('Description is too short (minimum 10 characters)')
    score -= 0.05
  }
  
  // Optional fields validation
  if (metadata.author && metadata.author.length < 2) {
    warnings.push('Author name seems too short')
    score -= 0.02
  }
  
  if (metadata.license && !['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'].includes(metadata.license)) {
    warnings.push(`Unknown license type: ${metadata.license}`)
    score -= 0.03
  }
  
  // Ensure score doesn't go below 0
  score = Math.max(0, score)
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: metadata as SkillMetadata,
    score,
  }
}

/**
 * Validate skill package structure
 */
export function validateSkillPackage(files: Map<string, Buffer>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let score = 1.0
  
  // Check for required files
  if (!files.has('SKILL.md')) {
    errors.push('Missing required file: SKILL.md')
    score -= 0.4
  }
  
  // Check for entry point
  const hasIndexFile = Array.from(files.keys()).some(
    f => f === 'index.js' || f === 'index.ts' || f === 'src/index.js' || f === 'src/index.ts'
  )
  if (!hasIndexFile) {
    warnings.push('No index.js or index.ts found. Skill may not be executable')
    score -= 0.15
  }
  
  // Check file size (warn if any file > 5MB)
  for (const [path, buffer] of files.entries()) {
    if (buffer.length > 5 * 1024 * 1024) {
      warnings.push(`File ${path} is larger than 5MB (${Math.round(buffer.length / 1024 / 1024 * 100) / 100}MB)`)
      score -= 0.05
    }
  }
  
  // Parse and validate SKILL.md if present
  let metadata: SkillMetadata | undefined
  const skillMdFile = files.get('SKILL.md')
  if (skillMdFile) {
    const content = skillMdFile.toString('utf-8')
    const parsedMetadata = parseSkillMarkdown(content)
    const metadataValidation = validateSkillMetadata(parsedMetadata)
    
    errors.push(...metadataValidation.errors)
    warnings.push(...metadataValidation.warnings)
    score = Math.min(score, metadataValidation.score)
    metadata = metadataValidation.metadata
  }
  
  // Ensure score doesn't go below 0
  score = Math.max(0, score)
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata,
    score,
  }
}

/**
 * Check if validation score meets threshold
 */
export function meetsValidationThreshold(score: number, threshold: number = 0.8): boolean {
  return score >= threshold
}
