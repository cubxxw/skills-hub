/**
 * Static Analyzer
 * Performs static analysis on skill packages without AI
 * - SKILL.md format validation
 * - Dependency security scanning (npm audit)
 * - Sensitive information detection (API keys, secrets)
 * - Code quality checks
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { SkillMetadata } from './skill-validator.js'
import { parseSkillMarkdown } from './skill-validator.js'

const execAsync = promisify(exec)

export interface StaticAnalysisResult {
  valid: boolean
  score: number
  errors: StaticAnalysisError[]
  warnings: StaticAnalysisWarning[]
  info: StaticAnalysisInfo[]
  metrics: AnalysisMetrics
  timestamp: Date
}

export interface StaticAnalysisError {
  id: string
  category: 'format' | 'security' | 'dependency' | 'code-quality'
  message: string
  file?: string
  line?: number
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface StaticAnalysisWarning {
  id: string
  category: 'format' | 'security' | 'dependency' | 'code-quality'
  message: string
  file?: string
  line?: number
  severity: 'high' | 'medium' | 'low' | 'info'
}

export interface StaticAnalysisInfo {
  id: string
  category: 'format' | 'security' | 'dependency' | 'code-quality'
  message: string
  file?: string
}

export interface AnalysisMetrics {
  totalFiles: number
  totalLines: number
  codeLines: number
  commentLines: number
  blankLines: number
  complexity?: number
  maintainabilityIndex?: number
  dependenciesCount: number
  devDependenciesCount: number
  securityIssuesCount: number
  codeQualityIssuesCount: number
}

export interface DependencyInfo {
  name: string
  version: string
  isDev: boolean
  vulnerabilities?: DependencyVulnerability[]
}

export interface DependencyVulnerability {
  id: string
  name?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  url?: string
  recommendation?: string
}

export interface SecretDetection {
  type: 'api-key' | 'password' | 'token' | 'private-key' | 'connection-string'
  file: string
  line: number
  match: string
  severity: 'critical' | 'high' | 'medium'
}

// Patterns for sensitive information detection
const SENSITIVE_PATTERNS: { pattern: RegExp; type: SecretDetection['type']; severity: SecretDetection['severity'] }[] = [
  // API Keys
  { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?[a-zA-Z0-9_\-]{20,}["']?/gi, type: 'api-key', severity: 'critical' },
  { pattern: /(?:sk|pk)[_-]?(?:live|test)[_-]?[a-zA-Z0-9]{20,}/gi, type: 'api-key', severity: 'critical' },
  
  // Passwords
  { pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi, type: 'password', severity: 'critical' },
  { pattern: /(?:DB_PASSWORD|DATABASE_PASSWORD|MONGO_PASSWORD)\s*[=:]\s*["']?[^\s"']{4,}["']?/gi, type: 'password', severity: 'critical' },
  
  // Tokens
  { pattern: /(?:access[_-]?token|auth[_-]?token|bearer[_-]?token)\s*[=:]\s*["']?[a-zA-Z0-9_\-\.]{20,}["']?/gi, type: 'token', severity: 'critical' },
  { pattern: /eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*/gi, type: 'token', severity: 'high' }, // JWT
  
  // Private Keys
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi, type: 'private-key', severity: 'critical' },
  
  // Connection Strings
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s]+:[^\s]+@[^\s]+/gi, type: 'connection-string', severity: 'critical' },
  { pattern: /Server=[^;]+;Database=[^;]+;User Id=[^;]+;Password=[^;]+/gi, type: 'connection-string', severity: 'critical' },
]

// SKILL.md required fields
const REQUIRED_SKILL_FIELDS: (keyof SkillMetadata)[] = ['name', 'version', 'description']

export class StaticAnalyzer {

  /**
   * Analyze skill package files
   */
  async analyze(files: Map<string, Buffer>): Promise<StaticAnalysisResult> {
    const errors: StaticAnalysisError[] = []
    const warnings: StaticAnalysisWarning[] = []
    const info: StaticAnalysisInfo[] = []
    
    const metrics: AnalysisMetrics = {
      totalFiles: files.size,
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      dependenciesCount: 0,
      devDependenciesCount: 0,
      securityIssuesCount: 0,
      codeQualityIssuesCount: 0,
    }

    let score = 1.0

    // Validate SKILL.md format
    const skillMdValidation = this.validateSkillMdFormat(files)
    errors.push(...skillMdValidation.errors)
    warnings.push(...skillMdValidation.warnings)
    info.push(...skillMdValidation.info)
    score -= skillMdValidation.scoreDeduction

    // Detect sensitive information
    const secretsDetection = this.detectSecrets(files)
    for (const secret of secretsDetection) {
      errors.push({
        id: randomUUID(),
        category: 'security',
        message: `Sensitive information detected: ${secret.type}`,
        file: secret.file,
        line: secret.line,
        severity: secret.severity === 'critical' ? 'critical' : 'high',
      })
      metrics.securityIssuesCount++
      score -= secret.severity === 'critical' ? 0.2 : 0.1
    }

    // Analyze code files
    const codeAnalysis = await this.analyzeCodeFiles(files)
    metrics.totalLines += codeAnalysis.totalLines
    metrics.codeLines += codeAnalysis.codeLines
    metrics.commentLines += codeAnalysis.commentLines
    metrics.blankLines += codeAnalysis.blankLines
    warnings.push(...codeAnalysis.warnings)
    info.push(...codeAnalysis.info)
    score -= codeAnalysis.scoreDeduction

    // Count dependencies
    const packageJson = files.get('package.json')
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.toString('utf-8'))
        metrics.dependenciesCount = Object.keys(pkg.dependencies || {}).length
        metrics.devDependenciesCount = Object.keys(pkg.devDependencies || {}).length
      } catch {
        // Invalid package.json, will be caught by SKILL.md validation
      }
    }

    // Run npm audit if package.json exists
    const auditResult = await this.runNpmAudit(files)
    if (auditResult.vulnerabilities.length > 0) {
      for (const vuln of auditResult.vulnerabilities) {
        errors.push({
          id: randomUUID(),
          category: 'dependency',
          message: `Vulnerability in ${vuln.name}: ${vuln.title}`,
          severity: vuln.severity,
        })
        metrics.securityIssuesCount++
        score -= vuln.severity === 'critical' ? 0.15 : vuln.severity === 'high' ? 0.1 : 0.05
      }
    }
    info.push(...auditResult.info)

    // Ensure score doesn't go below 0
    score = Math.max(0, score)

    return {
      valid: errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0,
      score,
      errors,
      warnings,
      info,
      metrics,
      timestamp: new Date(),
    }
  }

  /**
   * Validate SKILL.md format
   */
  private validateSkillMdFormat(files: Map<string, Buffer>): {
    errors: StaticAnalysisError[]
    warnings: StaticAnalysisWarning[]
    info: StaticAnalysisInfo[]
    scoreDeduction: number
  } {
    const errors: StaticAnalysisError[] = []
    const warnings: StaticAnalysisWarning[] = []
    const info: StaticAnalysisInfo[] = []
    let scoreDeduction = 0

    const skillMdFile = files.get('SKILL.md')
    if (!skillMdFile) {
      errors.push({
        id: randomUUID(),
        category: 'format',
        message: 'Missing required file: SKILL.md',
        severity: 'critical',
      })
      return { errors, warnings, info, scoreDeduction: 0.4 }
    }

    const content = skillMdFile.toString('utf-8')
    const metadata = parseSkillMarkdown(content)

    // Check required fields
    for (const field of REQUIRED_SKILL_FIELDS) {
      if (!metadata[field]) {
        errors.push({
          id: randomUUID(),
          category: 'format',
          message: `Missing required field in SKILL.md: ${field}`,
          file: 'SKILL.md',
          severity: 'high',
        })
        scoreDeduction += 0.1
      }
    }

    // Check name format
    if (metadata.name && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(metadata.name) && !/^[a-z0-9]$/.test(metadata.name)) {
      errors.push({
        id: randomUUID(),
        category: 'format',
        message: 'Invalid name format. Use lowercase letters, numbers, and hyphens only',
        file: 'SKILL.md',
        severity: 'medium',
      })
      scoreDeduction += 0.1
    }

    // Check version format (semver)
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      warnings.push({
        id: randomUUID(),
        category: 'format',
        message: 'Version should follow semver format (e.g., 1.0.0)',
        file: 'SKILL.md',
        severity: 'low',
      })
      scoreDeduction += 0.05
    }

    // Check description length
    if (metadata.description && metadata.description.length < 10) {
      warnings.push({
        id: randomUUID(),
        category: 'format',
        message: 'Description is too short (minimum 10 characters)',
        file: 'SKILL.md',
        severity: 'low',
      })
      scoreDeduction += 0.05
    }

    // Check for license
    if (!metadata.license) {
      info.push({
        id: randomUUID(),
        category: 'format',
        message: 'No license specified in SKILL.md',
        file: 'SKILL.md',
      })
    }

    return { errors, warnings, info, scoreDeduction }
  }

  /**
   * Detect sensitive information in files
   */
  private detectSecrets(files: Map<string, Buffer>): SecretDetection[] {
    const secrets: SecretDetection[] = []

    for (const [filePath, buffer] of files.entries()) {
      // Skip node_modules and lock files
      if (filePath.includes('node_modules/') || filePath.endsWith('.lock')) {
        continue
      }

      const content = buffer.toString('utf-8')
      const lines = content.split('\n')

      for (const pattern of SENSITIVE_PATTERNS) {
        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0
        
        let match
        while ((match = pattern.pattern.exec(content)) !== null) {
          // Find line number
          const beforeMatch = content.substring(0, match.index)
          const lineNumber = beforeMatch.split('\n').length

          // Skip if in comments or example/documentation files
          const line = lines[lineNumber - 1]
          if (line?.trim().startsWith('//') || line?.trim().startsWith('*')) {
            continue
          }

          // Skip example files
          if (filePath.includes('example') || filePath.includes('sample') || filePath.includes('test')) {
            continue
          }

          secrets.push({
            type: pattern.type,
            file: filePath,
            line: lineNumber,
            match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
            severity: pattern.severity,
          })
        }
      }
    }

    return secrets
  }

  /**
   * Analyze code files for quality metrics
   */
  private async analyzeCodeFiles(files: Map<string, Buffer>): Promise<{
    totalLines: number
    codeLines: number
    commentLines: number
    blankLines: number
    warnings: StaticAnalysisWarning[]
    info: StaticAnalysisInfo[]
    scoreDeduction: number
  }> {
    const warnings: StaticAnalysisWarning[] = []
    const info: StaticAnalysisInfo[] = []
    let totalLines = 0
    let codeLines = 0
    let commentLines = 0
    let blankLines = 0
    let scoreDeduction = 0

    for (const [filePath, buffer] of files.entries()) {
      // Skip non-code files
      if (!this.isCodeFile(filePath)) {
        continue
      }

      const content = buffer.toString('utf-8')
      const lines = content.split('\n')

      totalLines += lines.length

      for (const line of lines) {
        const trimmed = line.trim()
        
        if (trimmed === '') {
          blankLines++
        } else if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          commentLines++
        } else {
          codeLines++
        }
      }

      // Check for code quality issues
      const qualityIssues = this.checkCodeQuality(content, filePath)
      for (const issue of qualityIssues) {
        warnings.push({
          id: randomUUID(),
          category: 'code-quality',
          message: issue.message,
          file: filePath,
          line: issue.line,
          severity: issue.severity,
        })
        scoreDeduction += issue.severity === 'high' ? 0.05 : 0.02
      }
    }

    return {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      warnings,
      info,
      scoreDeduction,
    }
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml']
    return codeExtensions.some(ext => filePath.endsWith(ext))
  }

  /**
   * Check code quality issues
   */
  private checkCodeQuality(content: string, filePath: string): {
    message: string
    line: number
    severity: 'high' | 'medium' | 'low'
  }[] {
    const issues: { message: string; line: number; severity: 'high' | 'medium' | 'low' }[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1

      // Check for console.log in non-test files
      if (!filePath.includes('test') && !filePath.includes('spec') && /console\.(log|warn|error|debug)/.test(line)) {
        issues.push({
          message: 'Console statement found in production code',
          line: lineNumber,
          severity: 'low',
        })
      }

      // Check for TODO comments
      if (/TODO|FIXME|XXX|HACK/.test(line)) {
        issues.push({
          message: 'Found TODO comment - consider addressing this issue',
          line: lineNumber,
          severity: 'low',
        })
      }

      // Check for very long lines
      if (line.length > 120) {
        issues.push({
          message: `Line exceeds 120 characters (${line.length} chars)`,
          line: lineNumber,
          severity: 'low',
        })
      }

      // Check for eval usage
      if (/\beval\s*\(/.test(line)) {
        issues.push({
          message: 'Use of eval() is discouraged - security and performance risk',
          line: lineNumber,
          severity: 'high',
        })
      }

      // Check for var usage (prefer let/const)
      if (/^\s*var\s+/.test(line)) {
        issues.push({
          message: 'Use let or const instead of var',
          line: lineNumber,
          severity: 'low',
        })
      }
    }

    return issues
  }

  /**
   * Run npm audit on dependencies
   */
  private async runNpmAudit(files: Map<string, Buffer>): Promise<{
    vulnerabilities: DependencyVulnerability[]
    info: StaticAnalysisInfo[]
  }> {
    const vulnerabilities: DependencyVulnerability[] = []
    const info: StaticAnalysisInfo[] = []

    const packageJson = files.get('package.json')
    const packageLock = files.get('package-lock.json')

    if (!packageJson) {
      return { vulnerabilities, info }
    }

    // Create temp directory for npm audit
    const tempDir = await mkdtemp(join(tmpdir(), 'npm-audit-'))
    
    try {
      // Write package files to temp directory
      await writeFile(join(tempDir, 'package.json'), packageJson.toString('utf-8'))
      
      if (packageLock) {
        await writeFile(join(tempDir, 'package-lock.json'), packageLock.toString('utf-8'))
      }

      // Run npm audit
      try {
        const { stdout } = await execAsync('npm audit --json', {
          cwd: tempDir,
          timeout: 60000, // 1 minute timeout
        })

        const auditResult = JSON.parse(stdout)

        if (auditResult.vulnerabilities) {
          for (const [name, vuln] of Object.entries(auditResult.vulnerabilities) as [string, any][]) {
            vulnerabilities.push({
              id: randomUUID(),
              severity: vuln.severity || 'medium',
              title: vuln.title || `Vulnerability in ${name}`,
              url: vuln.url,
              recommendation: vuln.recommendation,
            })
          }
        }

        info.push({
          id: randomUUID(),
          category: 'dependency',
          message: `npm audit completed. Found ${vulnerabilities.length} vulnerabilities`,
        })
      } catch {
        // npm audit might fail if npm is not available or package has issues
        // This is a warning, not an error
        info.push({
          id: randomUUID(),
          category: 'dependency',
          message: 'npm audit could not be completed',
        })
      }
    } finally {
      // Clean up temp directory
      try {
        await rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }

    return { vulnerabilities, info }
  }

  /**
   * Calculate complexity score for a file
   */
  calculateComplexity(content: string): number {
    let complexity = 1
    const lines = content.split('\n')

    for (const line of lines) {
      // Count control flow statements
      if (/\b(if|else|switch|case|for|while|catch|&&|\|\|)\b/.test(line)) {
        complexity++
      }
    }

    return complexity
  }

  /**
   * Calculate maintainability index
   */
  calculateMaintainabilityIndex(metrics: AnalysisMetrics): number {
    // Simplified maintainability index calculation
    const { totalLines, commentLines } = metrics

    if (totalLines === 0) return 100

    const commentRatio = commentLines / totalLines
    
    // Ideal comment ratio is around 20-30%
    const commentScore = Math.max(0, 1 - Math.abs(0.25 - commentRatio) * 4)
    
    // Penalize very large files
    const sizeScore = Math.max(0, 1 - (totalLines / 1000))

    return Math.round((commentScore * 0.5 + sizeScore * 0.5) * 100)
  }
}

// Singleton instance
let staticAnalyzer: StaticAnalyzer | null = null

export function getStaticAnalyzer(): StaticAnalyzer {
  if (!staticAnalyzer) {
    staticAnalyzer = new StaticAnalyzer()
  }
  return staticAnalyzer
}

export function initializeStaticAnalyzer(): StaticAnalyzer {
  staticAnalyzer = new StaticAnalyzer()
  return staticAnalyzer
}
