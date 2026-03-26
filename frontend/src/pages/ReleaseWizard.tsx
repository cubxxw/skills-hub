/**
 * Release Wizard Page
 * Multi-step wizard for publishing skills to ClawHub
 * Steps:
 * 1. Select skill
 * 2. Version information
 * 3. Changelog editing
 * 4. Preview and confirmation
 * 5. Release progress
 */

import { useState, useEffect, useCallback } from 'react'

const API_BASE_URL = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:4000'

export interface SkillInfo {
  id: string
  name: string
  description: string
  version: string
  author?: string
  path?: string
}

export interface ReleaseMetadata {
  name: string
  version: string
  description: string
  author: string
  license: string
  keywords?: string[]
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  field?: string
}

export interface ReleasePackage {
  package: ReleaseMetadata
  size: number
  hash: string
  files: string[]
}

export interface ReleaseJob {
  id: string
  status: 'pending' | 'packaging' | 'validating' | 'publishing' | 'published' | 'failed' | 'cancelled'
  progress: number
  response?: {
    skillName: string
    version: string
    url?: string
    message?: string
  }
  error?: string
}

type WizardStep = 1 | 2 | 3 | 4 | 5

interface ReleaseWizardState {
  selectedSkill: SkillInfo | null
  skillPath: string
  version: string
  versionType: 'major' | 'minor' | 'patch' | 'prerelease'
  prereleaseTag?: string
  changelog: string
  changes: Array<{ type: string; description: string }>
  isPrerelease: boolean
  releaseJob: ReleaseJob | null
  validationIssues: ValidationIssue[]
  packagePreview: ReleasePackage | null
}

const CHANGE_TYPES = [
  { value: 'feat', label: '✨ Feature', color: 'text-green-400' },
  { value: 'fix', label: '🐛 Bug Fix', color: 'text-red-400' },
  { value: 'docs', label: '📚 Documentation', color: 'text-blue-400' },
  { value: 'style', label: '💅 Style', color: 'text-purple-400' },
  { value: 'refactor', label: '♻️ Refactor', color: 'text-yellow-400' },
  { value: 'test', label: '🧪 Test', color: 'text-pink-400' },
  { value: 'chore', label: '🔧 Chore', color: 'text-gray-400' },
  { value: 'break', label: '⚠️ Breaking', color: 'text-orange-600' },
]

export function ReleaseWizard(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [state, setState] = useState<ReleaseWizardState>({
    selectedSkill: null,
    skillPath: '',
    version: '',
    versionType: 'patch',
    changelog: '',
    changes: [],
    isPrerelease: false,
    releaseJob: null,
    validationIssues: [],
    packagePreview: null,
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [newChange, setNewChange] = useState({ type: 'feat', description: '' })

  // Load available skills on mount
  useEffect(() => {
    loadSkills()
  }, [])

  // Poll release job status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    if (state.releaseJob && state.releaseJob.status === 'publishing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/release/job/${state.releaseJob!.id}`)
          const job: ReleaseJob = await res.json()

          setState(prev => ({ ...prev, releaseJob: job }))

          if (job.status === 'published' || job.status === 'failed' || job.status === 'cancelled') {
            clearInterval(interval!)
          }
        } catch (error) {
          console.error('Failed to poll job status:', error)
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state.releaseJob?.id, state.releaseJob?.status])

  const loadSkills = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/skills`)
      // Skills loaded successfully
    } catch (error) {
      console.error('Failed to load skills:', error)
    }
  }

  const handleSkillSelect = async (skillPath: string) => {
    setState(prev => ({ ...prev, skillPath, selectedSkill: null }))

    // Extract metadata from SKILL.md
    try {
      const res = await fetch(`${API_BASE_URL}/api/release/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillPath }),
      })

      if (res.ok) {
        const { metadata } = await res.json()
        setState(prev => ({
          ...prev,
          version: metadata.version,
          selectedSkill: {
            id: metadata.name,
            name: metadata.name,
            description: metadata.description,
            version: metadata.version,
            author: metadata.author,
            path: skillPath,
          },
        }))
      }
    } catch (error) {
      console.error('Failed to load metadata:', error)
    }
  }

  const handleVersionTypeChange = async (type: 'major' | 'minor' | 'patch' | 'prerelease') => {
    if (type === 'prerelease') {
      setState(prev => ({ ...prev, versionType: 'prerelease', isPrerelease: true }))
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/version/bump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentVersion: state.version,
          type,
        }),
      })

      if (res.ok) {
        const { newVersion } = await res.json()
        setState(prev => ({ ...prev, version: newVersion, versionType: type, isPrerelease: false }))
      }
    } catch (error) {
      console.error('Failed to bump version:', error)
    }
  }

  const handleAddChange = () => {
    if (!newChange.description.trim()) return

    setState(prev => ({
      ...prev,
      changes: [...prev.changes, { type: newChange.type, description: newChange.description }],
    }))
    setNewChange({ type: 'feat', description: '' })
  }

  const handleRemoveChange = (index: number) => {
    setState(prev => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== index),
    }))
  }

  const generateChangelogFromChanges = useCallback(() => {
    const changelog = state.changes
      .map(change => {
        const typeInfo = CHANGE_TYPES.find(t => t.value === change.type)
        const label = typeInfo?.label || change.type
        return `- ${label}: ${change.description}`
      })
      .join('\n')

    setState(prev => ({ ...prev, changelog }))
  }, [state.changes])

  const handlePreview = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/release/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillPath: state.skillPath }),
      })

      if (res.ok) {
        const preview = await res.json()
        setState(prev => ({ ...prev, packagePreview: preview }))
      }
    } catch (error) {
      console.error('Failed to preview release:', error)
    }
  }

  const handleValidate = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/release/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillPath: state.skillPath }),
      })

      if (res.ok) {
        const { valid, issues } = await res.json()
        setState(prev => ({ ...prev, validationIssues: issues }))
        return valid
      }
    } catch (error) {
      console.error('Failed to validate:', error)
    }
    return false
  }

  const handlePublish = async () => {
    setIsPublishing(true)

    try {
      // Validate first
      const isValid = await handleValidate()
      if (!isValid) {
        setIsPublishing(false)
        return
      }

      // Queue the release
      const res = await fetch(`${API_BASE_URL}/api/release/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillPath: state.skillPath,
          version: state.version,
          changelog: state.changelog,
          isPrerelease: state.isPrerelease,
        }),
      })

      if (res.ok) {
        const { jobId } = await res.json()
        setState(prev => ({
          ...prev,
          releaseJob: {
            id: jobId,
            status: 'pending',
            progress: 0,
          },
        }))
        setCurrentStep(5)
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      setIsPublishing(false)
    }
  }

  const handleCancel = () => {
    if (state.releaseJob?.id) {
      fetch(`${API_BASE_URL}/api/release/job/${state.releaseJob.id}/cancel`, {
        method: 'POST',
      })
    }
    setState({
      selectedSkill: null,
      skillPath: '',
      version: '',
      versionType: 'patch',
      changelog: '',
      changes: [],
      isPrerelease: false,
      releaseJob: null,
      validationIssues: [],
      packagePreview: null,
    })
    setCurrentStep(1)
    setIsPublishing(false)
  }

  const canProceedToStep2 = state.skillPath.trim().length > 0
  const canProceedToStep3 = state.version.length > 0
  const canPublish = state.validationIssues.filter(i => i.severity === 'error').length === 0

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: 'Select Skill', icon: '📦' },
      { num: 2, label: 'Version', icon: '🔢' },
      { num: 3, label: 'Changelog', icon: '📝' },
      { num: 4, label: 'Preview', icon: '👁️' },
      { num: 5, label: 'Publish', icon: '🚀' },
    ]

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                currentStep >= step.num
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400'
              }`}
            >
              <span className="text-xl">{step.icon}</span>
            </div>
            <div className="ml-2">
              <div className={`text-sm font-medium ${currentStep >= step.num ? 'text-white' : 'text-gray-500'}`}>
                Step {step.num}
              </div>
              <div className={`text-xs ${currentStep >= step.num ? 'text-gray-300' : 'text-gray-600'}`}>
                {step.label}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-4 ${
                  currentStep > step.num ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Select Skill to Release</h2>
        <p className="text-gray-400">Choose the skill directory you want to publish to ClawHub</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Skill Path
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={state.skillPath}
              onChange={(e) => handleSkillSelect(e.target.value)}
              placeholder="/path/to/your/skill"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                // In a real app, this would open a file picker
                alert('File picker would open here')
              }}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              📁 Browse
            </button>
          </div>
        </div>

        {state.selectedSkill && (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Selected Skill</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 text-white">{state.selectedSkill.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Version:</span>
                <span className="ml-2 text-white">{state.selectedSkill.version}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Description:</span>
                <p className="mt-1 text-white">{state.selectedSkill.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Version Information</h2>
        <p className="text-gray-400">Specify the version number for this release</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Current Version
          </label>
          <input
            type="text"
            value={state.version}
            onChange={(e) => setState(prev => ({ ...prev, version: e.target.value }))}
            placeholder="1.0.0"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bump Type
          </label>
          <div className="grid grid-cols-4 gap-3">
            {(['major', 'minor', 'patch', 'prerelease'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleVersionTypeChange(type)}
                className={`px-4 py-3 rounded-lg border transition-all ${
                  state.versionType === type
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="text-sm font-medium capitalize">{type}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {type === 'major' && 'Breaking changes'}
                  {type === 'minor' && 'New features'}
                  {type === 'patch' && 'Bug fixes'}
                  {type === 'prerelease' && 'Alpha/beta'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {state.isPrerelease && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Prerelease Tag
            </label>
            <input
              type="text"
              value={state.prereleaseTag || ''}
              onChange={(e) => setState(prev => ({ ...prev, prereleaseTag: e.target.value }))}
              placeholder="alpha.1, beta.2, rc.1"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Changelog</h2>
        <p className="text-gray-400">Document what's new in this release</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Add Changes</h3>
          <div className="flex gap-2 mb-3">
            <select
              value={newChange.type}
              onChange={(e) => setNewChange(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CHANGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newChange.description}
              onChange={(e) => setNewChange(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the change..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddChange()}
            />
            <button
              onClick={handleAddChange}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          {state.changes.length > 0 && (
            <div className="space-y-2">
              {state.changes.map((change, index) => {
                const typeInfo = CHANGE_TYPES.find(t => t.value === change.type)
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-700 rounded"
                  >
                    <span className={`text-sm ${typeInfo?.color || 'text-gray-400'}`}>
                      {typeInfo?.label}: {change.description}
                    </span>
                    <button
                      onClick={() => handleRemoveChange(index)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={generateChangelogFromChanges}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            📝 Generate changelog from changes above
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Changelog (Markdown)
          </label>
          <textarea
            value={state.changelog}
            onChange={(e) => setState(prev => ({ ...prev, changelog: e.target.value }))}
            placeholder="- feat: Added new feature&#10;- fix: Fixed bug in..."
            rows={8}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Preview & Confirm</h2>
        <p className="text-gray-400">Review your release before publishing</p>
      </div>

      {state.packagePreview && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">📦 Package Info</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 text-white">{state.packagePreview.package.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Version:</span>
                <span className="ml-2 text-white">{state.packagePreview.package.version}</span>
              </div>
              <div>
                <span className="text-gray-500">Author:</span>
                <span className="ml-2 text-white">{state.packagePreview.package.author}</span>
              </div>
              <div>
                <span className="text-gray-500">License:</span>
                <span className="ml-2 text-white">{state.packagePreview.package.license}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Description:</span>
                <p className="mt-1 text-white">{state.packagePreview.package.description}</p>
              </div>
              <div>
                <span className="text-gray-500">Size:</span>
                <span className="ml-2 text-white">{(state.packagePreview.size / 1024).toFixed(2)} KB</span>
              </div>
              <div>
                <span className="text-gray-500">Files:</span>
                <span className="ml-2 text-white">{state.packagePreview.files.length} files</span>
              </div>
            </div>
          </div>

          {state.validationIssues.length > 0 && (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">⚠️ Validation Issues</h3>
              <div className="space-y-2">
                {state.validationIssues.map((issue, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      issue.severity === 'error'
                        ? 'bg-red-900/30 border border-red-700'
                        : 'bg-yellow-900/30 border border-yellow-700'
                    }`}
                  >
                    <span className={`text-sm ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {issue.severity === 'error' ? '🔴' : '🟡'} {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">📝 Changelog Preview</h3>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-gray-900 p-4 rounded">
                {state.changelog || 'No changelog provided'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Publishing</h2>
        <p className="text-gray-400">Your release is being processed</p>
      </div>

      {state.releaseJob && (
        <div className="space-y-4">
          <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium text-white">
                {state.releaseJob.status === 'published' && '✅ Published!'}
                {state.releaseJob.status === 'failed' && '❌ Failed'}
                {state.releaseJob.status === 'cancelled' && '⏸️ Cancelled'}
                {state.releaseJob.status === 'publishing' && '🚀 Publishing...'}
                {state.releaseJob.status === 'validating' && '🔍 Validating...'}
                {state.releaseJob.status === 'packaging' && '📦 Packaging...'}
                {state.releaseJob.status === 'pending' && '⏳ Queued...'}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                state.releaseJob.status === 'published'
                  ? 'bg-green-900/50 text-green-400'
                  : state.releaseJob.status === 'failed'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-blue-900/50 text-blue-400'
              }`}>
                {state.releaseJob.status.toUpperCase()}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  state.releaseJob.status === 'failed'
                    ? 'bg-red-600'
                    : state.releaseJob.status === 'published'
                    ? 'bg-green-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${state.releaseJob.progress}%` }}
              />
            </div>

            <div className="text-sm text-gray-400 mb-4">
              Progress: {state.releaseJob.progress}%
            </div>

            {state.releaseJob.response && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-400">Release Details</div>
                <div className="mt-2 text-white">
                  <div><strong>Skill:</strong> {state.releaseJob.response.skillName}</div>
                  <div><strong>Version:</strong> {state.releaseJob.response.version}</div>
                  {state.releaseJob.response.url && (
                    <div>
                      <strong>URL:</strong>{' '}
                      <a
                        href={state.releaseJob.response.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {state.releaseJob.response.url}
                      </a>
                    </div>
                  )}
                  {state.releaseJob.response.message && (
                    <div className="mt-2 text-green-400">{state.releaseJob.response.message}</div>
                  )}
                </div>
              </div>
            )}

            {state.releaseJob.error && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <div className="text-red-400">
                  <strong>Error:</strong> {state.releaseJob.error}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🚀 Release Wizard</h1>
          <p className="text-gray-400">Publish your skill to ClawHub with version management</p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-8 mb-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 5 && (
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(prev => (prev > 1 ? (prev - 1) as WizardStep : prev))}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 1
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              ← Previous
            </button>

            <div className="flex gap-3">
              {currentStep === 1 && (
                <button
                  onClick={handleCancel}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              )}

              {currentStep === 4 && (
                <button
                  onClick={handlePreview}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  🔄 Refresh Preview
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  onClick={() => {
                    if (currentStep === 1 && canProceedToStep2) setCurrentStep(2)
                    if (currentStep === 2 && canProceedToStep3) setCurrentStep(3)
                    if (currentStep === 3) {
                      handlePreview()
                      setCurrentStep(4)
                    }
                  }}
                  disabled={
                    (currentStep === 1 && !canProceedToStep2) ||
                    (currentStep === 2 && !canProceedToStep3)
                  }
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    (currentStep === 1 && !canProceedToStep2) ||
                    (currentStep === 2 && !canProceedToStep3)
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={!canPublish || isPublishing}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                    !canPublish || isPublishing
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isPublishing ? '🚀 Publishing...' : '🚀 Publish to ClawHub'}
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="flex justify-center">
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              ✨ New Release
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReleaseWizard
