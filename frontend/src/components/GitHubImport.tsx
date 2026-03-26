/**
 * GitHubImport Component
 * Allows importing skills from GitHub repositories
 */

import { useState, useCallback } from 'react'
import { importFromGitHub, type GitHubImportResponse, type ValidationResult } from '../lib/api-client'

interface GitHubImportProps {
  onImportSuccess?: (response: GitHubImportResponse) => void
  onImportError?: (error: Error) => void
}

export function GitHubImport({ onImportSuccess, onImportError }: GitHubImportProps) {
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [isImporting, setIsImporting] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importedSkill, setImportedSkill] = useState<GitHubImportResponse['skill'] | null>(null)

  const validateUrl = (inputUrl: string): boolean => {
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+(\/tree\/[\w-]+)?$/
    return githubUrlPattern.test(inputUrl)
  }

  const handleImport = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid GitHub URL (e.g., https://github.com/owner/repo)')
      return
    }

    setIsImporting(true)
    setError(null)
    setValidationResult(null)
    setImportedSkill(null)

    try {
      const response = await importFromGitHub(url, branch || 'main')
      
      setValidationResult(response.validation || null)
      setImportedSkill(response.skill || null)
      setIsImporting(false)

      if (response.success && onImportSuccess) {
        onImportSuccess(response)
      } else if (response.error && onImportError) {
        onImportError(new Error(response.error))
      }
    } catch (err) {
      setIsImporting(false)
      const errorMessage = err instanceof Error ? err.message : 'Import failed'
      setError(errorMessage)
      if (onImportError) {
        onImportError(err instanceof Error ? err : new Error('Import failed'))
      }
    }
  }, [url, branch, onImportSuccess, onImportError])

  const handleClear = () => {
    setUrl('')
    setBranch('main')
    setValidationResult(null)
    setImportedSkill(null)
    setError(null)
  }

  const handleQuickFill = (owner: string, repo: string) => {
    setUrl(`https://github.com/${owner}/${repo}`)
    setError(null)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input Section */}
      <div className="space-y-4">
        {/* URL Input */}
        <div>
          <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            GitHub Repository URL
          </label>
          <div className="flex gap-2">
            <input
              id="github-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className={`
                flex-1 px-4 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100
                ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              `}
              disabled={isImporting}
            />
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              disabled={isImporting || !url}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Branch Input */}
        <div>
          <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Branch (optional)
          </label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={isImporting}
          />
        </div>

        {/* Quick Examples */}
        <div className="pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Quick examples:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickFill('openclaw', 'skill-example')}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
              disabled={isImporting}
            >
              openclaw/skill-example
            </button>
            <button
              onClick={() => handleQuickFill('openclaw', 'web-search-skill')}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
              disabled={isImporting}
            >
              openclaw/web-search-skill
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={isImporting || !url.trim()}
          className={`
            w-full px-4 py-3 rounded-lg font-medium transition-all
            ${isImporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]'
            }
            text-white
          `}
        >
          {isImporting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Importing from GitHub...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Import from GitHub
            </span>
          )}
        </button>
      </div>

      {/* Imported Skill Info */}
      {importedSkill && (
        <div className="mt-6 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Successfully Imported!</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-green-600 dark:text-green-400">Name:</span>
              <span className="text-green-800 dark:text-green-100 font-medium">{importedSkill.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600 dark:text-green-400">Version:</span>
              <span className="text-green-800 dark:text-green-100 font-medium">{importedSkill.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600 dark:text-green-400">Status:</span>
              <span className={`font-medium ${importedSkill.status === 'active' ? 'text-green-600 dark:text-green-300' : 'text-yellow-600 dark:text-yellow-300'}`}>
                {importedSkill.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600 dark:text-green-400">Validation Score:</span>
              <span className="text-green-800 dark:text-green-100 font-medium">{(importedSkill.validationScore * 100).toFixed(0)}%</span>
            </div>
            {importedSkill.githubUrl && (
              <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-700">
                <a
                  href={importedSkill.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Preview */}
      {validationResult && (
        <ValidationPreview result={validationResult} />
      )}
    </div>
  )
}

// Reuse the ValidationPreview from SkillUploader
function ValidationPreview({ result }: { result: ValidationResult }) {
  const scoreColor = result.score >= 0.8 ? 'text-green-500' : result.score >= 0.6 ? 'text-yellow-500' : 'text-red-500'
  const bgColor = result.score >= 0.8 ? 'bg-green-50 dark:bg-green-900/20' : result.score >= 0.6 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-red-50 dark:bg-red-900/20'

  return (
    <div className={`mt-6 p-6 rounded-lg border ${bgColor} ${result.valid ? 'border-green-200 dark:border-green-800' : 'border-yellow-200 dark:border-yellow-800'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Validation Results</h3>
        <div className={`text-2xl font-bold ${scoreColor}`}>
          {(result.score * 100).toFixed(0)}%
        </div>
      </div>

      {result.metadata && (
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Name:</span>
              <span className="ml-2 text-gray-700 dark:text-gray-200 font-medium">{result.metadata.name}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Version:</span>
              <span className="ml-2 text-gray-700 dark:text-gray-200 font-medium">{result.metadata.version}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Description:</span>
              <p className="mt-1 text-gray-700 dark:text-gray-200">{result.metadata.description}</p>
            </div>
            {result.metadata.author && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Author:</span>
                <span className="ml-2 text-gray-700 dark:text-gray-200">{result.metadata.author}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Errors ({result.errors.length})
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400">
            {result.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Warnings ({result.warnings.length})
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-400">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {result.valid && result.errors.length === 0 && (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Skill package is valid and ready to use!</span>
        </div>
      )}
    </div>
  )
}
