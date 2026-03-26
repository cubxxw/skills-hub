/**
 * SkillUploader Component
 * Handles ZIP file upload with drag-and-drop support
 */

import React, { useState, useCallback, useRef } from 'react'
import { uploadSkill, type UploadSkillResponse, type ValidationResult } from '../lib/api-client'

interface SkillUploaderProps {
  onUploadSuccess?: (response: UploadSkillResponse) => void
  onUploadError?: (error: Error) => void
}

export function SkillUploader({ onUploadSuccess, onUploadError }: SkillUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    setValidationResult(null)
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please select a ZIP file')
      return
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size exceeds 50MB limit')
      return
    }

    setSelectedFile(file)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) handleFile(file)
    }
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) handleFile(file)
    }
  }, [handleFile])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const response = await uploadSkill(selectedFile, (progress) => {
        setUploadProgress(progress)
      })

      setValidationResult(response.validation || null)
      setIsUploading(false)

      if (response.success && onUploadSuccess) {
        onUploadSuccess(response)
      } else if (response.error && onUploadError) {
        onUploadError(new Error(response.error))
      }
    } catch (err) {
      setIsUploading(false)
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      if (onUploadError) {
        onUploadError(err instanceof Error ? err : new Error('Upload failed'))
      }
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setValidationResult(null)
    setError(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-all duration-200 ease-in-out
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <svg
              className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
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

          {/* Text */}
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              {isDragging ? 'Drop your skill ZIP here' : 'Drag & drop your skill ZIP'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse (max 50MB)
            </p>
          </div>

          {/* Selected File */}
          {selectedFile && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-gray-600 dark:text-gray-300">{selectedFile.name}</span>
              <span className="text-gray-400">({formatFileSize(selectedFile.size)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-300">Uploading...</span>
            <span className="text-gray-600 dark:text-gray-300">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
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
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Upload Skill
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Validation Preview */}
      {validationResult && (
        <ValidationPreview result={validationResult} />
      )}
    </div>
  )
}

/**
 * Validation Preview Component
 */
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

      {/* Metadata Preview */}
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

      {/* Errors */}
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

      {/* Warnings */}
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

      {/* Success Message */}
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

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
