/**
 * Skills Management Page
 * Combines upload, GitHub import, and editor functionality
 */

import React, { useState } from 'react'
import { SkillUploader } from '../components/SkillUploader'
import { GitHubImport } from '../components/GitHubImport'
import { SkillEditor } from '../components/SkillEditor'
import type { UploadSkillResponse, GitHubImportResponse } from '../lib/api-client'

type TabType = 'upload' | 'github' | 'editor'

export function SkillsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const handleUploadSuccess = (response: UploadSkillResponse) => {
    const skillName = response.skill?.name || 'Unknown'
    setNotification({
      type: 'success',
      message: `Skill "${skillName}" uploaded successfully!`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleUploadError = (error: Error) => {
    setNotification({
      type: 'error',
      message: `Upload failed: ${error.message}`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleImportSuccess = (response: GitHubImportResponse) => {
    const skillName = response.skill?.name || 'Unknown'
    setNotification({
      type: 'success',
      message: `Skill "${skillName}" imported from GitHub!`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleImportError = (error: Error) => {
    setNotification({
      type: 'error',
      message: `GitHub import failed: ${error.message}`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleSkillCreated = (response: UploadSkillResponse) => {
    const skillName = response.skill?.name || 'Unknown'
    setNotification({
      type: 'success',
      message: `Skill "${skillName}" created successfully!`,
    })
    setTimeout(() => setNotification(null), 5000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Skills Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload, import, or create new skills for the AG-UI platform
          </p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : notification.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}>
            {notification.type === 'success' && (
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'info' && (
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className={`font-medium ${
              notification.type === 'success'
                ? 'text-green-800 dark:text-green-200'
                : notification.type === 'error'
                ? 'text-red-800 dark:text-red-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {notification.message}
            </span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-4">
            <TabButton
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              }
              label="Upload ZIP"
            />
            <TabButton
              active={activeTab === 'github'}
              onClick={() => setActiveTab('github')}
              icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              }
              label="Import from GitHub"
            />
            <TabButton
              active={activeTab === 'editor'}
              onClick={() => setActiveTab('editor')}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
              label="Create with Editor"
            />
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {activeTab === 'upload' && (
            <SkillUploader
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          )}
          {activeTab === 'github' && (
            <GitHubImport
              onImportSuccess={handleImportSuccess}
              onImportError={handleImportError}
            />
          )}
          {activeTab === 'editor' && (
            <SkillEditor onSkillCreated={handleSkillCreated} />
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard
            icon={
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="ZIP Upload"
            description="Upload your skill as a ZIP file containing SKILL.md and your code. Max size: 50MB."
          />
          <InfoCard
            icon={
              <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            }
            title="GitHub Import"
            description="Import skills directly from GitHub repositories. Just paste the repository URL."
          />
          <InfoCard
            icon={
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            title="Online Editor"
            description="Create skills from scratch with our built-in editor. No local setup required."
          />
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
        ${active
          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
    >
      {icon}
      {label}
    </button>
  )
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}
