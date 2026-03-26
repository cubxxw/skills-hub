/**
 * AI Reviewer Service
 * Uses Qwen Code to review skill packages and generate detailed feedback
 * - Code review using Qwen
 * - Generate fix suggestions
 * - Security assessment
 */

import { randomUUID } from 'crypto'
import { getQwenCodeClient, type CodeReviewResult, type CodeSuggestion } from './qwen-client.js'
import { getStaticAnalyzer, type StaticAnalysisResult } from '../validators/static-analyzer.js'

export interface AIReviewRequest {
  files: Map<string, Buffer>
  skillName?: string
  skillVersion?: string
  reviewDepth: 'quick' | 'standard' | 'thorough'
  focusAreas?: ('security' | 'quality' | 'performance' | 'documentation')[]
}

export interface AIReviewResult {
  id: string
  skillName?: string
  skillVersion?: string
  overallScore: number
  securityScore: number
  qualityScore: number
  performanceScore: number
  documentationScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  issues: AIReviewIssue[]
  suggestions: AIReviewSuggestion[]
  summary: string
  detailedReport: string
  staticAnalysis: StaticAnalysisResult
  aiReview: CodeReviewResult[]
  timestamp: Date
  reviewDuration: number
}

export interface AIReviewIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'security' | 'quality' | 'performance' | 'documentation' | 'style'
  source: 'static' | 'ai'
  message: string
  file?: string
  line?: number
  endLine?: number
  codeSnippet?: string
  suggestion?: string
  aiExplanation?: string
}

export interface AIReviewSuggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'security' | 'quality' | 'performance' | 'documentation'
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  before?: string
  after?: string
  files?: string[]
}

export interface SecurityAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  score: number
  findings: SecurityFinding[]
  recommendations: string[]
}

export interface SecurityFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'injection' | 'xss' | 'csrf' | 'auth' | 'data-exposure' | 'dependency' | 'config'
  title: string
  description: string
  file?: string
  line?: number
  cwe?: string
  cvss?: number
  remediation?: string
}

const RISK_THRESHOLDS = {
  critical: 0.3,
  high: 0.5,
  medium: 0.7,
}

export class AIReviewer {
  private qwenClient = getQwenCodeClient()
  private staticAnalyzer = getStaticAnalyzer()

  /**
   * Perform comprehensive AI review of skill package
   */
  async review(request: AIReviewRequest): Promise<AIReviewResult> {
    const startTime = Date.now()
    
    // Run static analysis first
    const staticAnalysis = await this.staticAnalyzer.analyze(request.files)

    // Perform AI reviews based on focus areas
    const focusAreas = request.focusAreas || ['security', 'quality', 'performance', 'documentation']
    const aiReviews: CodeReviewResult[] = []
    const allIssues: AIReviewIssue[] = []
    const allSuggestions: AIReviewSuggestion[] = []

    // Collect all files content for review
    const filesContent = this.collectFilesContent(request.files)

    // Review each focus area
    for (const area of focusAreas) {
      try {
        const review = await this.qwenClient.reviewCode({
          code: filesContent,
          reviewType: area,
          context: this.getReviewContext(area, request.reviewDepth),
        })
        aiReviews.push(review)

        // Convert AI review issues to AIReviewIssue format
        for (const issue of review.issues) {
          allIssues.push({
            id: randomUUID(),
            severity: issue.severity,
            category: issue.category,
            source: 'ai',
            message: issue.message,
            line: issue.line,
            endLine: issue.endLine,
            codeSnippet: issue.codeSnippet,
            suggestion: issue.suggestion,
            aiExplanation: issue.suggestion,
          })
        }

        // Convert AI review suggestions
        for (const suggestion of review.suggestions) {
          allSuggestions.push({
            id: randomUUID(),
            title: suggestion.title,
            description: suggestion.description,
            priority: suggestion.priority,
            category: suggestion.category,
            effort: this.estimateEffort(suggestion),
            impact: this.estimateImpact(suggestion),
            before: suggestion.before,
            after: suggestion.after,
          })
        }
      } catch (error) {
        console.error(`AI review failed for ${area}:`, error)
        // Continue with other areas
      }
    }

    // Add static analysis issues
    for (const error of staticAnalysis.errors) {
      allIssues.push({
        id: randomUUID(),
        severity: error.severity,
        category: this.mapStaticCategoryToAICategory(error.category),
        source: 'static',
        message: error.message,
        file: error.file,
        line: error.line,
      })
    }

    for (const warning of staticAnalysis.warnings) {
      allIssues.push({
        id: randomUUID(),
        severity: warning.severity === 'info' ? 'info' : warning.severity,
        category: this.mapStaticCategoryToAICategory(warning.category),
        source: 'static',
        message: warning.message,
        file: warning.file,
        line: warning.line,
      })
    }

    // Calculate scores
    const scores = this.calculateScores(staticAnalysis, aiReviews, allIssues)

    // Determine risk level
    const riskLevel = this.determineRiskLevel(scores.overallScore)

    // Generate summary and detailed report
    const summary = this.generateSummary(scores, riskLevel, allIssues.length)
    const detailedReport = this.generateDetailedReport(
      request.skillName,
      request.skillVersion,
      scores,
      riskLevel,
      allIssues,
      allSuggestions,
      staticAnalysis
    )

    const reviewDuration = Date.now() - startTime

    return {
      id: randomUUID(),
      skillName: request.skillName,
      skillVersion: request.skillVersion,
      overallScore: scores.overallScore,
      securityScore: scores.securityScore,
      qualityScore: scores.qualityScore,
      performanceScore: scores.performanceScore,
      documentationScore: scores.documentationScore,
      riskLevel,
      issues: allIssues,
      suggestions: allSuggestions,
      summary,
      detailedReport,
      staticAnalysis,
      aiReview: aiReviews,
      timestamp: new Date(),
      reviewDuration,
    }
  }

  /**
   * Perform security-focused review
   */
  async assessSecurity(files: Map<string, Buffer>): Promise<SecurityAssessment> {
    const filesContent = this.collectFilesContent(files)
    
    try {
      const review = await this.qwenClient.analyzeSecurity(filesContent)
      
      const findings: SecurityFinding[] = []
      const recommendations: string[] = []

      for (const issue of review.issues) {
        findings.push({
          id: randomUUID(),
          severity: issue.severity === 'info' ? 'low' : issue.severity,
          category: this.mapCategoryToSecurityCategory(issue.category),
          title: issue.message,
          description: issue.suggestion || '',
          line: issue.line,
        })
      }

      for (const suggestion of review.suggestions) {
        recommendations.push(`${suggestion.title}: ${suggestion.description}`)
      }

      return {
        overallRisk: this.determineRiskLevel(review.score) as SecurityAssessment['overallRisk'],
        score: review.score,
        findings,
        recommendations,
      }
    } catch (error) {
      console.error('Security assessment failed:', error)
      throw error
    }
  }

  /**
   * Collect and format files content for AI review
   */
  private collectFilesContent(files: Map<string, Buffer>): string {
    const parts: string[] = []

    for (const [filePath, buffer] of files.entries()) {
      // Skip binary files and large files
      if (this.isBinaryFile(filePath) || buffer.length > 1024 * 1024) {
        continue
      }

      const content = buffer.toString('utf-8')
      parts.push(`## File: ${filePath}\n\n\`\`\`${this.getFileLanguage(filePath)}\n${content}\n\`\`\``)
    }

    return parts.join('\n\n')
  }

  /**
   * Check if file is binary
   */
  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz']
    return binaryExtensions.some(ext => filePath.endsWith(ext))
  }

  /**
   * Get file language for syntax highlighting
   */
  private getFileLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      html: 'html',
      css: 'css',
      scss: 'scss',
    }
    return languageMap[ext || ''] || 'text'
  }

  /**
   * Get review context based on area and depth
   */
  private getReviewContext(area: string, depth: 'quick' | 'standard' | 'thorough'): string {
    const contexts: Record<string, Record<typeof depth, string>> = {
      security: {
        quick: 'Focus on critical security vulnerabilities only.',
        standard: 'Review for security vulnerabilities including injection, XSS, authentication issues, and sensitive data exposure.',
        thorough: 'Comprehensive security review including all OWASP Top 10 vulnerabilities, dependency vulnerabilities, secure coding practices, and potential attack vectors.',
      },
      quality: {
        quick: 'Focus on major code quality issues.',
        standard: 'Review for code structure, naming conventions, error handling, and best practices.',
        thorough: 'Comprehensive code quality review including SOLID principles, design patterns, test coverage, type safety, and maintainability.',
      },
      performance: {
        quick: 'Focus on obvious performance issues.',
        standard: 'Review for performance bottlenecks, memory usage, and optimization opportunities.',
        thorough: 'Deep performance analysis including algorithm complexity, memory leaks, caching strategies, and async patterns.',
      },
      documentation: {
        quick: 'Check for basic documentation presence.',
        standard: 'Review documentation completeness, JSDoc comments, and code clarity.',
        thorough: 'Comprehensive documentation review including README, API docs, examples, type annotations, and inline comments.',
      },
    }

    return contexts[area]?.[depth] || 'Standard code review.'
  }

  /**
   * Calculate scores from static analysis and AI review
   */
  private calculateScores(
    staticAnalysis: StaticAnalysisResult,
    aiReviews: CodeReviewResult[],
    issues: AIReviewIssue[]
  ): {
    overallScore: number
    securityScore: number
    qualityScore: number
    performanceScore: number
    documentationScore: number
  } {
    // Start with static analysis score as base
    let securityScore = staticAnalysis.score
    let qualityScore = staticAnalysis.score
    let performanceScore = staticAnalysis.score
    let documentationScore = staticAnalysis.score

    // Adjust based on AI reviews
    for (const review of aiReviews) {
      switch (this.inferReviewType(review)) {
        case 'security':
          securityScore = (securityScore + review.score) / 2
          break
        case 'quality':
          qualityScore = (qualityScore + review.score) / 2
          break
        case 'performance':
          performanceScore = (performanceScore + review.score) / 2
          break
        case 'documentation':
          documentationScore = (documentationScore + review.score) / 2
          break
      }
    }

    // Adjust based on issue severity
    for (const issue of issues) {
      const deduction = this.getIssueDeduction(issue.severity)
      switch (issue.category) {
        case 'security':
          securityScore = Math.max(0, securityScore - deduction)
          break
        case 'quality':
          qualityScore = Math.max(0, qualityScore - deduction)
          break
        case 'performance':
          performanceScore = Math.max(0, performanceScore - deduction)
          break
        case 'documentation':
          documentationScore = Math.max(0, documentationScore - deduction)
          break
      }
    }

    const overallScore = (securityScore + qualityScore + performanceScore + documentationScore) / 4

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      securityScore: Math.round(securityScore * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100,
      documentationScore: Math.round(documentationScore * 100) / 100,
    }
  }

  /**
   * Infer review type from review content
   */
  private inferReviewType(review: CodeReviewResult): 'security' | 'quality' | 'performance' | 'documentation' {
    // Check issues categories to infer the review type
    const categoryCount: Record<string, number> = {}
    for (const issue of review.issues) {
      categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1
    }

    const maxCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0]
    
    if (maxCategory === 'security') return 'security'
    if (maxCategory === 'performance') return 'performance'
    if (maxCategory === 'documentation') return 'documentation'
    return 'quality'
  }

  /**
   * Get score deduction based on issue severity
   */
  private getIssueDeduction(severity: string): number {
    switch (severity) {
      case 'critical':
        return 0.15
      case 'high':
        return 0.1
      case 'medium':
        return 0.05
      case 'low':
        return 0.02
      default:
        return 0.01
    }
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < RISK_THRESHOLDS.critical) return 'critical'
    if (score < RISK_THRESHOLDS.high) return 'high'
    if (score < RISK_THRESHOLDS.medium) return 'medium'
    return 'low'
  }

  /**
   * Estimate effort for a suggestion
   */
  private estimateEffort(suggestion: CodeSuggestion): 'low' | 'medium' | 'high' {
    if (suggestion.before && suggestion.after) {
      const diff = Math.abs(suggestion.after.length - suggestion.before.length)
      if (diff < 50) return 'low'
      if (diff < 200) return 'medium'
      return 'high'
    }
    return 'medium'
  }

  /**
   * Estimate impact for a suggestion
   */
  private estimateImpact(suggestion: CodeSuggestion): 'low' | 'medium' | 'high' {
    if (suggestion.category === 'security') return 'high'
    if (suggestion.priority === 'high') return 'high'
    if (suggestion.priority === 'medium') return 'medium'
    return 'low'
  }

  /**
   * Map category to security category
   */
  private mapCategoryToSecurityCategory(category: string): SecurityFinding['category'] {
    if (category === 'security') return 'data-exposure'
    if (category === 'quality') return 'config'
    return 'config'
  }

  /**
   * Map static analyzer category to AI review category
   */
  private mapStaticCategoryToAICategory(category: string): AIReviewIssue['category'] {
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

  /**
   * Generate summary
   */
  private generateSummary(
    scores: { overallScore: number },
    riskLevel: string,
    issuesCount: number
  ): string {
    const scorePercent = Math.round(scores.overallScore * 100)
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return `⚠️ High Risk: Score ${scorePercent}%. Found ${issuesCount} issues that need immediate attention.`
    }
    if (riskLevel === 'medium') {
      return `⚡ Medium Risk: Score ${scorePercent}%. Found ${issuesCount} issues that should be addressed.`
    }
    return `✅ Low Risk: Score ${scorePercent}%. Code quality is good with ${issuesCount} minor issues.`
  }

  /**
   * Generate detailed report
   */
  private generateDetailedReport(
    skillName: string | undefined,
    skillVersion: string | undefined,
    scores: Record<string, number>,
    riskLevel: string,
    issues: AIReviewIssue[],
    suggestions: AIReviewSuggestion[],
    _staticAnalysis: StaticAnalysisResult
  ): string {
    const header = `# AI Code Review Report

**Skill:** ${skillName || 'Unknown'}${skillVersion ? ` v${skillVersion}` : ''}
**Date:** ${new Date().toISOString()}
**Risk Level:** ${riskLevel.toUpperCase()}

## Scores

| Category | Score |
|----------|-------|
| Overall | ${Math.round(scores.overallScore * 100)}% |
| Security | ${Math.round(scores.securityScore * 100)}% |
| Quality | ${Math.round(scores.qualityScore * 100)}% |
| Performance | ${Math.round(scores.performanceScore * 100)}% |
| Documentation | ${Math.round(scores.documentationScore * 100)}% |

## Summary

${issues.length} issues found, ${suggestions.length} suggestions provided.

## Critical Issues
`

    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high')
    
    if (criticalIssues.length === 0) {
      return header + '\n\nNo critical issues found. Great job!\n'
    }

    const issuesSection = criticalIssues.map(issue => 
      `### ${issue.message}
- **Severity:** ${issue.severity}
- **Category:** ${issue.category}
- **Source:** ${issue.source}
${issue.file ? `- **File:** ${issue.file}` : ''}
${issue.line ? `- **Line:** ${issue.line}` : ''}
${issue.suggestion ? `- **Suggestion:** ${issue.suggestion}` : ''}
`
    ).join('\n')

    const suggestionsSection = suggestions.length > 0 ? `

## Top Suggestions

${suggestions.slice(0, 5).map(s => 
    `### ${s.title}
**Priority:** ${s.priority}
**Category:** ${s.category}

${s.description}
`
).join('\n')}` : ''

    return header + issuesSection + suggestionsSection
  }
}

// Singleton instance
let aiReviewer: AIReviewer | null = null

export function getAIReviewer(): AIReviewer {
  if (!aiReviewer) {
    aiReviewer = new AIReviewer()
  }
  return aiReviewer
}

export function initializeAIReviewer(): AIReviewer {
  aiReviewer = new AIReviewer()
  return aiReviewer
}
