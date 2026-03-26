/**
 * AISuggestions Component
 * Displays AI-generated suggestions for code improvement
 */

import React, { useState, useMemo } from 'react'
import type { ValidationSuggestion, ValidationIssue } from '../lib/api-client'

export interface AISuggestionsProps {
  suggestions: ValidationSuggestion[]
  issues?: ValidationIssue[]
  collapsible?: boolean
}

export const AISuggestions: React.FC<AISuggestionsProps> = ({
  suggestions,
  issues,
  collapsible = true,
}) => {
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())

  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }, [suggestions])

  const sortedIssues = useMemo(() => {
    if (!issues) return []
    return [...issues].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }, [issues])

  const toggleSuggestion = (id: string) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleIssue = (id: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20'
      case 'medium':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-800'
    }
  }

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'high':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'medium':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'low':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'info':
        return 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return '🔒'
      case 'quality':
        return '✨'
      case 'performance':
        return '⚡'
      case 'documentation':
        return '📚'
      default:
        return '📋'
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Issues Section */}
      {sortedIssues && sortedIssues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Issues ({sortedIssues.length})
          </h3>
          <div className="space-y-2">
            {sortedIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isExpanded={expandedIssues.has(issue.id)}
                onToggle={() => toggleIssue(issue.id)}
                collapsible={collapsible}
                getSeverityColor={getSeverityColor}
                getCategoryIcon={getCategoryIcon}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Section */}
      {sortedSuggestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            AI Suggestions ({sortedSuggestions.length})
          </h3>
          <div className="space-y-2">
            {sortedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isExpanded={expandedSuggestions.has(suggestion.id)}
                onToggle={() => toggleSuggestion(suggestion.id)}
                collapsible={collapsible}
                getPriorityColor={getPriorityColor}
                getCategoryIcon={getCategoryIcon}
              />
            ))}
          </div>
        </div>
      )}

      {sortedSuggestions.length === 0 && (!issues || issues.length === 0) && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No issues or suggestions found. Great job!</p>
        </div>
      )}
    </div>
  )
}

interface IssueCardProps {
  issue: ValidationIssue
  isExpanded: boolean
  onToggle: () => void
  collapsible: boolean
  getSeverityColor: (severity: string) => string
  getCategoryIcon: (category: string) => string
}

const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  isExpanded,
  onToggle,
  collapsible,
  getSeverityColor,
  getCategoryIcon,
}) => {
  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${getSeverityColor(issue.severity)}`}
    >
      <div
        className={`p-3 flex items-start gap-3 ${collapsible ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <span className="text-xl">{getCategoryIcon(issue.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{issue.message}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 capitalize">
              {issue.severity}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 capitalize flex items-center gap-1">
              {getCategoryIcon(issue.category)} {issue.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 capitalize">
              {issue.source}
            </span>
          </div>
          {issue.file && (
            <div className="text-xs mt-1 opacity-70">
              {issue.file}{issue.line ? `:${issue.line}` : ''}
            </div>
          )}
        </div>
        {collapsible && (
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {(!collapsible || isExpanded) && (
        <div className="px-3 pb-3 space-y-2">
          {issue.codeSnippet && (
            <div className="mt-2 p-2 bg-black/10 dark:bg-white/10 rounded text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap">{issue.codeSnippet}</pre>
            </div>
          )}
          {issue.suggestion && (
            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-sm">
              <strong>Suggestion:</strong> {issue.suggestion}
            </div>
          )}
          {issue.aiExplanation && (
            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-sm">
              <strong>AI Explanation:</strong> {issue.aiExplanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SuggestionCardProps {
  suggestion: ValidationSuggestion
  isExpanded: boolean
  onToggle: () => void
  collapsible: boolean
  getPriorityColor: (priority: string) => string
  getCategoryIcon: (category: string) => string
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isExpanded,
  onToggle,
  collapsible,
  getPriorityColor,
  getCategoryIcon,
}) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className={`p-3 flex items-start gap-3 bg-gray-50 dark:bg-gray-800 ${collapsible ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <span className="text-xl">{getCategoryIcon(suggestion.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-800 dark:text-gray-100">{suggestion.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getPriorityColor(suggestion.priority)}`}>
              {suggestion.priority} priority
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 capitalize flex items-center gap-1">
              {getCategoryIcon(suggestion.category)} {suggestion.category}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
            {suggestion.description}
          </p>
        </div>
        {collapsible && (
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {(!collapsible || isExpanded) && (
        <div className="p-3 space-y-3">
          {/* Before/After Code */}
          {suggestion.before && suggestion.after && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Before:</div>
                <pre className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono overflow-x-auto text-red-700 dark:text-red-300">
                  {suggestion.before}
                </pre>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">After:</div>
                <pre className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs font-mono overflow-x-auto text-green-700 dark:text-green-300">
                  {suggestion.after}
                </pre>
              </div>
            </div>
          )}

          {/* Impact and Effort */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span>Impact:</span>
              <span className={`px-2 py-0.5 rounded capitalize ${
                suggestion.impact === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                suggestion.impact === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}>
                {suggestion.impact}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Effort:</span>
              <span className={`px-2 py-0.5 rounded capitalize ${
                suggestion.effort === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                suggestion.effort === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {suggestion.effort}
              </span>
            </div>
          </div>

          {/* Files */}
          {suggestion.files && suggestion.files.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Affected files:</strong>
              <ul className="list-disc list-inside mt-1">
                {suggestion.files.map((file, idx) => (
                  <li key={idx} className="font-mono">{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AISuggestions
