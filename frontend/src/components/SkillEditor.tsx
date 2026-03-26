/**
 * SkillEditor Component
 * Online editor for creating and editing skill packages
 */

import { useState, useCallback } from 'react'
import { uploadSkill, type UploadSkillResponse, type ValidationResult } from '../lib/api-client'

interface SkillEditorProps {
  onSkillCreated?: (response: UploadSkillResponse) => void
}

interface SkillFile {
  name: string
  content: string
  language: 'markdown' | 'javascript' | 'typescript' | 'json' | 'text'
}

const DEFAULT_SKILL_MD = `---
name: my-new-skill
version: 1.0.0
description: A new skill for AG-UI
author: Your Name
license: MIT
keywords: skill, ag-ui, automation
---

# My New Skill

This is a new skill created with the AG-UI Skill Editor.

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

\`\`\`javascript
// Example usage
const skill = require('./index.js')
skill.execute()
\`\`\`

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`
`

const DEFAULT_INDEX_TS = `/**
 * Skill Entry Point
 */

interface SkillContext {
  // Context properties
}

interface SkillResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Execute the skill
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  try {
    console.log('Executing skill...')
    
    // Your skill logic here
    
    return {
      success: true,
      data: { message: 'Skill executed successfully' }
    }
  } catch (error) {
    console.error('Skill execution failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get skill metadata
 */
export function getMetadata() {
  return {
    name: 'my-new-skill',
    version: '1.0.0',
    description: 'A new skill for AG-UI'
  }
}
`

const DEFAULT_PACKAGE_JSON = `{
  "name": "my-new-skill",
  "version": "1.0.0",
  "description": "A new skill for AG-UI",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "keywords": ["skill", "ag-ui", "automation"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
`

export function SkillEditor({ onSkillCreated }: SkillEditorProps) {
  const [files, setFiles] = useState<SkillFile[]>([
    { name: 'SKILL.md', content: DEFAULT_SKILL_MD, language: 'markdown' },
    { name: 'index.ts', content: DEFAULT_INDEX_TS, language: 'typescript' },
    { name: 'package.json', content: DEFAULT_PACKAGE_JSON, language: 'json' },
  ])
  const [activeFileIndex, setActiveFileIndex] = useState(0)
  const [skillName, setSkillName] = useState('my-new-skill')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  const activeFile = files[activeFileIndex]

  const handleFileChange = useCallback((content: string) => {
    setFiles((prev) =>
      prev.map((file, index) =>
        index === activeFileIndex ? { ...file, content } : file
      )
    )
  }, [activeFileIndex])

  const handleAddFile = useCallback(() => {
    const name = prompt('Enter file name (e.g., utils.ts, config.json):')
    if (!name) return

    const extension = name.split('.').pop()?.toLowerCase()
    let language: SkillFile['language'] = 'text'

    switch (extension) {
      case 'md':
        language = 'markdown'
        break
      case 'js':
        language = 'javascript'
        break
      case 'ts':
        language = 'typescript'
        break
      case 'json':
        language = 'json'
        break
    }

    setFiles((prev) => [
      ...prev,
      { name, content: '', language },
    ])
    setActiveFileIndex(files.length)
  }, [files.length])

  const handleDeleteFile = useCallback((index: number) => {
    if (index === 0) {
      alert('Cannot delete SKILL.md - it\'s required!')
      return
    }
    const fileToDelete = files[index]
    if (fileToDelete && confirm(`Delete ${fileToDelete.name}?`)) {
      setFiles((prev) => prev.filter((_, i) => i !== index))
      if (activeFileIndex >= index && activeFileIndex > 0) {
        setActiveFileIndex(activeFileIndex - 1)
      }
    }
  }, [files, activeFileIndex])

  const handleCreateSkill = async () => {
    setIsCreating(true)
    setError(null)

    try {
      // Create a ZIP file from the files
      const zipBuffer = await createZipFromFiles(files)
      // Convert to regular ArrayBuffer for Blob compatibility
      const arrayBuffer = zipBuffer.buffer.slice(
        zipBuffer.byteOffset,
        zipBuffer.byteOffset + zipBuffer.byteLength
      ) as ArrayBuffer
      const blob = new Blob([arrayBuffer], { type: 'application/zip' })
      const file = new File([blob], `${skillName}.zip`, { type: 'application/zip' })

      const response = await uploadSkill(file)
      setValidationResult(response.validation || null)
      setIsCreating(false)

      if (response.success && onSkillCreated) {
        onSkillCreated(response)
      }
    } catch (err) {
      setIsCreating(false)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create skill'
      setError(errorMessage)
    }
  }

  // Simple ZIP creation (minimal implementation for demo)
  const createZipFromFiles = async (files: SkillFile[]): Promise<Uint8Array> => {
    // This is a simplified implementation
    // In production, use a proper ZIP library like jszip
    const encoder = new TextEncoder()

    // Local file header signature
    const localHeaderSig = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    // Central directory header signature
    const centralHeaderSig = new Uint8Array([0x50, 0x4b, 0x01, 0x02])
    // End of central directory signature
    const endSig = new Uint8Array([0x50, 0x4b, 0x05, 0x06])

    const localHeaders: Uint8Array[] = []
    const fileData: Uint8Array[] = []
    const centralHeaders: Uint8Array[] = []

    let offset = 0

    for (const file of files) {
      const nameBytes = encoder.encode(file.name)
      const contentBytes = encoder.encode(file.content)

      // Create local file header
      const localHeader = new Uint8Array(30 + nameBytes.length)
      localHeader.set(localHeaderSig)
      localHeader.set([0x14, 0x00], 4) // version needed
      localHeader.set([0x00, 0x00], 6) // flags
      localHeader.set([0x00, 0x00], 8) // compression (none)
      localHeader.set([0x00, 0x00, 0x00, 0x00], 10) // mod time/date
      // CRC-32 (simplified, should be calculated properly)
      localHeader.set([0x00, 0x00, 0x00, 0x00], 14)
      localHeader.set([contentBytes.length & 0xff, (contentBytes.length >> 8) & 0xff, (contentBytes.length >> 16) & 0xff, (contentBytes.length >> 24) & 0xff], 18) // compressed size
      localHeader.set([contentBytes.length & 0xff, (contentBytes.length >> 8) & 0xff, (contentBytes.length >> 16) & 0xff, (contentBytes.length >> 24) & 0xff], 22) // uncompressed size
      localHeader.set([nameBytes.length & 0xff, nameBytes.length >> 8], 26) // file name length
      localHeader.set([0x00, 0x00], 28) // extra field length
      localHeader.set(nameBytes, 30)

      localHeaders.push(localHeader)
      fileData.push(contentBytes)

      // Create central directory header
      const centralHeader = new Uint8Array(46 + nameBytes.length)
      centralHeader.set(centralHeaderSig)
      centralHeader.set([0x14, 0x00], 4) // version made by
      centralHeader.set([0x14, 0x00], 6) // version needed
      centralHeader.set([0x00, 0x00], 8) // flags
      centralHeader.set([0x00, 0x00], 10) // compression
      centralHeader.set([0x00, 0x00, 0x00, 0x00], 12) // mod time/date
      centralHeader.set([0x00, 0x00, 0x00, 0x00], 16) // CRC-32
      centralHeader.set([contentBytes.length & 0xff, (contentBytes.length >> 8) & 0xff, (contentBytes.length >> 16) & 0xff, (contentBytes.length >> 24) & 0xff], 20) // compressed size
      centralHeader.set([contentBytes.length & 0xff, (contentBytes.length >> 8) & 0xff, (contentBytes.length >> 16) & 0xff, (contentBytes.length >> 24) & 0xff], 24) // uncompressed size
      centralHeader.set([nameBytes.length & 0xff, nameBytes.length >> 8], 28) // file name length
      centralHeader.set([0x00, 0x00], 30) // extra field length
      centralHeader.set([0x00, 0x00], 32) // comment length
      centralHeader.set([0x00, 0x00], 34) // disk number start
      centralHeader.set([0x00, 0x00], 36) // internal attributes
      centralHeader.set([0x00, 0x00, 0x00, 0x00], 38) // external attributes
      centralHeader.set([offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff], 42) // local header offset
      centralHeader.set(nameBytes, 46)

      centralHeaders.push(centralHeader)
      offset += localHeader.length + contentBytes.length
    }

    const centralDirOffset = offset
    for (const header of centralHeaders) {
      offset += header.length
    }

    // End of central directory
    const endRecord = new Uint8Array(22)
    endRecord.set(endSig)
    endRecord.set([0x00, 0x00], 4) // disk number
    endRecord.set([0x00, 0x00], 6) // disk with central dir
    endRecord.set([centralHeaders.length & 0xff, centralHeaders.length >> 8], 8) // entries on this disk
    endRecord.set([centralHeaders.length & 0xff, centralHeaders.length >> 8], 10) // total entries
    const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0)
    endRecord.set([centralDirSize & 0xff, (centralDirSize >> 8) & 0xff, (centralDirSize >> 16) & 0xff, (centralDirSize >> 24) & 0xff], 12) // central dir size
    endRecord.set([centralDirOffset & 0xff, (centralDirOffset >> 8) & 0xff, (centralDirOffset >> 16) & 0xff, (centralDirOffset >> 24) & 0xff], 16) // central dir offset
    endRecord.set([0x00, 0x00], 20) // comment length

    // Combine all parts
    const totalSize = localHeaders.reduce((s, h) => s + h.length, 0) +
      fileData.reduce((s, d) => s + d.length, 0) +
      centralHeaders.reduce((s, h) => s + h.length, 0) +
      endRecord.length

    const zip = new Uint8Array(totalSize)
    let pos = 0

    for (let i = 0; i < localHeaders.length; i++) {
      const header = localHeaders[i]
      const data = fileData[i]
      if (header && data) {
        zip.set(header, pos)
        pos += header.length
        zip.set(data, pos)
        pos += data.length
      }
    }

    for (const header of centralHeaders) {
      zip.set(header, pos)
      pos += header.length
    }

    zip.set(endRecord, pos)

    return zip
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Skill Editor</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create and edit your skill package</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="Skill name"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
          <button
            onClick={handleAddFile}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            + Add File
          </button>
          <button
            onClick={handleCreateSkill}
            disabled={isCreating}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isCreating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
          >
            {isCreating ? 'Creating...' : 'Create Skill'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Editor Layout */}
      <div className="flex gap-4 h-[600px]">
        {/* File List */}
        <div className="w-48 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Files</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={file.name}
                className={`
                  flex items-center justify-between px-3 py-2 cursor-pointer text-sm
                  ${index === activeFileIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }
                `}
                onClick={() => setActiveFileIndex(index)}
              >
                <span className="truncate">{file.name}</span>
                {index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFile(index)
                    }}
                    className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col">
          {/* File Tab */}
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeFile?.name || 'No file selected'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{activeFile?.language.toUpperCase() || ''}</span>
          </div>

          {/* Text Area */}
          <textarea
            value={activeFile?.content || ''}
            onChange={(e) => handleFileChange(e.target.value)}
            className="flex-1 w-full p-4 font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
            spellCheck={false}
            disabled={!activeFile}
          />
        </div>
      </div>

      {/* Validation Preview */}
      {validationResult && (
        <ValidationPreview result={validationResult} />
      )}

      {/* Help Text */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Tips:</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• <strong>SKILL.md</strong> is required and contains your skill metadata</li>
          <li>• Add TypeScript/JavaScript files for your skill logic</li>
          <li>• Include a <strong>package.json</strong> for dependencies</li>
          <li>• Click "Create Skill" to package and upload your skill</li>
        </ul>
      </div>
    </div>
  )
}

// Validation Preview (same as in SkillUploader)
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
