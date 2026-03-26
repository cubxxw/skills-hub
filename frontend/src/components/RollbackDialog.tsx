/**
 * Rollback Dialog Component
 * Standalone dialog for rolling back to a previous version
 * Features:
 * - Version comparison
 * - Changelog preview
 * - Confirmation with warnings
 * - Rollback progress tracking
 */

import { useState, useEffect } from 'react'

const API_BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:4000'

export interface VersionInfo {
  version: string
  publishedAt: string
  changelog?: string
  size: number
  hash: string
  status: 'published' | 'deprecated' | 'rolledback'
}

export interface RollbackResult {
  success: boolean
  previousVersion: string
  rolledbackVersion: string
  timestamp: string
  error?: string
}

export interface RollbackDialogProps {
  isOpen: boolean
  skillName: string
  currentVersion: string
  targetVersion?: string
  onClose: () => void
  onSuccess?: (result: RollbackResult) => void
}

export function RollbackDialog({
  isOpen,
  skillName,
  currentVersion,
  targetVersion,
  onClose,
  onSuccess,
}: RollbackDialogProps): JSX.Element | null {
  const [selectedVersion, setSelectedVersion] = useState<string>(targetVersion || '')
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChangelog, setShowChangelog] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadVersions()
      if (targetVersion) {
        setSelectedVersion(targetVersion)
      }
    }
  }, [isOpen, targetVersion])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/version/${skillName}`)

      if (res.ok) {
        const { history } = await res.json()
        // Filter out current version and only show published versions
        const availableVersions = history.versions.filter(
          (v: VersionInfo) => v.version !== currentVersion && v.status === 'published'
        )
        setVersions(availableVersions)
      }
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async () => {
    if (!selectedVersion) return

    try {
      setRollingBack(true)
      setError(null)

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
        onSuccess?.(result)
        onClose()
      } else {
        setError(result.error || 'Rollback failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed')
    } finally {
      setRollingBack(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">↩️ Rollback Version</h2>
            <p className="text-sm text-gray-400 mt-1">
              Restore a previous version of <span className="text-blue-400">{skillName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Version Warning */}
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-red-400 font-medium mb-1">Warning: This action will rollback the current version</h3>
                <div className="text-sm text-gray-300">
                  <p>Current version <span className="text-red-400 font-mono">{currentVersion}</span> will be marked as rolled back.</p>
                  <p className="mt-1">All changes in this version will be unavailable until re-published.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Version Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Select Version to Rollback To</h3>

            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center p-8 text-gray-400">
                <span className="text-4xl mb-2 block">📭</span>
                No previous versions available for rollback
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((versionInfo) => (
                  <div
                    key={versionInfo.version}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedVersion === versionInfo.version
                        ? 'bg-blue-900/20 border-blue-600'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedVersion(versionInfo.version)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="version"
                          checked={selectedVersion === versionInfo.version}
                          onChange={() => setSelectedVersion(versionInfo.version)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono font-medium">
                              v{versionInfo.version}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(versionInfo.publishedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Size: {formatSize(versionInfo.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowChangelog(showChangelog === versionInfo.version ? null : versionInfo.version)
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {showChangelog === versionInfo.version ? '📄 Hide' : '📄 Changelog'}
                      </button>
                    </div>

                    {showChangelog === versionInfo.version && versionInfo.changelog && (
                      <div className="mt-3 ml-7 p-3 bg-gray-900 rounded-lg">
                        <pre className="whitespace-pre-wrap text-sm text-gray-300">
                          {versionInfo.changelog}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version Comparison */}
          {selectedVersion && (
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Version Comparison</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">From (Current)</div>
                  <div className="text-red-400 font-mono">{currentVersion}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">To (Target)</div>
                  <div className="text-green-400 font-mono">{selectedVersion}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <div className="text-red-400 text-sm">❌ {error}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={rollingBack}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleRollback}
            disabled={!selectedVersion || rollingBack}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              !selectedVersion || rollingBack
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {rollingBack ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Rolling back...
              </span>
            ) : (
              `↩️ Rollback to v${selectedVersion}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Quick Rollback Button Component
 * A button that opens the rollback dialog
 */
export function QuickRollbackButton({
  skillName,
  currentVersion,
  onRollbackSuccess,
}: {
  skillName: string
  currentVersion: string
  onRollbackSuccess?: (result: RollbackResult) => void
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        <span>↩️</span>
        Rollback
      </button>

      <RollbackDialog
        isOpen={isOpen}
        skillName={skillName}
        currentVersion={currentVersion}
        onClose={() => setIsOpen(false)}
        onSuccess={(result) => {
          onRollbackSuccess?.(result)
          setIsOpen(false)
        }}
      />
    </>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default RollbackDialog
