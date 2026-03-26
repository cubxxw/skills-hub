/**
 * ReportExport Component
 * Provides export functionality for architecture analysis reports
 * - Markdown export
 * - HTML export
 * - JSON export
 * - PDF export (via HTML print)
 */

import React, { useState } from 'react'
import {
  downloadArchitectureReport,
  type ArchitectureAnalysisResult,
} from '../lib/api-client'

export interface ReportExportProps {
  jobId: string
  result?: ArchitectureAnalysisResult | null
  onExportStart?: () => void
  onExportComplete?: () => void
  onExportError?: (error: string) => void
}

export interface ExportOption {
  format: 'markdown' | 'html' | 'json' | 'pdf'
  label: string
  icon: string
  description: string
  mimeType: string
  extension: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'markdown',
    label: 'Markdown',
    icon: '📝',
    description: 'Export as Markdown for GitHub or documentation',
    mimeType: 'text/markdown',
    extension: 'md',
  },
  {
    format: 'html',
    label: 'HTML',
    icon: '🌐',
    description: 'Export as interactive HTML report',
    mimeType: 'text/html',
    extension: 'html',
  },
  {
    format: 'json',
    label: 'JSON',
    icon: '📊',
    description: 'Export raw data for further processing',
    mimeType: 'application/json',
    extension: 'json',
  },
  {
    format: 'pdf',
    label: 'PDF',
    icon: '📄',
    description: 'Export as PDF document (via print)',
    mimeType: 'application/pdf',
    extension: 'pdf',
  },
]

export const ReportExport: React.FC<ReportExportProps> = ({
  jobId,
  result,
  onExportStart,
  onExportComplete,
  onExportError,
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<Record<string, number>>({})
  const [showDropdown, setShowDropdown] = useState(false)

  // Handle export
  const handleExport = async (format: 'markdown' | 'html' | 'json' | 'pdf') => {
    if (!jobId) return

    onExportStart?.()
    setIsExporting(true)
    setExportProgress(prev => ({ ...prev, [format]: 0 }))

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => ({
          ...prev,
          [format]: Math.min((prev[format] || 0) + 20, 90),
        }))
      }, 200)

      if (format === 'pdf') {
        // For PDF, export as HTML and trigger print
        const blob = await downloadArchitectureReport(jobId, 'html')
        const url = URL.createObjectURL(blob)
        
        // Open in new window for printing
        const printWindow = window.open(url, '_blank')
        if (printWindow) {
          printWindow.onload = () => {
            clearInterval(progressInterval)
            setExportProgress(prev => ({ ...prev, [format]: 100 }))
            setTimeout(() => {
              printWindow.print()
              setIsExporting(false)
              setShowDropdown(false)
              onExportComplete?.()
            }, 500)
          }
        }
        return
      }

      // For other formats, download directly
      const blob = await downloadArchitectureReport(jobId, format)
      
      clearInterval(progressInterval)
      setExportProgress(prev => ({ ...prev, [format]: 100 }))

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const option = EXPORT_OPTIONS.find(o => o.format === format)
      a.download = `architecture-report-${jobId}.${option?.extension || format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setTimeout(() => {
        setIsExporting(false)
        setShowDropdown(false)
        setExportProgress(prev => ({ ...prev, [format]: 0 }))
        onExportComplete?.()
      }, 500)
    } catch (error) {
      console.error('Export failed:', error)
      setIsExporting(false)
      setExportProgress(prev => ({ ...prev, [format]: 0 }))
      setShowDropdown(false)
      onExportError?.(error instanceof Error ? error.message : 'Export failed')
    }
  }

  // Export all formats
  const handleExportAll = async () => {
    for (const option of EXPORT_OPTIONS) {
      if (option.format !== 'pdf') {
        await handleExport(option.format)
      }
    }
  }

  return (
    <div className="relative">
      {/* Export Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting || !jobId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Export Report"
        >
          <span>📥</span>
          <span className="hidden sm:inline">Export</span>
        </button>

        {isExporting && Object.values(exportProgress).some(p => p > 0) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Exporting...</span>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Export Report
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Choose your preferred format
              </p>
            </div>

            {/* Export Options */}
            <div className="py-2">
              {EXPORT_OPTIONS.map((option) => {
                const progress = exportProgress[option.format] || 0
                const isCurrentFormat = isExporting && progress > 0

                return (
                  <button
                    key={option.format}
                    onClick={() => handleExport(option.format)}
                    disabled={isExporting}
                    className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{option.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                          {isCurrentFormat && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {progress}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {option.description}
                        </p>
                        {isCurrentFormat && progress > 0 && progress < 100 && (
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Export All */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={handleExportAll}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                📦 Export All Formats
              </button>
            </div>

            {/* Info */}
            {result && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Report Info:</strong>{' '}
                  {result.analysis.modules.length} modules •{' '}
                  {result.analysis.technicalDebt.debtItems.length} debt items •{' '}
                  {result.optimization.roadmap.phases.length} roadmap phases
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * ReportPreview Component
 * Shows a preview of the report content before export
 */
export interface ReportPreviewProps {
  result?: ArchitectureAnalysisResult | null
  onClose?: () => void
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ result, onClose }) => {
  const [previewFormat, setPreviewFormat] = useState<'summary' | 'debt' | 'roadmap'>('summary')

  if (!result) return null

  const { analysis, optimization } = result

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            📋 Report Preview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-4">
          <button
            onClick={() => setPreviewFormat('summary')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              previewFormat === 'summary'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            📊 Summary
          </button>
          <button
            onClick={() => setPreviewFormat('debt')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              previewFormat === 'debt'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            💰 Technical Debt
          </button>
          <button
            onClick={() => setPreviewFormat('roadmap')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              previewFormat === 'roadmap'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            🗺️ Roadmap
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {previewFormat === 'summary' && (
            <div className="space-y-6">
              {/* Health Status */}
              <div className={`p-4 rounded-lg ${
                optimization.executiveSummary.overallHealth === 'excellent' ||
                optimization.executiveSummary.overallHealth === 'good'
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : optimization.executiveSummary.overallHealth === 'fair'
                    ? 'bg-yellow-100 dark:bg-yellow-900/20'
                    : 'bg-red-100 dark:bg-red-900/20'
              }`}>
                <h3 className="font-semibold text-lg mb-2">
                  Overall Health: {optimization.executiveSummary.overallHealth.toUpperCase()}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm opacity-80">Critical Issues</p>
                    <p className="text-2xl font-bold">{optimization.executiveSummary.criticalIssues}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">High Priority</p>
                    <p className="text-2xl font-bold">{optimization.executiveSummary.highPriorityIssues}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Debt Ratio</p>
                    <p className="text-2xl font-bold">{(optimization.executiveSummary.totalDebt * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Fix Time</p>
                    <p className="text-2xl font-bold">~{analysis.technicalDebt.estimatedFixTime}h</p>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h4 className="font-semibold mb-3">Architecture Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Files</p>
                    <p className="text-xl font-bold">{analysis.complexityMetrics.totalFiles}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Lines</p>
                    <p className="text-xl font-bold">{analysis.complexityMetrics.totalLines.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Complexity</p>
                    <p className="text-xl font-bold">{analysis.complexityMetrics.averageComplexity.toFixed(1)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Maintainability</p>
                    <p className="text-xl font-bold">{analysis.complexityMetrics.maintainabilityIndex}/100</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Dependencies</p>
                    <p className="text-xl font-bold">{analysis.dependencyGraph.edges.length}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cycles</p>
                    <p className="text-xl font-bold">{analysis.dependencyGraph.cycles.length}</p>
                  </div>
                </div>
              </div>

              {/* Quick Wins */}
              {optimization.executiveSummary.quickWins.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">🎯 Quick Wins</h4>
                  <div className="space-y-2">
                    {optimization.executiveSummary.quickWins.slice(0, 5).map((win, index) => (
                      <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="font-medium text-green-900 dark:text-green-100">{win.title}</p>
                        <p className="text-sm text-green-800 dark:text-green-200">{win.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {previewFormat === 'debt' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Technical Debt Breakdown</h4>
              
              {/* Debt by Category */}
              <div>
                <h5 className="font-medium mb-2">Debt by Category</h5>
                <div className="space-y-2">
                  {analysis.technicalDebt.debtByCategory.map((category, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-gray-600 dark:text-gray-400 truncate">
                        {category.category}
                      </span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-orange-500 h-full"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        {category.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Debt Items */}
              <div>
                <h5 className="font-medium mb-2">Top Debt Items</h5>
                <div className="space-y-2">
                  {analysis.technicalDebt.debtItems
                    .sort((a, b) => b.priority - a.priority)
                    .slice(0, 10)
                    .map((item, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-l-4 ${
                          item.severity === 'critical'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                            : item.severity === 'high'
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.location.split('/').pop()}
                            </p>
                          </div>
                          <span className="text-sm font-medium">
                            ~{item.estimatedFixTime}h
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {previewFormat === 'roadmap' && (
            <div className="space-y-6">
              <h4 className="font-semibold text-lg">Optimization Roadmap</h4>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>⏱️ {optimization.roadmap.totalDuration} weeks total</span>
                <span>💼 {optimization.roadmap.totalEffort} hours effort</span>
              </div>

              {/* Phases Timeline */}
              <div className="space-y-4">
                {optimization.roadmap.phases.map((phase, index) => (
                  <div key={phase.id} className="relative">
                    {/* Phase connector */}
                    {index < optimization.roadmap.phases.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200 dark:bg-gray-700" />
                    )}
                    
                    <div className="flex items-start gap-4">
                      {/* Phase number */}
                      <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {index + 1}
                      </div>
                      
                      {/* Phase content */}
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h5 className="font-semibold text-lg mb-1">{phase.name}</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {phase.duration} weeks • {phase.tasks.length} tasks
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
                        <div className="text-sm">
                          <p className="font-medium mb-1">Key Tasks:</p>
                          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                            {phase.tasks.slice(0, 3).map((task, i) => (
                              <li key={i}>{task.title}</li>
                            ))}
                            {phase.tasks.length > 3 && (
                              <li className="text-gray-500">+{phase.tasks.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Milestones */}
              <div>
                <h5 className="font-semibold mb-3">🎯 Milestones</h5>
                <div className="space-y-2">
                  {optimization.roadmap.milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                    >
                      <p className="font-medium text-green-900 dark:text-green-100">
                        {milestone.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportExport
