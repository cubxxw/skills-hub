/**
 * OptimizationSuggestions Page
 * Displays architecture analysis results with optimization recommendations
 * - Architecture visualization
 * - Technical debt breakdown
 * - Refactoring suggestions
 * - Performance optimizations
 * - Security recommendations
 * - Executable roadmap
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  startArchitectureAnalysis,
  getArchitectureJob,
  getArchitectureVisualization,
  downloadArchitectureReport,
  type ArchitectureAnalysisJob,
  type ArchitectureAnalysisResult,
  type VisualizationData,
  type QuickWin,
  type RefactoringModule,
  type PerformanceOptimization,
  type SecurityHardening,
  type RoadmapPhase,
} from '../lib/api-client'
import { ArchitectureDiagram } from '../components/ArchitectureDiagram'

interface TabProps {
  label: string
  icon: string
  active: boolean
  onClick: () => void
  badge?: number
}

const Tab: React.FC<TabProps> = ({ label, icon, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors relative ${
      active
        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
    }`}
  >
    <span>{icon}</span>
    <span className="hidden sm:inline">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
)

export const OptimizationSuggestions: React.FC = () => {
  const [projectPath, setProjectPath] = useState('')
  const [currentJob, setCurrentJob] = useState<ArchitectureAnalysisJob | null>(null)
  const [result, setResult] = useState<ArchitectureAnalysisResult | null>(null)
  const [visualization, setVisualization] = useState<VisualizationData | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Poll for job status
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'analyzing') return

    const pollInterval = setInterval(async () => {
      try {
        const job = await getArchitectureJob(currentJob.id)
        setCurrentJob(job)

        if (job.status === 'completed' && job.result) {
          setResult(job.result)
          // Load visualization data
          const viz = await getArchitectureVisualization(currentJob.id)
          setVisualization(viz)
        } else if (job.status === 'failed') {
          setError(job.error || 'Analysis failed')
          setIsLoading(false)
        }

        if (job.status !== 'analyzing') {
          setIsLoading(false)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Error polling job status:', err)
        setError('Failed to fetch analysis status')
        setIsLoading(false)
        clearInterval(pollInterval)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [currentJob])

  // Start analysis
  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectPath.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    setVisualization(null)

    try {
      const response = await startArchitectureAnalysis(projectPath)
      setCurrentJob({
        id: response.jobId,
        projectPath,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis')
      setIsLoading(false)
    }
  }

  // Download report
  const handleDownloadReport = async (format: 'markdown' | 'html' | 'json') => {
    if (!currentJob) return

    setIsDownloading(true)
    try {
      const blob = await downloadArchitectureReport(currentJob.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `architecture-report.${format === 'markdown' ? 'md' : format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading report:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  // Health badge
  const getHealthBadge = useCallback((health: string) => {
    const badges: Record<string, string> = {
      excellent: '🟢 Excellent',
      good: '🟡 Good',
      fair: '🟠 Fair',
      poor: '🔴 Poor',
      critical: '⚫ Critical',
    }
    return badges[health] || health
  }, [])

  // Priority badge
  const getPriorityBadge = useCallback((priority: string) => {
    const badges: Record<string, string> = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white',
    }
    return badges[priority] || 'bg-gray-500 text-white'
  }, [])

  // Render loading state
  if (isLoading && !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            🏗️ Architecture Analysis
          </h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Analyzing Architecture...
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {currentJob?.status === 'queued' && 'Queuing analysis job...'}
                {currentJob?.status === 'analyzing' && 'Running deep analysis...'}
              </p>
              {currentJob && (
                <div className="w-full max-w-md mx-auto">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${currentJob.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {currentJob.progress}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error && !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Analysis Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  setCurrentJob(null)
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render initial form
  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            🏗️ Architecture Analysis
          </h1>

          <form onSubmit={handleStartAnalysis} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="mb-6">
              <label htmlFor="projectPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Path
              </label>
              <input
                type="text"
                id="projectPath"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Enter the absolute path to the project you want to analyze
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !projectPath.trim()}
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🚀 Start Deep Analysis
            </button>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                What will be analyzed?
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Dependency graph and circular dependencies</li>
                <li>• Code complexity and maintainability</li>
                <li>• Module coupling and architecture smells</li>
                <li>• Technical debt identification</li>
                <li>• AI-powered optimization recommendations</li>
                <li>• Security hardening suggestions</li>
                <li>• Executable roadmap with milestones</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Render results
  const { analysis, optimization } = result

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                🏗️ Architecture Analysis Results
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {analysis.projectRoot}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Health Badge */}
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                optimization.executiveSummary.overallHealth === 'excellent' ||
                optimization.executiveSummary.overallHealth === 'good'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : optimization.executiveSummary.overallHealth === 'fair'
                    ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
                {getHealthBadge(optimization.executiveSummary.overallHealth)}
              </div>

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => handleDownloadReport('markdown')}
                  disabled={isDownloading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  📥 Export
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mt-6 overflow-x-auto">
            <Tab
              label="Overview"
              icon="📊"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <Tab
              label="Architecture"
              icon="🏛️"
              active={activeTab === 'architecture'}
              onClick={() => setActiveTab('architecture')}
            />
            <Tab
              label="Quick Wins"
              icon="🎯"
              active={activeTab === 'quickwins'}
              onClick={() => setActiveTab('quickwins')}
              badge={optimization.executiveSummary.quickWins.length}
            />
            <Tab
              label="Refactoring"
              icon="🔧"
              active={activeTab === 'refactoring'}
              onClick={() => setActiveTab('refactoring')}
              badge={optimization.refactoringPlan.modules.length}
            />
            <Tab
              label="Performance"
              icon="⚡"
              active={activeTab === 'performance'}
              onClick={() => setActiveTab('performance')}
            />
            <Tab
              label="Security"
              icon="🔒"
              active={activeTab === 'security'}
              onClick={() => setActiveTab('security')}
            />
            <Tab
              label="Roadmap"
              icon="🗺️"
              active={activeTab === 'roadmap'}
              onClick={() => setActiveTab('roadmap')}
            />
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Metrics Cards */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                📁 Total Files
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analysis.complexityMetrics.totalFiles}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {analysis.complexityMetrics.totalLines.toLocaleString()} lines
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                📈 Avg Complexity
              </h3>
              <p className={`text-3xl font-bold ${
                analysis.complexityMetrics.averageComplexity > 50
                  ? 'text-red-500'
                  : analysis.complexityMetrics.averageComplexity > 30
                    ? 'text-yellow-500'
                    : 'text-green-500'
              }`}>
                {analysis.complexityMetrics.averageComplexity.toFixed(1)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Maintainability: {analysis.complexityMetrics.maintainabilityIndex}/100
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                ⚠️ Critical Issues
              </h3>
              <p className="text-3xl font-bold text-red-500">
                {optimization.executiveSummary.criticalIssues}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {optimization.executiveSummary.highPriorityIssues} high priority
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                💰 Technical Debt
              </h3>
              <p className="text-3xl font-bold text-orange-500">
                {(optimization.executiveSummary.totalDebt * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                ~{analysis.technicalDebt.estimatedFixTime}h to fix
              </p>
            </div>

            {/* Top Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:col-span-2 lg:col-span-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🎯 Top Recommendations
              </h3>
              <div className="space-y-3">
                {optimization.executiveSummary.topRecommendations.slice(0, 5).map((rec, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <p className="text-gray-900 dark:text-white">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && visualization && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🏛️ Architecture Visualization
            </h3>
            <div className="h-[600px]">
              <ArchitectureDiagram
                data={visualization}
                width={800}
                height={600}
                showLabels
                showCircularDependencies
              />
            </div>
          </div>
        )}

        {activeTab === 'quickwins' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🎯 Quick Wins
            </h3>
            <div className="space-y-4">
              {optimization.executiveSummary.quickWins.map((win: QuickWin) => (
                <div
                  key={win.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {win.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                        {win.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          ⏱️ {win.estimatedTime}h
                        </span>
                        <span className={`px-2 py-1 rounded ${
                          win.effort === 'low'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                            : win.effort === 'medium'
                              ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                        }`}>
                          Effort: {win.effort}
                        </span>
                        <span className={`px-2 py-1 rounded ${
                          win.impact === 'high'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                            : win.impact === 'medium'
                              ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          Impact: {win.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'refactoring' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🔧 Refactoring Plan
            </h3>
            <div className="space-y-4">
              {optimization.refactoringPlan.modules.map((module: RefactoringModule) => (
                <div
                  key={module.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {module.name}
                    </h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(module.priority >= 8 ? 'critical' : module.priority >= 5 ? 'high' : 'medium')}`}>
                      P{module.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {module.path}
                  </p>
                  {module.issues.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                      {module.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {module.suggestedActions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                        Suggested Actions:
                      </h5>
                      <div className="space-y-2">
                        {module.suggestedActions.map((action) => (
                          <div
                            key={action.id}
                            className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded"
                          >
                            <span className="font-medium">{action.action}:</span> {action.description}
                            <span className="ml-2 text-gray-500">({action.estimatedTime}h, {action.difficulty})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚡ Performance Optimizations
            </h3>
            <div className="space-y-4">
              {optimization.performancePlan.optimizations.map((opt: PerformanceOptimization) => (
                <div
                  key={opt.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {opt.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        opt.effort === 'low' ? 'bg-green-100 dark:bg-green-900/20 text-green-800' :
                        opt.effort === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800' :
                        'bg-red-100 dark:bg-red-900/20 text-red-800'
                      }`}>
                        {opt.effort}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        opt.impact === 'high' ? 'bg-green-100 dark:bg-green-900/20 text-green-800' :
                        opt.impact === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800'
                      }`}>
                        {opt.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    {opt.description}
                  </p>
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                      Implementation Steps:
                    </h5>
                    <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {opt.implementation.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🔒 Security Hardening
            </h3>
            <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚠️</span>
                <span className="font-semibold text-orange-900 dark:text-orange-100">
                  Overall Risk: {optimization.securityPlan.riskAssessment.overallRisk.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-orange-800 dark:text-orange-200">
                {optimization.securityPlan.estimatedRiskReduction}
              </p>
            </div>

            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              Hardening Measures
            </h4>
            <div className="space-y-4">
              {optimization.securityPlan.hardening.map((h: SecurityHardening) => (
                <div
                  key={h.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {h.title}
                    </h4>
                    <span className="text-sm text-gray-500">Priority: {h.priority}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    {h.description}
                  </p>
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                      Implementation:
                    </h5>
                    <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {h.implementation.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                🗺️ Optimization Roadmap
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{optimization.roadmap.totalDuration}</span> weeks total •{' '}
                <span className="font-medium">{optimization.roadmap.totalEffort}</span> hours effort
              </div>
            </div>

            <div className="space-y-6">
              {optimization.roadmap.phases.map((phase: RoadmapPhase, index) => (
                <div
                  key={phase.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {phase.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Duration: {phase.duration} weeks • {phase.tasks.length} tasks
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {phase.focus.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ml-12">
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                      Tasks:
                    </h5>
                    <div className="space-y-2">
                      {phase.tasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                        >
                          <span className="text-gray-900 dark:text-white">{task.title}</span>
                          <span className="text-gray-500">{task.effort}h</span>
                        </div>
                      ))}
                      {phase.tasks.length > 5 && (
                        <p className="text-sm text-gray-500">
                          +{phase.tasks.length - 5} more tasks
                        </p>
                      )}
                    </div>

                    <div className="mt-4">
                      <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                        Deliverables:
                      </h5>
                      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {phase.deliverables.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div className="mt-8">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                🎯 Milestones
              </h4>
              <div className="space-y-4">
                {optimization.roadmap.milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
                  >
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h5 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                        {milestone.name}
                      </h5>
                      <ul className="list-disc list-inside text-sm text-green-800 dark:text-green-200 space-y-1">
                        {milestone.criteria.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OptimizationSuggestions
