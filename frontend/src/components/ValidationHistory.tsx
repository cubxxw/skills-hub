/**
 * ValidationHistory Component
 * Displays history of validation jobs
 */

import React, { useState, useEffect, useCallback } from 'react'
import { getValidationHistory, type ValidationJobStatus, type ValidationScore } from '../lib/api-client'

export interface ValidationHistoryProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  onJobSelect?: (job: ValidationJobStatus) => void
}

export const ValidationHistory: React.FC<ValidationHistoryProps> = ({
  limit = 20,
  autoRefresh = true,
  refreshInterval = 30000,
  onJobSelect,
}) => {
  const [jobs, setJobs] = useState<ValidationJobStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<ValidationJobStatus | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getValidationHistory(limit)
      setJobs(data.jobs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch validation history')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchHistory()

    if (autoRefresh) {
      const interval = setInterval(fetchHistory, refreshInterval)
      return () => clearInterval(interval)
    }
    
    return () => {}
  }, [fetchHistory, autoRefresh, refreshInterval])

  const handleJobClick = (job: ValidationJobStatus) => {
    setSelectedJob(job)
    onJobSelect?.(job)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20'
      case 'failed':
      case 'timeout':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20'
      case 'cancelled':
        return 'text-gray-500 bg-gray-50 dark:bg-gray-800'
      case 'queued':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case 'validating':
      case 'static-analysis':
      case 'ai-review':
      case 'scoring':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-800'
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-500'
      case 'high':
        return 'text-orange-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleTimeString()
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error && jobs.length === 0) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
        <button
          onClick={fetchHistory}
          className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Validation History ({jobs.length})
        </h3>
        <button
          onClick={fetchHistory}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Jobs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Skill
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.map((job) => (
              <tr
                key={job.jobId}
                onClick={() => handleJobClick(job)}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedJob?.jobId === job.jobId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(job.status)}`}>
                    {job.status === 'validating' || job.status === 'static-analysis' || job.status === 'ai-review' || job.status === 'scoring' ? (
                      <span className="w-2 h-2 mr-1.5 rounded-full bg-current animate-pulse"></span>
                    ) : null}
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-gray-900 dark:text-gray-100 font-medium">
                    {job.skillName}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    v{job.skillVersion}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {job.result ? (
                    <div className="text-gray-900 dark:text-gray-100 font-medium">
                      {(job.result.overallScore * 100).toFixed(0)}%
                    </div>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {job.result ? (
                    <div className={`text-xs font-medium capitalize ${getRiskColor(job.result.riskLevel)}`}>
                      {job.result.riskLevel}
                    </div>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {formatDuration(job.result?.duration)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {formatTime(job.completedAt || job.startedAt || job.addedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No validation history found
        </div>
      )}

      {/* Selected Job Details */}
      {selectedJob && selectedJob.result && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100">
              {selectedJob.skillName} v{selectedJob.skillVersion}
            </h4>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2">
            <ScoreDisplay score={selectedJob.result.score} />
          </div>
        </div>
      )}
    </div>
  )
}

const ScoreDisplay: React.FC<{ score: ValidationScore }> = ({ score }) => {
  const scoreColor = score.overall >= 0.8 ? 'text-green-500' : score.overall >= 0.6 ? 'text-yellow-500' : 'text-red-500'
  
  return (
    <div className="flex items-center gap-4">
      <div className={`text-2xl font-bold ${scoreColor}`}>
        {(score.overall * 100).toFixed(0)}%
      </div>
      <div className="text-sm text-gray-400">
        Risk: <span className="capitalize">{score.riskLevel}</span>
      </div>
      <div className="text-sm text-gray-400">
        {score.passed ? '✅ Passed' : '❌ Failed'}
      </div>
    </div>
  )
}

export default ValidationHistory
