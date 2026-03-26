/**
 * Scoring Service
 * Calculates and manages validation scores for skill packages
 * - Security score (0-1)
 * - Quality score (0-1)
 * - Performance score (0-1)
 * - Documentation score (0-1)
 * - Overall weighted score
 */

import { randomUUID } from 'crypto'
import type { AIReviewResult } from './ai-reviewer.js'
import type { StaticAnalysisResult } from '../validators/static-analyzer.js'

export interface ValidationScore {
  id: string
  skillName: string
  skillVersion: string
  security: ScoreBreakdown
  quality: ScoreBreakdown
  performance: ScoreBreakdown
  documentation: ScoreBreakdown
  overall: number
  riskLevel: RiskLevel
  passed: boolean
  timestamp: Date
}

export interface ScoreBreakdown {
  score: number
  factors: ScoreFactor[]
  deductions: ScoreDeduction[]
  bonuses: ScoreBonus[]
}

export interface ScoreFactor {
  id: string
  name: string
  weight: number
  score: number
  description: string
}

export interface ScoreDeduction {
  id: string
  reason: string
  amount: number
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface ScoreBonus {
  id: string
  reason: string
  amount: number
  category: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ScoringConfig {
  weights: {
    security: number
    quality: number
    performance: number
    documentation: number
  }
  thresholds: {
    critical: number
    high: number
    medium: number
    pass: number
  }
  deductions: {
    criticalIssue: number
    highIssue: number
    mediumIssue: number
    lowIssue: number
    secretDetected: number
    vulnerabilityFound: number
  }
  bonuses: {
    fullDocumentation: number
    testCoverage: number
    typeSafety: number
    bestPractices: number
  }
}

const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    security: 0.35,
    quality: 0.30,
    performance: 0.20,
    documentation: 0.15,
  },
  thresholds: {
    critical: 0.3,
    high: 0.5,
    medium: 0.7,
    pass: 0.6,
  },
  deductions: {
    criticalIssue: 0.15,
    highIssue: 0.10,
    mediumIssue: 0.05,
    lowIssue: 0.02,
    secretDetected: 0.25,
    vulnerabilityFound: 0.15,
  },
  bonuses: {
    fullDocumentation: 0.05,
    testCoverage: 0.05,
    typeSafety: 0.03,
    bestPractices: 0.03,
  },
}

export class ScoringService {
  private config: ScoringConfig
  private scoreHistory: Map<string, ValidationScore[]> = new Map()

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Calculate validation score from AI review result
   */
  calculateScore(reviewResult: AIReviewResult): ValidationScore {
    const security = this.calculateSecurityScore(reviewResult)
    const quality = this.calculateQualityScore(reviewResult)
    const performance = this.calculatePerformanceScore(reviewResult)
    const documentation = this.calculateDocumentationScore(reviewResult)

    // Calculate weighted overall score
    const overall =
      security.score * this.config.weights.security +
      quality.score * this.config.weights.quality +
      performance.score * this.config.weights.performance +
      documentation.score * this.config.weights.documentation

    const riskLevel = this.determineRiskLevel(overall)
    const passed = overall >= this.config.thresholds.pass

    const score: ValidationScore = {
      id: randomUUID(),
      skillName: reviewResult.skillName || 'Unknown',
      skillVersion: reviewResult.skillVersion || '0.0.0',
      security,
      quality,
      performance,
      documentation,
      overall: Math.round(overall * 1000) / 1000,
      riskLevel,
      passed,
      timestamp: reviewResult.timestamp,
    }

    // Store in history
    this.addToHistory(score)

    return score
  }

  /**
   * Calculate score from static analysis only
   */
  calculateFromStaticAnalysis(
    staticAnalysis: StaticAnalysisResult,
    skillName: string,
    skillVersion: string
  ): ValidationScore {
    const baseScore = staticAnalysis.score

    const security = this.createBaseScoreBreakdown('security', baseScore)
    const quality = this.createBaseScoreBreakdown('quality', baseScore)
    const performance = this.createBaseScoreBreakdown('performance', baseScore)
    const documentation = this.createBaseScoreBreakdown('documentation', baseScore)

    // Apply deductions from errors and warnings
    for (const error of staticAnalysis.errors) {
      const deduction = this.getDeductionForSeverity(error.severity)
      this.applyDeduction(security, deduction, error.category, error.message)
      this.applyDeduction(quality, deduction, error.category, error.message)
    }

    for (const warning of staticAnalysis.warnings) {
      const deduction = this.getDeductionForSeverity(warning.severity) / 2
      this.applyDeduction(quality, deduction, warning.category, warning.message)
    }

    const overall =
      security.score * this.config.weights.security +
      quality.score * this.config.weights.quality +
      performance.score * this.config.weights.performance +
      documentation.score * this.config.weights.documentation

    const riskLevel = this.determineRiskLevel(overall)
    const passed = overall >= this.config.thresholds.pass

    const score: ValidationScore = {
      id: randomUUID(),
      skillName,
      skillVersion,
      security,
      quality,
      performance,
      documentation,
      overall: Math.round(overall * 1000) / 1000,
      riskLevel,
      passed,
      timestamp: staticAnalysis.timestamp,
    }

    this.addToHistory(score)

    return score
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(review: AIReviewResult): ScoreBreakdown {
    const breakdown = this.createBaseScoreBreakdown('security', review.securityScore)

    // Apply deductions for security issues
    const securityIssues = review.issues.filter(i => i.category === 'security')
    for (const issue of securityIssues) {
      const deduction = this.getDeductionForSeverity(issue.severity)
      this.applyDeduction(breakdown, deduction, 'security', issue.message)
    }

    // Apply deductions from static analysis security issues
    if (review.staticAnalysis.metrics.securityIssuesCount > 0) {
      const deduction = review.staticAnalysis.metrics.securityIssuesCount * this.config.deductions.vulnerabilityFound
      this.applyDeduction(breakdown, Math.min(deduction, 0.5), 'security', 'Static analysis security issues')
    }

    // Bonus for no critical issues
    const hasCriticalSecurityIssue = securityIssues.some(i => i.severity === 'critical')
    if (!hasCriticalSecurityIssue && securityIssues.length === 0) {
      this.applyBonus(breakdown, this.config.bonuses.bestPractices, 'security', 'No security issues detected')
    }

    return breakdown
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(review: AIReviewResult): ScoreBreakdown {
    const breakdown = this.createBaseScoreBreakdown('quality', review.qualityScore)

    // Apply deductions for quality issues
    const qualityIssues = review.issues.filter(i => i.category === 'quality' || i.category === 'style')
    for (const issue of qualityIssues) {
      const deduction = this.getDeductionForSeverity(issue.severity)
      this.applyDeduction(breakdown, deduction, 'quality', issue.message)
    }

    // Bonus for type safety (TypeScript files)
    const hasTypeScript = review.staticAnalysis.metrics.totalLines > 0
    if (hasTypeScript) {
      this.applyBonus(breakdown, this.config.bonuses.typeSafety, 'quality', 'TypeScript usage detected')
    }

    return breakdown
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(review: AIReviewResult): ScoreBreakdown {
    const breakdown = this.createBaseScoreBreakdown('performance', review.performanceScore)

    // Apply deductions for performance issues
    const performanceIssues = review.issues.filter(i => i.category === 'performance')
    for (const issue of performanceIssues) {
      const deduction = this.getDeductionForSeverity(issue.severity)
      this.applyDeduction(breakdown, deduction, 'performance', issue.message)
    }

    return breakdown
  }

  /**
   * Calculate documentation score
   */
  private calculateDocumentationScore(review: AIReviewResult): ScoreBreakdown {
    const breakdown = this.createBaseScoreBreakdown('documentation', review.documentationScore)

    // Apply deductions for documentation issues
    const docIssues = review.issues.filter(i => i.category === 'documentation')
    for (const issue of docIssues) {
      const deduction = this.getDeductionForSeverity(issue.severity)
      this.applyDeduction(breakdown, deduction, 'documentation', issue.message)
    }

    // Bonus for full documentation
    const hasReadme = review.staticAnalysis.info.some(i => i.file?.toLowerCase().includes('readme'))
    const hasComments = review.staticAnalysis.metrics.commentLines > 0
    
    if (hasReadme) {
      this.applyBonus(breakdown, this.config.bonuses.fullDocumentation, 'documentation', 'README found')
    }
    
    if (hasComments && review.staticAnalysis.metrics.commentLines / review.staticAnalysis.metrics.totalLines > 0.1) {
      this.applyBonus(breakdown, this.config.bonuses.fullDocumentation / 2, 'documentation', 'Good comment coverage')
    }

    return breakdown
  }

  /**
   * Create base score breakdown
   */
  private createBaseScoreBreakdown(category: string, baseScore: number): ScoreBreakdown {
    return {
      score: baseScore,
      factors: [
        {
          id: randomUUID(),
          name: `${category}-base`,
          weight: 1.0,
          score: baseScore,
          description: `Base ${category} score`,
        },
      ],
      deductions: [],
      bonuses: [],
    }
  }

  /**
   * Apply deduction to score breakdown
   */
  private applyDeduction(
    breakdown: ScoreBreakdown,
    amount: number,
    category: string,
    reason: string,
    severity: 'critical' | 'high' | 'medium' | 'low' = 'medium'
  ): void {
    breakdown.deductions.push({
      id: randomUUID(),
      reason,
      amount,
      category,
      severity,
    })
    breakdown.score = Math.max(0, breakdown.score - amount)
  }

  /**
   * Apply bonus to score breakdown
   */
  private applyBonus(breakdown: ScoreBreakdown, amount: number, category: string, reason: string): void {
    breakdown.bonuses.push({
      id: randomUUID(),
      reason,
      amount,
      category,
    })
    breakdown.score = Math.min(1, breakdown.score + amount)
  }

  /**
   * Get deduction amount for severity
   */
  private getDeductionForSeverity(severity: string): number {
    switch (severity) {
      case 'critical':
        return this.config.deductions.criticalIssue
      case 'high':
        return this.config.deductions.highIssue
      case 'medium':
        return this.config.deductions.mediumIssue
      case 'low':
        return this.config.deductions.lowIssue
      default:
        return this.config.deductions.lowIssue / 2
    }
  }

  /**
   * Determine risk level from score
   */
  determineRiskLevel(score: number): RiskLevel {
    if (score < this.config.thresholds.critical) return 'critical'
    if (score < this.config.thresholds.high) return 'high'
    if (score < this.config.thresholds.medium) return 'medium'
    return 'low'
  }

  /**
   * Check if score meets threshold
   */
  meetsThreshold(score: number, threshold?: number): boolean {
    return score >= (threshold ?? this.config.thresholds.pass)
  }

  /**
   * Get score history for a skill
   */
  getHistory(skillName: string): ValidationScore[] {
    return this.scoreHistory.get(skillName) || []
  }

  /**
   * Add score to history
   */
  private addToHistory(score: ValidationScore): void {
    const key = `${score.skillName}@${score.skillVersion}`
    const history = this.scoreHistory.get(key) || []
    history.push(score)
    
    // Keep only last 10 scores
    if (history.length > 10) {
      history.shift()
    }
    
    this.scoreHistory.set(key, history)
  }

  /**
   * Clear score history
   */
  clearHistory(): void {
    this.scoreHistory.clear()
  }

  /**
   * Get scoring configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config }
  }

  /**
   * Update scoring configuration
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Generate score report
   */
  generateReport(score: ValidationScore): string {
    const riskEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }

    return `# Validation Score Report

## Overview
**Skill:** ${score.skillName} v${score.skillVersion}
**Overall Score:** ${(score.overall * 100).toFixed(1)}%
**Risk Level:** ${riskEmoji[score.riskLevel]} ${score.riskLevel.toUpperCase()}
**Status:** ${score.passed ? '✅ PASSED' : '❌ FAILED'}

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| 🔒 Security | ${(score.security.score * 100).toFixed(1)}% | ${this.getStatusIcon(score.security.score)} |
| ✨ Quality | ${(score.quality.score * 100).toFixed(1)}% | ${this.getStatusIcon(score.quality.score)} |
| ⚡ Performance | ${(score.performance.score * 100).toFixed(1)}% | ${this.getStatusIcon(score.performance.score)} |
| 📚 Documentation | ${(score.documentation.score * 100).toFixed(1)}% | ${this.getStatusIcon(score.documentation.score)} |

## Deductions
${this.formatDeductions(score)}

## Bonuses
${this.formatBonuses(score)}
`
  }

  /**
   * Format deductions for report
   */
  private formatDeductions(score: ValidationScore): string {
    const allDeductions = [
      ...score.security.deductions,
      ...score.quality.deductions,
      ...score.performance.deductions,
      ...score.documentation.deductions,
    ]

    if (allDeductions.length === 0) {
      return 'No deductions applied.'
    }

    return allDeductions
      .map(d => `- **${d.severity.toUpperCase()}** ${d.reason} (-${(d.amount * 100).toFixed(1)}%)`)
      .join('\n')
  }

  /**
   * Format bonuses for report
   */
  private formatBonuses(score: ValidationScore): string {
    const allBonuses = [
      ...score.security.bonuses,
      ...score.quality.bonuses,
      ...score.performance.bonuses,
      ...score.documentation.bonuses,
    ]

    if (allBonuses.length === 0) {
      return 'No bonuses applied.'
    }

    return allBonuses
      .map(b => `+ **${b.reason}** (+${(b.amount * 100).toFixed(1)}%)`)
      .join('\n')
  }

  /**
   * Get status icon for score
   */
  private getStatusIcon(score: number): string {
    if (score >= 0.8) return '✅'
    if (score >= 0.6) return '⚠️'
    return '❌'
  }
}

// Singleton instance
let scoringService: ScoringService | null = null

export function getScoringService(config?: Partial<ScoringConfig>): ScoringService {
  if (!scoringService) {
    scoringService = new ScoringService(config)
  }
  return scoringService
}

export function initializeScoringService(config?: Partial<ScoringConfig>): ScoringService {
  scoringService = new ScoringService(config)
  return scoringService
}
