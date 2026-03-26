/**
 * Version History Component
 * Displays version history for a skill with rollback capability
 */

import { useState, useEffect } from 'react'

const API_BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:4000'

export interface VersionInfo {
  version: string
  semver: {
    major: number
    minor: number
    patch: number
    prerelease?: string
    build?: string
  }
  publishedAt: string
  changelog?: string
  size: number
  hash: string
  status: 'published' | 'deprecated' | 'rolledback'
  rollbackTarget?: string
}

export interface VersionHistoryData {
  skillName: string
  versions: VersionInfo[]
  currentVersion: string
  latestVersion: string
}

export interface RollbackRequest {
  skillName: string
  targetVersion?: string
}

export interface RollbackResult {
  success: boolean
  previousVersion: string
  rolledbackVersion: string
  timestamp: string
  error?: string
}

interface VersionHistoryProps {
  skillName: string
  onRollback?: (result: RollbackResult) => void
  compact?: boolean
}

export function VersionHistory({ skillName, onRollback, compact = false }: VersionHistoryProps): JSX.Element {
  const [history, setHistory] = useState<VersionHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRollbackDialog, setShowRollbackDialog] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null)
  const [rollbackInProgress, setRollbackInProgress] = useState(false)

  useEffect(() => {
    loadVersionHistory()
  }, [skillName])

  const loadVersionHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/version/${skillName}`)

      if (!res.ok) {
        if (res.status === 404) {
          setHistory(null)
          return
        }
        throw new Error('Failed to load version history')
      }

      const data = await res.json()
      setHistory(data.history)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRollbackClick = (version: string) => {
    setSelectedVersion(version)
    setShowRollbackDialog(true)
  }

  const handleConfirmRollback = async () => {
    if (!selectedVersion) return

    try {
      setRollbackInProgress(true)

      const res = await fetch(`${API_BASE_URL}/api/version/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName,
          targetVersion: selectedVersion,
        }),
      })

      const result: RollbackResult = await res.json()

      if (res.ok && result.success) {
        onRollback?.(result)
        await loadVersionHistory()
        setShowRollbackDialog(false)
        setSelectedVersion(null)
      } else {
        setError(result.error || 'Rollback failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setRollbackInProgress(false)
    }
  }

  const handleViewChangelog = async (version: string) => {
    if (expandedVersion === version) {
      setExpandedVersion(null)
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/changelog/${skillName}?format=markdown`)
      if (res.ok) {
        await res.text()
        setExpandedVersion(version)
      }
    } catch (err) {
      console.error('Failed to load changelog:', err)
    }
  }

  const getStatusBadge = (status: VersionInfo['status']) => {
    const badges = {
      published: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Published' },
      deprecated: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Deprecated' },
      rolledback: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Rolled Back' },
    }

    const badge = badges[status]

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
        <div className="text-red-400">⚠️ {error}</div>
        <button
          onClick={loadVersionHistory}
          className="mt-2 text-sm text-red-300 hover:text-red-200"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!history || history.versions.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        <span className="text-4xl mb-2 block">📭</span>
        No version history found
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Version History</h3>
          <span className="text-sm text-gray-400">{history.versions.length} versions</span>
        </div>

        <div className="space-y-2">
          {history.versions.slice(0, 5).map((versionInfo) => (
            <div
              key={versionInfo.version}
              className={`p-3 rounded-lg border ${
                versionInfo.version === history.currentVersion
                  ? 'bg-blue-900/20 border-blue-700'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-white font-mono">{versionInfo.version}</span>
                  {getStatusBadge(versionInfo.status)}
                  {versionInfo.version === history.currentVersion && (
                    <span className="text-xs text-blue-400">(Current)</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(versionInfo.publishedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">📦 Version History</h3>
          <p className="text-sm text-gray-400 mt-1">
            {history.versions.length} versions • Current: {history.currentVersion}
          </p>
        </div>
        <button
          onClick={loadVersionHistory}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Version List */}
      <div className="space-y-3">
        {history.versions.map((versionInfo, index) => (
          <div
            key={versionInfo.version}
            className={`p-4 rounded-lg border transition-all ${
              versionInfo.version === history.currentVersion
                ? 'bg-blue-900/20 border-blue-700'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-mono font-bold text-white">
                    v{versionInfo.version}
                  </span>
                  {getStatusBadge(versionInfo.status)}
                  {versionInfo.version === history.currentVersion && (
                    <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                      Current
                    </span>
                  )}
                  {versionInfo.rollbackTarget && (
                    <span className="text-xs text-red-400">
                      → {versionInfo.rollbackTarget}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm text-gray-400 mb-3">
                  <div>
                    <span className="text-gray-500">Published:</span>
                    <span className="ml-2 text-white">
                      {formatDate(versionInfo.publishedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-2 text-white">{formatSize(versionInfo.size)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Hash:</span>
                    <span className="ml-2 text-white font-mono text-xs">
                      {versionInfo.hash.substring(0, 8)}...
                    </span>
                  </div>
                </div>

                {versionInfo.changelog && (
                  <div className="mb-3">
                    <button
                      onClick={() => handleViewChangelog(versionInfo.version)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {expandedVersion === versionInfo.version ? '📄 Hide changelog' : '📄 View changelog'}
                    </button>

                    {expandedVersion === versionInfo.version && (
                      <div className="mt-2 p-3 bg-gray-900 rounded-lg">
                        <pre className="whitespace-pre-wrap text-sm text-gray-300">
                          {versionInfo.changelog}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 ml-4">
                {versionInfo.status === 'published' && versionInfo.version !== history.currentVersion && (
                  <button
                    onClick={() => handleRollbackClick(versionInfo.version)}
                    className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    ↩️ Rollback
                  </button>
                )}

                {index === 0 && versionInfo.version === history.latestVersion && (
                  <span className="text-xs text-green-400 text-center">Latest</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rollback Dialog */}
      {showRollbackDialog && (
        <RollbackDialog
          skillName={skillName}
          targetVersion={selectedVersion!}
          currentVersion={history.currentVersion}
          onConfirm={handleConfirmRollback}
          onCancel={() => {
            setShowRollbackDialog(false)
            setSelectedVersion(null)
          }}
          isRollingBack={rollbackInProgress}
        />
      )}
    </div>
  )
}

interface RollbackDialogProps {
  skillName: string
  targetVersion: string
  currentVersion: string
  onConfirm: () => void
  onCancel: () => void
  isRollingBack: boolean
}

function RollbackDialog({
  skillName,
  targetVersion,
  currentVersion,
  onConfirm,
  onCancel,
  isRollingBack,
}: RollbackDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white">↩️ Rollback Version</h3>
          <p className="text-sm text-gray-400 mt-1">
            Are you sure you want to rollback?
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Skill:</span>
              <span className="text-white">{skillName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current Version:</span>
              <span className="text-red-400">{currentVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rollback To:</span>
              <span className="text-green-400">{targetVersion}</span>
            </div>
          </div>
        </div>

        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-6">
          <div className="text-yellow-400 text-sm">
            ⚠️ This will mark the current version as rolled back and restore the selected version as active.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isRollingBack}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isRollingBack}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isRollingBack ? '⏳ Rolling back...' : '↩️ Confirm Rollback'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VersionHistory
