/**
 * Report Generator Service
 * Generates architecture analysis reports in multiple formats
 * - Markdown reports
 * - PDF export (via HTML conversion)
 * - Visualization chart data (for frontend rendering)
 */

import { writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import type { ArchitectureAnalysis, DependencyGraph } from './architecture-analyzer.js'
import type { OptimizationPlan } from './optimization-advisor.js'

export interface ReportOptions {
  includeExecutiveSummary: boolean
  includeArchitectureDiagram: boolean
  includeDependencyGraph: boolean
  includeTechnicalDebt: boolean
  includeRecommendations: boolean
  includeOptimizationPlan: boolean
  includeRoadmap: boolean
  theme: 'light' | 'dark'
}

export interface GeneratedReport {
  id: string
  format: ReportFormat
  content: string
  metadata: ReportMetadata
  createdAt: Date
  downloadUrl?: string
}

export type ReportFormat = 'markdown' | 'html' | 'pdf' | 'json'

export interface ReportMetadata {
  title: string
  project: string
  version: string
  author: string
  sections: string[]
  pageCount?: number
  wordCount?: number
}

export interface VisualizationData {
  dependencyGraph: {
    nodes: VisualizationNode[]
    edges: VisualizationEdge[]
  }
  moduleMetrics: ModuleMetric[]
  debtChart: DebtChartData
  roadmapTimeline: RoadmapTimelineData
  radarChart: RadarChartData
}

export interface VisualizationNode {
  id: string
  label: string
  type: string
  size: number
  complexity: number
  x: number
  y: number
  color: string
  group: string
}

export interface VisualizationEdge {
  source: string
  target: string
  type: string
  weight: number
  color: string
  isCircular: boolean
}

export interface ModuleMetric {
  name: string
  path: string
  lines: number
  complexity: number
  maintainability: number
  dependencies: number
  dependents: number
}

export interface DebtChartData {
  categories: string[]
  values: number[]
  percentages: number[]
}

export interface RoadmapTimelineData {
  phases: {
    id: string
    name: string
    startWeek: number
    duration: number
    tasks: number
  }[]
}

export interface RadarChartData {
  categories: string[]
  scores: number[]
  maxScore: number
}

const DEFAULT_OPTIONS: ReportOptions = {
  includeExecutiveSummary: true,
  includeArchitectureDiagram: true,
  includeDependencyGraph: true,
  includeTechnicalDebt: true,
  includeRecommendations: true,
  includeOptimizationPlan: true,
  includeRoadmap: true,
  theme: 'light',
}

export class ReportGenerator {
  /**
   * Generate report in specified format
   */
  async generateReport(
    analysis: ArchitectureAnalysis,
    optimizationPlan?: OptimizationPlan,
    format: ReportFormat = 'markdown',
    options: Partial<ReportOptions> = {}
  ): Promise<GeneratedReport> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    let content: string
    let metadata: ReportMetadata

    switch (format) {
      case 'markdown':
        content = await this.generateMarkdownReport(analysis, optimizationPlan, opts)
        metadata = this.createMetadata(analysis)
        break
      case 'html':
        content = await this.generateHTMLReport(analysis, optimizationPlan, opts)
        metadata = this.createMetadata(analysis)
        break
      case 'json':
        content = JSON.stringify(this.generateVisualizationData(analysis, optimizationPlan), null, 2)
        metadata = this.createMetadata(analysis)
        break
      default:
        content = await this.generateMarkdownReport(analysis, optimizationPlan, opts)
        metadata = this.createMetadata(analysis)
    }

    const report: GeneratedReport = {
      id: randomUUID(),
      format,
      content,
      metadata,
      createdAt: new Date(),
    }

    return report
  }

  /**
   * Generate comprehensive Markdown report
   */
  private async generateMarkdownReport(
    analysis: ArchitectureAnalysis,
    optimizationPlan?: OptimizationPlan,
    options: ReportOptions = DEFAULT_OPTIONS
  ): Promise<string> {
    const sections: string[] = []

    // Title
    sections.push(`# Architecture Analysis Report`)
    sections.push('')
    sections.push(`**Project:** ${this.extractProjectName(analysis.projectRoot)}`)
    sections.push(`**Generated:** ${analysis.timestamp.toLocaleString()}`)
    sections.push(`**Analysis ID:** ${analysis.id}`)
    sections.push('')
    sections.push('---')
    sections.push('')

    // Executive Summary
    if (options.includeExecutiveSummary && optimizationPlan) {
      sections.push(this.generateExecutiveSummaryMD(optimizationPlan))
    }

    // Architecture Overview
    sections.push(this.generateArchitectureOverviewMD(analysis))

    // Complexity Metrics
    sections.push(this.generateComplexityMetricsMD(analysis))

    // Dependency Graph
    if (options.includeDependencyGraph) {
      sections.push(this.generateDependencyGraphMD(analysis))
    }

    // Coupling Analysis
    sections.push(this.generateCouplingAnalysisMD(analysis))

    // Technical Debt
    if (options.includeTechnicalDebt) {
      sections.push(this.generateTechnicalDebtMD(analysis))
    }

    // Recommendations
    if (options.includeRecommendations) {
      sections.push(this.generateRecommendationsMD(analysis))
    }

    // Optimization Plan
    if (options.includeOptimizationPlan && optimizationPlan) {
      sections.push(this.generateOptimizationPlanMD(optimizationPlan))
    }

    // Roadmap
    if (options.includeRoadmap && optimizationPlan) {
      sections.push(this.generateRoadmapMD(optimizationPlan))
    }

    // Footer
    sections.push('---')
    sections.push('')
    sections.push(`*Report generated by AG-UI Skill Platform Architecture Analyzer*`)

    return sections.join('\n\n')
  }

  /**
   * Generate HTML report with styling
   */
  private async generateHTMLReport(
    analysis: ArchitectureAnalysis,
    optimizationPlan?: OptimizationPlan,
    options: ReportOptions = DEFAULT_OPTIONS
  ): Promise<string> {
    const markdownContent = await this.generateMarkdownReport(analysis, optimizationPlan, options)
    const htmlContent = this.markdownToHTML(markdownContent)

    const theme = options.theme === 'dark' ? this.getDarkTheme() : this.getLightTheme()

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architecture Analysis Report</title>
  <style>${theme}</style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏗️ Architecture Analysis Report</h1>
      <p class="meta">
        Project: ${this.extractProjectName(analysis.projectRoot)} | 
        Generated: ${analysis.timestamp.toLocaleString()}
      </p>
    </header>
    
    <main>
      ${htmlContent}
    </main>
    
    <footer>
      <p>Generated by AG-UI Skill Platform Architecture Analyzer</p>
    </footer>
    
    <script>
      // Initialize charts
      ${this.getChartInitialization(analysis, optimizationPlan)}
    </script>
  </div>
</body>
</html>`
  }

  /**
   * Generate visualization data for frontend charts
   */
  generateVisualizationData(
    analysis: ArchitectureAnalysis,
    optimizationPlan?: OptimizationPlan
  ): VisualizationData {
    // Dependency graph visualization
    const { nodes, edges } = this.createDependencyGraphVisualization(analysis.dependencyGraph)

    // Module metrics
    const moduleMetrics: ModuleMetric[] = analysis.modules.map(m => ({
      name: m.name,
      path: m.path,
      lines: m.lines,
      complexity: m.complexity,
      maintainability: m.maintainabilityIndex,
      dependencies: m.dependencies.filter(d => !d.isExternal).length,
      dependents: m.dependents.length,
    }))

    // Debt chart data
    const debtChart: DebtChartData = {
      categories: analysis.technicalDebt.debtByCategory.map(c => this.formatCategory(c.category)),
      values: analysis.technicalDebt.debtByCategory.map(c => Math.round(c.debt * 100)),
      percentages: analysis.technicalDebt.debtByCategory.map(c => c.percentage),
    }

    // Roadmap timeline
    const roadmapTimeline: RoadmapTimelineData = {
      phases: optimizationPlan?.roadmap.phases.map((phase, index) => {
        const startWeek = optimizationPlan.roadmap.phases
          .slice(0, index)
          .reduce((sum, p) => sum + p.duration, 0)
        return {
          id: phase.id,
          name: phase.name,
          startWeek,
          duration: phase.duration,
          tasks: phase.tasks.length,
        }
      }) || [],
    }

    // Radar chart data
    const radarChart: RadarChartData = {
      categories: ['Security', 'Quality', 'Performance', 'Maintainability', 'Modularity'],
      scores: [
        this.calculateSecurityScore(analysis),
        this.calculateQualityScore(analysis),
        this.calculatePerformanceScore(analysis),
        analysis.complexityMetrics.maintainabilityIndex,
        this.calculateModularityScore(analysis),
      ],
      maxScore: 100,
    }

    return {
      dependencyGraph: { nodes, edges },
      moduleMetrics,
      debtChart,
      roadmapTimeline,
      radarChart,
    }
  }

  /**
   * Create dependency graph visualization data
   */
  private createDependencyGraphVisualization(
    graph: DependencyGraph
  ): { nodes: VisualizationNode[]; edges: VisualizationEdge[] } {
    // Simple force-directed layout simulation
    const width = 800
    const height = 600
    const centerX = width / 2
    const centerY = height / 2

    const nodes: VisualizationNode[] = graph.nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / graph.nodes.length
      const radius = Math.min(width, height) * 0.35

      return {
        id: node.id,
        label: node.label,
        type: node.type,
        size: Math.max(5, Math.min(20, node.size / 1000)),
        complexity: node.complexity,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        color: this.getNodeColor(node.type),
        group: node.type,
      }
    })

    const edges: VisualizationEdge[] = graph.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
      color: '#94a3b8',
      isCircular: false,
    }))

    // Mark circular dependencies
    const circularPaths = new Set<string>()
    for (const cycle of graph.cycles) {
      for (let i = 0; i < cycle.length; i++) {
        const source = cycle[i]
        const target = cycle[(i + 1) % cycle.length]
        circularPaths.add(`${source}-${target}`)
      }
    }

    for (const edge of edges) {
      if (circularPaths.has(`${edge.source}-${edge.target}`)) {
        edge.color = '#ef4444'
        edge.isCircular = true
      }
    }

    return { nodes, edges }
  }

  /**
   * Generate executive summary section (Markdown)
   */
  private generateExecutiveSummaryMD(plan: OptimizationPlan): string {
    const healthEmoji = {
      excellent: '🟢',
      good: '🟡',
      fair: '🟠',
      poor: '🔴',
      critical: '⚫',
    }

    let md = `## Executive Summary\n\n`
    md += `**Overall Health:** ${healthEmoji[plan.executiveSummary.overallHealth]} ${plan.executiveSummary.overallHealth.toUpperCase()}\n\n`
    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Critical Issues | ${plan.executiveSummary.criticalIssues} |\n`
    md += `| High Priority Issues | ${plan.executiveSummary.highPriorityIssues} |\n`
    md += `| Technical Debt Ratio | ${(plan.executiveSummary.totalDebt * 100).toFixed(1)}% |\n`
    md += `\n`

    if (plan.executiveSummary.quickWins.length > 0) {
      md += `### Quick Wins 🎯\n\n`
      for (const win of plan.executiveSummary.quickWins.slice(0, 5)) {
        md += `- **${win.title}**: ${win.description} (Est. ${win.estimatedTime}h)\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Generate architecture overview section (Markdown)
   */
  private generateArchitectureOverviewMD(analysis: ArchitectureAnalysis): string {
    let md = `## Architecture Overview\n\n`

    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Total Files | ${analysis.complexityMetrics.totalFiles} |\n`
    md += `| Total Lines | ${analysis.complexityMetrics.totalLines.toLocaleString()} |\n`
    md += `| Average Module Size | ${analysis.complexityMetrics.averageModuleSize.toFixed(0)} lines |\n`
    md += `| Average Complexity | ${analysis.complexityMetrics.averageComplexity.toFixed(1)} |\n`
    md += `| Maintainability Index | ${analysis.complexityMetrics.maintainabilityIndex}/100 |\n`
    md += `\n`

    // Module type distribution
    const typeDistribution = new Map<string, number>()
    for (const module of analysis.modules) {
      typeDistribution.set(module.type, (typeDistribution.get(module.type) || 0) + 1)
    }

    md += `### Module Distribution\n\n`
    md += `| Type | Count |\n`
    md += `|------|-------|\n`
    for (const [type, count] of typeDistribution.entries()) {
      md += `| ${type} | ${count} |\n`
    }
    md += `\n`

    return md
  }

  /**
   * Generate complexity metrics section (Markdown)
   */
  private generateComplexityMetricsMD(analysis: ArchitectureAnalysis): string {
    let md = `## Complexity Analysis\n\n`

    md += `### Halstead Metrics\n\n`
    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Vocabulary | ${analysis.complexityMetrics.halsteadMetrics.vocabulary} |\n`
    md += `| Length | ${analysis.complexityMetrics.halsteadMetrics.length} |\n`
    md += `| Volume | ${analysis.complexityMetrics.halsteadMetrics.volume.toFixed(0)} |\n`
    md += `| Difficulty | ${analysis.complexityMetrics.halsteadMetrics.difficulty.toFixed(2)} |\n`
    md += `| Effort | ${analysis.complexityMetrics.halsteadMetrics.effort.toFixed(0)} |\n`
    md += `\n`

    // Top 5 most complex modules
    const complexModules = [...analysis.modules]
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5)

    md += `### Most Complex Modules\n\n`
    md += `| Module | Complexity | Maintainability |\n`
    md += `|--------|------------|----------------|\n`
    for (const module of complexModules) {
      md += `| ${module.name} | ${module.complexity} | ${module.maintainabilityIndex}/100 |\n`
    }
    md += `\n`

    return md
  }

  /**
   * Generate dependency graph section (Markdown)
   */
  private generateDependencyGraphMD(analysis: ArchitectureAnalysis): string {
    let md = `## Dependency Graph\n\n`

    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Total Dependencies | ${analysis.dependencyGraph.edges.length} |\n`
    md += `| Graph Depth | ${analysis.dependencyGraph.depth} |\n`
    md += `| Graph Density | ${(analysis.dependencyGraph.density * 100).toFixed(1)}% |\n`
    md += `| Circular Dependencies | ${analysis.dependencyGraph.cycles.length} |\n`
    md += `\n`

    if (analysis.dependencyGraph.cycles.length > 0) {
      md += `### ⚠️ Circular Dependencies Detected\n\n`
      for (const cycle of analysis.dependencyGraph.cycles.slice(0, 5)) {
        const paths = cycle.map(p => p.split('/').pop() || p)
        md += `- ${paths.join(' → ')}\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Generate coupling analysis section (Markdown)
   */
  private generateCouplingAnalysisMD(analysis: ArchitectureAnalysis): string {
    let md = `## Coupling Analysis\n\n`

    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Afferent Coupling | ${analysis.couplingAnalysis.afferentCoupling} |\n`
    md += `| Efferent Coupling | ${analysis.couplingAnalysis.efferentCoupling} |\n`
    md += `| Instability | ${analysis.couplingAnalysis.instability.toFixed(2)} |\n`
    md += `\n`

    if (analysis.couplingAnalysis.hotspots.length > 0) {
      md += `### Coupling Hotspots\n\n`
      md += `| Severity | Type | Description |\n`
      md += `|----------|------|-------------|\n`
      for (const hotspot of analysis.couplingAnalysis.hotspots.slice(0, 10)) {
        const severity = hotspot.severity.toUpperCase()
        md += `| ${severity} | ${hotspot.couplingType} | ${hotspot.description} |\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Generate technical debt section (Markdown)
   */
  private generateTechnicalDebtMD(analysis: ArchitectureAnalysis): string {
    let md = `## Technical Debt Analysis\n\n`

    md += `| Metric | Value |\n`
    md += `|--------|-------|\n`
    md += `| Total Debt Score | ${(analysis.technicalDebt.totalDebt * 100).toFixed(1)}% |\n`
    md += `| Debt Ratio | ${(analysis.technicalDebt.debtRatio * 100).toFixed(1)}% |\n`
    md += `| Estimated Fix Time | ${analysis.technicalDebt.estimatedFixTime} hours |\n`
    md += `| Priority | ${analysis.technicalDebt.priority.toUpperCase()} |\n`
    md += `\n`

    // Debt by category
    md += `### Debt by Category\n\n`
    md += `| Category | Debt | Percentage | Count |\n`
    md += `|----------|------|------------|-------|\n`
    for (const category of analysis.technicalDebt.debtByCategory) {
      md += `| ${this.formatCategory(category.category)} | ${(category.debt * 100).toFixed(1)}% | ${category.percentage}% | ${category.count} |\n`
    }
    md += `\n`

    // Top debt items
    const topDebtItems = [...analysis.technicalDebt.debtItems]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)

    md += `### Top Technical Debt Items\n\n`
    md += `| Priority | Type | Location | Description |\n`
    md += `|----------|------|----------|-------------|\n`
    for (const item of topDebtItems) {
      const location = item.location.split('/').pop() || item.location
      md += `| P${item.priority} | ${item.type} | ${location} | ${item.description.substring(0, 50)}... |\n`
    }
    md += `\n`

    return md
  }

  /**
   * Generate recommendations section (Markdown)
   */
  private generateRecommendationsMD(analysis: ArchitectureAnalysis): string {
    let md = `## Recommendations\n\n`

    for (const rec of analysis.recommendations) {
      md += `### ${rec.title}\n\n`
      md += `**Priority:** ${rec.priority.toUpperCase()} | **Category:** ${rec.category}\n\n`
      md += `${rec.description}\n\n`
      md += `**Affected Modules:** ${rec.affectedModules.length}\n\n`
      md += `**Steps:**\n\n`
      for (const step of rec.steps) {
        md += `1. ${step}\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Generate optimization plan section (Markdown)
   */
  private generateOptimizationPlanMD(plan: OptimizationPlan): string {
    let md = `## Optimization Plan\n\n`

    // Refactoring plan
    md += `### Refactoring Plan\n\n`
    md += `**Priority:** ${plan.refactoringPlan.priority.toUpperCase()} | **Estimated Effort:** ${plan.refactoringPlan.estimatedEffort}h | **Risk:** ${plan.refactoringPlan.riskLevel.toUpperCase()}\n\n`

    if (plan.refactoringPlan.modules.length > 0) {
      md += `#### Modules to Refactor\n\n`
      md += `| Module | Priority | Issues |\n`
      md += `|--------|----------|--------|\n`
      for (const module of plan.refactoringPlan.modules.slice(0, 10)) {
        md += `| ${module.name} | P${module.priority} | ${module.issues.length} |\n`
      }
      md += `\n`
    }

    // Performance optimizations
    md += `### Performance Optimizations\n\n`
    md += `**Current Metrics:**\n`
    md += `- Complexity Score: ${plan.performancePlan.currentMetrics.complexityScore}\n`
    md += `- Maintainability Score: ${plan.performancePlan.currentMetrics.maintainabilityScore}\n\n`
    md += `**Estimated Improvement:** ${plan.performancePlan.estimatedImprovement}\n\n`

    if (plan.performancePlan.optimizations.length > 0) {
      md += `#### Optimization Opportunities\n\n`
      md += `| Title | Category | Effort | Impact |\n`
      md += `|-------|----------|--------|--------|\n`
      for (const opt of plan.performancePlan.optimizations.slice(0, 10)) {
        md += `| ${opt.title} | ${opt.category} | ${opt.effort} | ${opt.impact} |\n`
      }
      md += `\n`
    }

    // Security hardening
    md += `### Security Hardening\n\n`
    md += `**Overall Risk:** ${plan.securityPlan.riskAssessment.overallRisk.toUpperCase()}\n\n`
    md += `**Estimated Risk Reduction:** ${plan.securityPlan.estimatedRiskReduction}\n\n`

    if (plan.securityPlan.hardening.length > 0) {
      md += `#### Hardening Measures\n\n`
      md += `| Title | Priority |\n`
      md += `|-------|----------|\n`
      for (const h of plan.securityPlan.hardening) {
        md += `| ${h.title} | P${h.priority} |\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Generate roadmap section (Markdown)
   */
  private generateRoadmapMD(plan: OptimizationPlan): string {
    let md = `## Optimization Roadmap\n\n`

    md += `**Total Duration:** ${plan.roadmap.totalDuration} weeks | **Total Effort:** ${plan.roadmap.totalEffort} hours\n\n`

    for (const phase of plan.roadmap.phases) {
      md += `### Phase: ${phase.name}\n\n`
      md += `**Duration:** ${phase.duration} weeks | **Tasks:** ${phase.tasks.length}\n\n`
      md += `**Focus Areas:**\n`
      for (const focus of phase.focus) {
        md += `- ${focus}\n`
      }
      md += `\n`

      md += `**Tasks:**\n\n`
      md += `| Task | Priority | Effort (h) |\n`
      md += `|------|----------|------------|\n`
      for (const task of phase.tasks.slice(0, 10)) {
        md += `| ${task.title} | P${task.priority} | ${task.effort} |\n`
      }
      md += `\n`

      md += `**Deliverables:**\n`
      for (const deliverable of phase.deliverables) {
        md += `- ${deliverable}\n`
      }
      md += `\n`
    }

    // Milestones
    md += `### Milestones\n\n`
    for (const milestone of plan.roadmap.milestones) {
      md += `🎯 **${milestone.name}**\n`
      for (const criteria of milestone.criteria) {
        md += `- ${criteria}\n`
      }
      md += `\n`
    }

    return md
  }

  /**
   * Create report metadata
   */
  private createMetadata(analysis: ArchitectureAnalysis): ReportMetadata {
    return {
      title: 'Architecture Analysis Report',
      project: this.extractProjectName(analysis.projectRoot),
      version: '1.0.0',
      author: 'AG-UI Skill Platform',
      sections: [
        'Executive Summary',
        'Architecture Overview',
        'Complexity Analysis',
        'Dependency Graph',
        'Coupling Analysis',
        'Technical Debt',
        'Recommendations',
        'Optimization Plan',
        'Roadmap',
      ],
    }
  }

  /**
   * Extract project name from root path
   */
  private extractProjectName(projectRoot: string): string {
    return projectRoot.split('/').pop() || projectRoot
  }

  /**
   * Get node color based on type
   */
  private getNodeColor(type: string): string {
    const typeColors: Record<string, string> = {
      component: '#3b82f6',
      service: '#10b981',
      route: '#f59e0b',
      validator: '#ef4444',
      type: '#8b5cf6',
      util: '#6b7280',
      config: '#ec4899',
      other: '#9ca3af',
    }
    return typeColors[type] || typeColors.other
  }

  /**
   * Format category name
   */
  private formatCategory(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Calculate scores for radar chart
   */
  private calculateSecurityScore(analysis: ArchitectureAnalysis): number {
    const debtItems = analysis.technicalDebt.debtItems.filter(i => i.type.includes('security'))
    const penalty = debtItems.length * 5
    return Math.max(0, 100 - penalty)
  }

  private calculateQualityScore(analysis: ArchitectureAnalysis): number {
    const avgMI = analysis.complexityMetrics.maintainabilityIndex
    const complexityPenalty = analysis.complexityMetrics.averageComplexity * 0.5
    return Math.max(0, Math.min(100, avgMI - complexityPenalty + 50))
  }

  private calculatePerformanceScore(analysis: ArchitectureAnalysis): number {
    const avgComplexity = analysis.complexityMetrics.averageComplexity
    return Math.max(0, 100 - avgComplexity)
  }

  private calculateModularityScore(analysis: ArchitectureAnalysis): number {
    const cyclePenalty = analysis.dependencyGraph.cycles.length * 10
    const couplingPenalty = analysis.couplingAnalysis.hotspots.length * 5
    return Math.max(0, 100 - cyclePenalty - couplingPenalty)
  }

  /**
   * Convert Markdown to HTML (simplified)
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  /**
   * Get light theme CSS
   */
  private getLightTheme(): string {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #fff; }
      header { border-bottom: 2px solid #e1e4e8; padding-bottom: 20px; margin-bottom: 30px; }
      h1 { color: #24292e; }
      h2 { color: #24292e; border-bottom: 1px solid #e1e4e8; padding-bottom: 8px; margin-top: 30px; }
      h3 { color: #24292e; margin-top: 25px; }
      table { border-collapse: collapse; width: 100%; margin: 20px 0; }
      th, td { border: 1px solid #dfe2e5; padding: 10px 15px; text-align: left; }
      th { background: #f6f8fa; font-weight: 600; }
      tr:nth-child(even) { background: #f6f8fa; }
      code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; }
      .meta { color: #586069; }
      footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e1e4e8; color: #586069; text-align: center; }
      .chart-container { margin: 30px 0; }
    `
  }

  /**
   * Get dark theme CSS
   */
  private getDarkTheme(): string {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #c9d1d9; max-width: 1200px; margin: 0 auto; padding: 20px; background: #0d1117; }
      header { border-bottom: 2px solid #30363d; padding-bottom: 20px; margin-bottom: 30px; }
      h1 { color: #f0f6fc; }
      h2 { color: #f0f6fc; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-top: 30px; }
      h3 { color: #f0f6fc; margin-top: 25px; }
      table { border-collapse: collapse; width: 100%; margin: 20px 0; }
      th, td { border: 1px solid #30363d; padding: 10px 15px; text-align: left; }
      th { background: #161b22; font-weight: 600; }
      tr:nth-child(even) { background: #161b22; }
      code { background: #161b22; padding: 2px 6px; border-radius: 3px; }
      .meta { color: #8b949e; }
      footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #30363d; color: #8b949e; text-align: center; }
      .chart-container { margin: 30px 0; }
    `
  }

  /**
   * Get chart initialization script
   */
  private getChartInitialization(analysis: ArchitectureAnalysis, optimizationPlan?: OptimizationPlan): string {
    const vizData = this.generateVisualizationData(analysis, optimizationPlan)

    return `
      // Radar Chart
      const radarCtx = document.getElementById('radarChart');
      if (radarCtx) {
        new Chart(radarCtx, {
          type: 'radar',
          data: {
            labels: ${JSON.stringify(vizData.radarChart.categories)},
            datasets: [{
              label: 'Architecture Health',
              data: ${JSON.stringify(vizData.radarChart.scores)},
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 2,
            }]
          },
          options: {
            scales: {
              r: {
                beginAtZero: true,
                max: 100,
              }
            }
          }
        });
      }
    `
  }

  /**
   * Save report to file
   */
  async saveReport(report: GeneratedReport, outputPath: string): Promise<void> {
    await writeFile(outputPath, report.content, 'utf-8')
  }
}

// Singleton instance
let reportGenerator: ReportGenerator | null = null

export function getReportGenerator(): ReportGenerator {
  if (!reportGenerator) {
    reportGenerator = new ReportGenerator()
  }
  return reportGenerator
}

export function initializeReportGenerator(): ReportGenerator {
  reportGenerator = new ReportGenerator()
  return reportGenerator
}
