/**
 * API Client for Skill Upload Operations
 */

const API_BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:4000'

export interface SkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  license?: string
  repository?: string
  keywords?: string[]
  main?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  score: number
  metadata: SkillMetadata
}

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
  validation?: ValidationResult
  error?: string
}

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
  validation?: ValidationResult
  error?: string
}

/**
 * Upload a skill ZIP file
 */
export async function uploadSkill(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadSkillResponse> {
  const formData = new FormData()
  formData.append('skill', file)

  const xhr = new XMLHttpRequest()
  
  return new Promise((resolve, reject) => {
    xhr.open('POST', `${API_BASE_URL}/api/skills/upload`, true)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response)
        } else {
          reject(new Error(response.error || 'Upload failed'))
        }
      } catch (error) {
        reject(new Error('Failed to parse response'))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error during upload'))
    }

    xhr.send(formData)
  })
}

/**
 * Import skill from GitHub
 */
export async function importFromGitHub(
  url: string,
  branch?: string
): Promise<GitHubImportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/skills/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, branch }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'GitHub import failed')
  }

  return data
}

/**
 * Get all skills
 */
export async function getSkills(): Promise<{
  skills: Array<{
    id: string
    name: string
    description: string
    version: string
    author?: string
    status: string
    createdAt: string
    updatedAt: string
  }>
  total: number
  timestamp: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/skills`)
  if (!response.ok) {
    throw new Error('Failed to fetch skills')
  }
  return response.json()
}

/**
 * Get skill by ID
 */
export async function getSkillById(id: string): Promise<{
  id: string
  name: string
  description: string
  version: string
  author?: string
  status: string
  createdAt: string
  updatedAt: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/skills/${id}`)
  if (!response.ok) {
    throw new Error('Skill not found')
  }
  return response.json()
}

// ==================== Validation API ====================

export interface ValidationScoreBreakdown {
  score: number
  factors: Array<{
    id: string
    name: string
    weight: number
    score: number
    description: string
  }>
  deductions: Array<{
    id: string
    reason: string
    amount: number
    category: string
    severity: 'critical' | 'high' | 'medium' | 'low'
  }>
  bonuses: Array<{
    id: string
    reason: string
    amount: number
    category: string
  }>
}

export interface ValidationScore {
  id: string
  skillName: string
  skillVersion: string
  security: ValidationScoreBreakdown
  quality: ValidationScoreBreakdown
  performance: ValidationScoreBreakdown
  documentation: ValidationScoreBreakdown
  overall: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  passed: boolean
  timestamp: string
}

export interface ValidationIssue {
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

export interface ValidationSuggestion {
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

export interface ValidationResultDetail {
  id: string
  skillName: string
  skillVersion: string
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  passed: boolean
  score: ValidationScore
  issues: ValidationIssue[]
  suggestions: ValidationSuggestion[]
  summary: string
  duration: number
  timestamp: string
}

export interface ValidationJobStatus {
  jobId: string
  status: 'queued' | 'validating' | 'static-analysis' | 'ai-review' | 'scoring' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  skillName: string
  skillVersion: string
  progress: number
  addedAt: string
  startedAt?: string
  completedAt?: string
  result?: ValidationResultDetail
  error?: string
  queuePosition?: number
}

export interface ValidationStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  timeout: number
  avgDuration: number
  estimatedWaitTime: number
}

/**
 * Upload skill package for validation
 */
export async function uploadForValidation(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ jobId: string; status: string; estimatedWaitTime?: number }> {
  const formData = new FormData()
  formData.append('package', file)

  const xhr = new XMLHttpRequest()

  return new Promise((resolve, reject) => {
    xhr.open('POST', `${API_BASE_URL}/api/validation/validate`, true)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response)
        } else {
          reject(new Error(response.error || 'Validation upload failed'))
        }
      } catch (error) {
        reject(new Error('Failed to parse response'))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error during validation upload'))
    }

    xhr.send(formData)
  })
}

/**
 * Get validation job status
 */
export async function getValidationJob(jobId: string): Promise<ValidationJobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/validation/job/${jobId}`)
  if (!response.ok) {
    throw new Error('Validation job not found')
  }
  return response.json()
}

/**
 * Get validation stats
 */
export async function getValidationStats(): Promise<ValidationStats> {
  const response = await fetch(`${API_BASE_URL}/api/validation/stats`)
  if (!response.ok) {
    throw new Error('Failed to fetch validation stats')
  }
  return response.json()
}

/**
 * Get validation history
 */
export async function getValidationHistory(limit?: number): Promise<{ jobs: ValidationJobStatus[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/api/validation/history${limit ? `?limit=${limit}` : ''}`)
  if (!response.ok) {
    throw new Error('Failed to fetch validation history')
  }
  return response.json()
}

/**
 * Cancel validation job
 */
export async function cancelValidationJob(jobId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/validation/cancel/${jobId}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error('Failed to cancel validation job')
  }
  return response.json()
}

/**
 * Get validation score breakdown
 */
export async function getValidationScore(jobId: string): Promise<{ score: ValidationScore }> {
  const response = await fetch(`${API_BASE_URL}/api/validation/score/${jobId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch validation score')
  }
  return response.json()
}

/**
 * Get validation report
 */
export async function getValidationReport(jobId: string): Promise<{ report: string }> {
  const response = await fetch(`${API_BASE_URL}/api/validation/report/${jobId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch validation report')
  }
  return response.json()
}

// ==================== Architecture Analysis Types ====================

export interface ArchitectureAnalysisJob {
  id: string
  projectPath: string
  status: 'queued' | 'analyzing' | 'completed' | 'failed'
  progress: number
  createdAt: string
  completedAt?: string
  error?: string
}

export interface ArchitectureAnalysisResult {
  analysis: {
    id: string
    projectRoot: string
    timestamp: string
    modules: ModuleInfo[]
    dependencyGraph: DependencyGraph
    complexityMetrics: ComplexityMetrics
    couplingAnalysis: CouplingAnalysis
    technicalDebt: TechnicalDebtAnalysis
    recommendations: ArchitectureRecommendation[]
  }
  optimization: {
    id: string
    analysisId: string
    timestamp: string
    executiveSummary: ExecutiveSummary
    refactoringPlan: RefactoringPlan
    performancePlan: PerformancePlan
    securityPlan: SecurityPlan
    roadmap: OptimizationRoadmap
    estimatedImpact: ImpactAssessment
  }
}

export interface ModuleInfo {
  id: string
  path: string
  name: string
  type: string
  size: number
  lines: number
  imports: string[]
  exports: string[]
  dependencies: ModuleDependency[]
  dependents: string[]
  complexity: number
  maintainabilityIndex: number
}

export interface ModuleDependency {
  moduleId: string
  path: string
  type: 'import' | 'require' | 'dynamic'
  isExternal: boolean
  isCircular: boolean
}

export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cycles: string[][]
  depth: number
  density: number
}

export interface GraphNode {
  id: string
  label: string
  type: string
  size: number
  complexity: number
}

export interface GraphEdge {
  source: string
  target: string
  type: 'import' | 'require' | 'dynamic'
  weight: number
}

export interface ComplexityMetrics {
  totalLines: number
  totalFiles: number
  totalModules: number
  averageModuleSize: number
  averageComplexity: number
  cyclomaticComplexity: number
  cognitiveComplexity: number
  maintainabilityIndex: number
  technicalDebtRatio: number
}

export interface CouplingAnalysis {
  afferentCoupling: number
  efferentCoupling: number
  instability: number
  moduleCoupling: ModuleCoupling[]
  hotspots: CouplingHotspot[]
}

export interface ModuleCoupling {
  moduleId: string
  incoming: number
  outgoing: number
  couplingScore: number
  stability: number
}

export interface CouplingHotspot {
  modules: string[]
  couplingType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

export interface TechnicalDebtAnalysis {
  totalDebt: number
  debtRatio: number
  debtByCategory: DebtCategory[]
  debtItems: TechnicalDebtItem[]
  estimatedFixTime: number
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface DebtCategory {
  category: string
  debt: number
  percentage: number
  count: number
}

export interface TechnicalDebtItem {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  description: string
  estimatedFixTime: number
  impact: number
  priority: number
}

export interface ArchitectureRecommendation {
  id: string
  title: string
  description: string
  category: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  impact: number
  effort: number
  affectedModules: string[]
  steps: string[]
}

export interface ExecutiveSummary {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  criticalIssues: number
  highPriorityIssues: number
  totalDebt: number
  topRecommendations: string[]
  quickWins: QuickWin[]
}

export interface QuickWin {
  id: string
  title: string
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  estimatedTime: number
  category: string
}

export interface RefactoringPlan {
  priority: 'critical' | 'high' | 'medium' | 'low'
  modules: RefactoringModule[]
  strategies: RefactoringStrategy[]
  estimatedEffort: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
}

export interface RefactoringModule {
  id: string
  name: string
  path: string
  issues: string[]
  suggestedActions: RefactoringAction[]
  priority: number
  dependencies: string[]
}

export interface RefactoringAction {
  id: string
  action: string
  description: string
  estimatedTime: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface RefactoringStrategy {
  id: string
  name: string
  description: string
  applicability: string[]
  benefits: string[]
  risks: string[]
  steps: string[]
}

export interface PerformancePlan {
  currentMetrics: PerformanceMetrics
  bottlenecks: PerformanceBottleneck[]
  optimizations: PerformanceOptimization[]
  estimatedImprovement: string
}

export interface PerformanceMetrics {
  complexityScore: number
  couplingScore: number
  maintainabilityScore: number
}

export interface PerformanceBottleneck {
  id: string
  type: string
  location: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  impact: string
}

export interface PerformanceOptimization {
  id: string
  title: string
  description: string
  category: string
  priority: number
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  implementation: string[]
}

export interface SecurityPlan {
  riskAssessment: RiskAssessment
  vulnerabilities: SecurityVulnerability[]
  hardening: SecurityHardening[]
  estimatedRiskReduction: string
}

export interface RiskAssessment {
  overallRisk: 'critical' | 'high' | 'medium' | 'low'
  riskByCategory: Record<string, string>
  topRisks: string[]
}

export interface SecurityVulnerability {
  id: string
  type: string
  location: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
}

export interface SecurityHardening {
  id: string
  title: string
  description: string
  priority: number
  implementation: string[]
}

export interface OptimizationRoadmap {
  phases: RoadmapPhase[]
  totalDuration: number
  totalEffort: number
  milestones: Milestone[]
}

export interface RoadmapPhase {
  id: string
  name: string
  duration: number
  focus: string[]
  tasks: RoadmapTask[]
  deliverables: string[]
}

export interface RoadmapTask {
  id: string
  title: string
  description: string
  priority: number
  effort: number
  category: string
}

export interface Milestone {
  id: string
  name: string
  phase: string
  criteria: string[]
  deliverables: string[]
}

export interface ImpactAssessment {
  qualityImprovement: string
  performanceImprovement: string
  securityImprovement: string
  maintainabilityImprovement: string
  roi: ROI
}

export interface ROI {
  estimatedCostSavings: string
  productivityGain: string
  riskReduction: string
  paybackPeriod: string
}

export interface VisualizationData {
  dependencyGraph: {
    nodes: {
      id: string
      label: string
      type: string
      size: number
      complexity: number
      x: number
      y: number
      color: string
      group: string
    }[]
    edges: {
      source: string
      target: string
      type: string
      weight: number
      color: string
      isCircular: boolean
    }[]
  }
  moduleMetrics: {
    name: string
    path: string
    lines: number
    complexity: number
    maintainability: number
    dependencies: number
    dependents: number
  }[]
  debtChart: {
    categories: string[]
    values: number[]
    percentages: number[]
  }
  roadmapTimeline: {
    phases: {
      id: string
      name: string
      startWeek: number
      duration: number
      tasks: number
    }[]
  }
  radarChart: {
    categories: string[]
    scores: number[]
    maxScore: number
  }
}

// ==================== Architecture Analysis API Functions ====================

/**
 * Start architecture analysis
 */
export async function startArchitectureAnalysis(projectPath: string): Promise<{ jobId: string; status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectPath }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to start architecture analysis')
  }

  return response.json()
}

/**
 * Get architecture analysis job status
 */
export async function getArchitectureJob(jobId: string): Promise<ArchitectureAnalysisJob & { result?: ArchitectureAnalysisResult }> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/job/${jobId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch architecture job status')
  }

  return response.json()
}

/**
 * Get architecture analysis result
 */
export async function getArchitectureResult(jobId: string): Promise<ArchitectureAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/result/${jobId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch architecture analysis result')
  }

  return response.json()
}

/**
 * Get visualization data for charts
 */
export async function getArchitectureVisualization(jobId: string): Promise<VisualizationData> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/visualization/${jobId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch visualization data')
  }

  return response.json()
}

/**
 * Download architecture report
 */
export async function downloadArchitectureReport(jobId: string, format: 'markdown' | 'html' | 'json' = 'markdown'): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/report/${jobId}?format=${format}`)

  if (!response.ok) {
    throw new Error('Failed to download report')
  }

  return response.blob()
}

/**
 * List all architecture analysis jobs
 */
export async function getArchitectureJobs(): Promise<{ jobs: ArchitectureAnalysisJob[] }> {
  const response = await fetch(`${API_BASE_URL}/api/architecture/jobs`)

  if (!response.ok) {
    throw new Error('Failed to fetch architecture jobs')
  }

  return response.json()
}
