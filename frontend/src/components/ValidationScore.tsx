/**
 * ValidationScore Component
 * Displays validation score breakdown with visual indicators
 */

import React, { useMemo } from 'react'
import type { ValidationScore as ValidationScoreType, ValidationScoreBreakdown } from '../lib/api-client'

export interface ValidationScoreProps {
  score: ValidationScoreType
  showBreakdown?: boolean
  compact?: boolean
}

export const ValidationScore: React.FC<ValidationScoreProps> = ({
  score: scoreData,
  showBreakdown = true,
  compact = false,
}) => {
  const riskColor = useMemo(() => {
    switch (scoreData.riskLevel) {
      case 'critical':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'high':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'medium':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'low':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
  }, [scoreData.riskLevel])

  const scoreColor = useMemo(() => {
    if (scoreData.overall >= 0.8) return 'text-green-500'
    if (scoreData.overall >= 0.6) return 'text-yellow-500'
    if (scoreData.overall >= 0.4) return 'text-orange-500'
    return 'text-red-500'
  }, [scoreData.overall])

  const passed = scoreData.passed

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${riskColor}`}>
        <span className="text-sm font-medium">{(scoreData.overall * 100).toFixed(0)}%</span>
        <span className="text-xs uppercase">{scoreData.riskLevel}</span>
        {passed ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className={`p-4 rounded-lg border mb-4 ${riskColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Validation Score</h3>
            <p className="text-sm opacity-80 mt-1">
              {scoreData.skillName} v{scoreData.skillVersion}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${scoreColor}`}>
              {(scoreData.overall * 100).toFixed(1)}%
            </div>
            <div className="text-sm opacity-80 mt-1">
              {passed ? '✅ Passed' : '❌ Failed'}
            </div>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <CategoryScoreCard
          title="Security"
          icon="🔒"
          score={scoreData.security.score}
          breakdown={scoreData.security}
          showBreakdown={showBreakdown}
        />
        <CategoryScoreCard
          title="Quality"
          icon="✨"
          score={scoreData.quality.score}
          breakdown={scoreData.quality}
          showBreakdown={showBreakdown}
        />
        <CategoryScoreCard
          title="Performance"
          icon="⚡"
          score={scoreData.performance.score}
          breakdown={scoreData.performance}
          showBreakdown={showBreakdown}
        />
        <CategoryScoreCard
          title="Documentation"
          icon="📚"
          score={scoreData.documentation.score}
          breakdown={scoreData.documentation}
          showBreakdown={showBreakdown}
        />
      </div>

      {/* Risk Level Indicator */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Risk Level</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className={`w-3 h-3 rounded-full ${scoreData.riskLevel === 'low' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`w-3 h-3 rounded-full ${scoreData.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`w-3 h-3 rounded-full ${scoreData.riskLevel === 'high' ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`w-3 h-3 rounded-full ${scoreData.riskLevel === 'critical' ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </div>
            <span className={`text-sm font-medium capitalize ${riskColor.split(' ')[0]}`}>
              {scoreData.riskLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Deductions and Bonuses */}
      {showBreakdown && (
        <div className="mt-4 space-y-4">
          <DeductionsBonuses score={scoreData} />
        </div>
      )}
    </div>
  )
}

interface CategoryScoreCardProps {
  title: string
  icon: string
  score: number
  breakdown: ValidationScoreBreakdown
  showBreakdown: boolean
}

const CategoryScoreCard: React.FC<CategoryScoreCardProps> = ({
  title,
  icon,
  score,
  breakdown,
  showBreakdown,
}) => {
  const scoreColor = useMemo(() => {
    if (score >= 0.8) return 'text-green-500'
    if (score >= 0.6) return 'text-yellow-500'
    if (score >= 0.4) return 'text-orange-500'
    return 'text-red-500'
  }, [score])

  const barColor = useMemo(() => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.6) return 'bg-yellow-500'
    if (score >= 0.4) return 'bg-orange-500'
    return 'bg-red-500'
  }, [score])

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</span>
      </div>
      <div className={`text-2xl font-bold ${scoreColor}`}>
        {(score * 100).toFixed(0)}%
      </div>
      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
      {showBreakdown && breakdown.deductions.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          -{breakdown.deductions.length} deductions
          {breakdown.bonuses.length > 0 && ` / +${breakdown.bonuses.length} bonuses`}
        </div>
      )}
    </div>
  )
}

const DeductionsBonuses: React.FC<{ score: any }> = ({ score: scoreData }) => {
  const allDeductions = [
    ...scoreData.security.deductions,
    ...scoreData.quality.deductions,
    ...scoreData.performance.deductions,
    ...scoreData.documentation.deductions,
  ]

  const allBonuses = [
    ...scoreData.security.bonuses,
    ...scoreData.quality.bonuses,
    ...scoreData.performance.bonuses,
    ...scoreData.documentation.bonuses,
  ]

  if (allDeductions.length === 0 && allBonuses.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Deductions */}
      {allDeductions.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Deductions ({allDeductions.length})
          </h4>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {allDeductions.slice(0, 5).map((deduction, idx) => (
              <li key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
                <span className="truncate">{deduction.reason}</span>
                <span className="ml-2 font-medium">-{(deduction.amount * 100).toFixed(0)}%</span>
              </li>
            ))}
            {allDeductions.length > 5 && (
              <li className="text-xs text-red-500 dark:text-red-400 text-center">
                +{allDeductions.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Bonuses */}
      {allBonuses.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Bonuses ({allBonuses.length})
          </h4>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {allBonuses.slice(0, 5).map((bonus, idx) => (
              <li key={idx} className="text-xs text-green-600 dark:text-green-400 flex items-center justify-between">
                <span className="truncate">{bonus.reason}</span>
                <span className="ml-2 font-medium">+{(bonus.amount * 100).toFixed(0)}%</span>
              </li>
            ))}
            {allBonuses.length > 5 && (
              <li className="text-xs text-green-500 dark:text-green-400 text-center">
                +{allBonuses.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ValidationScore
