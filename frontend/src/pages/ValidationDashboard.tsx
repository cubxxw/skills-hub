/**
 * Validation Dashboard Page
 * Main interface for skill validation with AI review
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  uploadForValidation,
  getValidationJob,
  getValidationStats,
  type ValidationJobStatus,
  type ValidationStats as ValidationStatsType,
} from '../lib/api-client'
import AISuggestions from '../components/AISuggestions'
import ValidationHistory from '../components/ValidationHistory'

export const ValidationDashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentJob, setCurrentJob] = useState<ValidationJobStatus | null>(null)
  const [stats, setStats] = useState<ValidationStatsType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'result' | 'history'>('upload')

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [])

  // Poll for job status if job is in progress
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'cancelled') {
      return
    }

    const interval = setInterval(async () => {
      try {
        const job = await getValidationJob(currentJob.jobId)
        setCurrentJob(job)

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          setActiveTab('result')
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentJob?.jobId, currentJob?.status])

  const fetchStats = async () => {
    try {
      const data = await getValidationStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleFileSelect = useCallback((file: File) => {
    setError(null)

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please select a ZIP file')
      return
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size exceeds 10MB limit')
      return
    }

    setSelectedFile(file)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const response = await uploadForValidation(selectedFile, (progress) => {
        setUploadProgress(progress)
      })

      setCurrentJob({
        jobId: response.jobId,
        status: 'queued' as const,
        skillName: 'Uploading...',
        skillVersion: '',
        progress: 0,
        addedAt: new Date().toISOString(),
      })

      setActiveTab('result')
      fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setError(null)
    setUploadProgress(0)
  }

  const handleJobSelect = useCallback((job: ValidationJobStatus) => {
    setCurrentJob(job)
    setActiveTab('result')
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🔍 AI Validation Dashboard
          </h1>
          <p className="text-gray-400">
            Upload skill packages for comprehensive AI-powered validation and review
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Validations" value={stats.total} />
            <StatCard label="In Queue" value={stats.queued} />
            <StatCard label="Running" value={stats.running} />
            <StatCard
              label="Avg Duration"
              value={formatDuration(stats.avgDuration)}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <TabButton
            active={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
            label="Upload"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
          />
          <TabButton
            active={activeTab === 'result'}
            onClick={() => setActiveTab('result')}
            label="Result"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            badge={currentJob && currentJob.status !== 'completed' ? undefined : undefined}
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Skill Package</h2>

              {/* Drop Zone */}
              <div
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center
                  transition-all duration-200
                  ${selectedFile
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                  }
                  ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files && files.length > 0 && files[0]) {
                      handleFileSelect(files[0])
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />

                <div className="space-y-4">
                  <div className="flex justify-center">
                    <svg
                      className={`w-12 h-12 ${selectedFile ? 'text-blue-500' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-lg font-medium">
                      {selectedFile ? selectedFile.name : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      ZIP file, max 10MB
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="text-sm text-gray-400">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedFile && !isUploading && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleUpload}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Start Validation
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard
                icon="🔒"
                title="Security Analysis"
                description="Detects vulnerabilities, sensitive data exposure, and dependency issues"
              />
              <InfoCard
                icon="✨"
                title="Code Quality"
                description="Reviews code structure, best practices, and maintainability"
              />
              <InfoCard
                icon="⚡"
                title="Performance Check"
                description="Identifies bottlenecks and optimization opportunities"
              />
            </div>
          </div>
        )}

        {activeTab === 'result' && (
          <div className="space-y-6">
            {!currentJob ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>No validation job selected</p>
                <p className="text-sm mt-2">Upload a skill package to see results</p>
              </div>
            ) : currentJob.status === 'queued' || currentJob.status === 'validating' || currentJob.status === 'static-analysis' || currentJob.status === 'ai-review' || currentJob.status === 'scoring' ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold mb-2">
                  Validation in Progress
                </h3>
                <p className="text-gray-400 mb-4">
                  {currentJob.status === 'queued' && 'Waiting in queue...'}
                  {currentJob.status === 'validating' && 'Starting validation...'}
                  {currentJob.status === 'static-analysis' && 'Running static analysis...'}
                  {currentJob.status === 'ai-review' && 'Performing AI review...'}
                  {currentJob.status === 'scoring' && 'Calculating scores...'}
                </p>
                <div className="w-full max-w-md mx-auto bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${currentJob.progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {currentJob.progress}% complete
                </p>
                {currentJob.queuePosition && (
                  <p className="text-sm text-gray-400 mt-2">
                    Queue position: {currentJob.queuePosition}
                  </p>
                )}
              </div>
            ) : currentJob.status === 'failed' || currentJob.status === 'timeout' || currentJob.status === 'cancelled' ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
                <div className="flex items-center gap-3 text-red-400 mb-4">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-semibold">Validation Failed</h3>
                </div>
                <p className="text-red-300">{currentJob.error || 'Unknown error'}</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : currentJob.result ? (
              <>
                {/* Score */}
                <div className="mb-6">
                  <ScoreDisplay score={currentJob.result.score} />
                </div>

                {/* Summary */}
                {currentJob.result.summary && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Summary</h3>
                    <p className="text-gray-300">{currentJob.result.summary}</p>
                  </div>
                )}

                {/* Issues and Suggestions */}
                <AISuggestions
                  suggestions={currentJob.result.suggestions}
                  issues={currentJob.result.issues}
                />

                {/* Metadata */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Validation Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Duration</div>
                      <div className="text-gray-100 font-medium">
                        {formatDuration(currentJob.result.duration)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Issues Found</div>
                      <div className="text-gray-100 font-medium">
                        {currentJob.result.issues.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Suggestions</div>
                      <div className="text-gray-100 font-medium">
                        {currentJob.result.suggestions.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Completed</div>
                      <div className="text-gray-100 font-medium">
                        {new Date(currentJob.completedAt!).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'history' && (
          <ValidationHistory onJobSelect={handleJobSelect} />
        )}
      </div>
    </div>
  )
}

// Helper Components

const StatCard: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <div className="text-gray-400 text-sm mb-1">{label}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
)

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
  badge?: number
}> = ({ active, onClick, label, icon, badge }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 font-medium transition-colors relative
      ${active
        ? 'text-blue-400 border-b-2 border-blue-400'
        : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
      }
    `}
  >
    {icon}
    {label}
    {badge !== undefined && (
      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
)

const InfoCard: React.FC<{ icon: string; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <div className="text-3xl mb-2">{icon}</div>
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-gray-400">{description}</p>
  </div>
)

// Score Display Component
const ScoreDisplay: React.FC<{ score: any }> = ({ score }) => {
  const scoreColor = score.overall >= 0.8 ? 'text-green-500' : score.overall >= 0.6 ? 'text-yellow-500' : 'text-red-500'
  const riskColor = score.riskLevel === 'critical' ? 'text-red-500' : score.riskLevel === 'high' ? 'text-orange-500' : score.riskLevel === 'medium' ? 'text-yellow-500' : 'text-green-500'
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Validation Score</h3>
          <p className="text-sm text-gray-400 mt-1">
            {score.skillName} v{score.skillVersion}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {(score.overall * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {score.passed ? '✅ Passed' : '❌ Failed'}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <CategoryScore title="Security" icon="🔒" score={score.security.score} />
        <CategoryScore title="Quality" icon="✨" score={score.quality.score} />
        <CategoryScore title="Performance" icon="⚡" score={score.performance.score} />
        <CategoryScore title="Documentation" icon="📚" score={score.documentation.score} />
      </div>
      
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-gray-400">Risk Level:</span>
        <span className={`text-sm font-medium capitalize ${riskColor}`}>{score.riskLevel}</span>
      </div>
    </div>
  )
}

const CategoryScore: React.FC<{ title: string; icon: string; score: number }> = ({ title, icon, score }) => {
  const scoreColor = score >= 0.8 ? 'text-green-500' : score >= 0.6 ? 'text-yellow-500' : 'text-red-500'
  const barColor = score >= 0.8 ? 'bg-green-500' : score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
  
  return (
    <div className="p-3 bg-gray-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </div>
      <div className={`text-xl font-bold ${scoreColor}`}>
        {(score * 100).toFixed(0)}%
      </div>
      <div className="mt-2 w-full bg-gray-600 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${score * 100}%` }} />
      </div>
    </div>
  )
}

// Helper Functions

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export default ValidationDashboard
