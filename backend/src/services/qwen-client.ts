/**
 * Qwen Code Client
 * Interfaces with Qwen Code CLI for AI-powered code review and analysis
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

export interface QwenCodeConfig {
  cliPath?: string
  timeout?: number
  maxTokens?: number
  temperature?: number
}

export interface QwenCodeResponse {
  id: string
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  createdAt: Date
}

export interface CodeReviewRequest {
  code: string
  filePath?: string
  language?: string
  reviewType: 'security' | 'quality' | 'performance' | 'documentation' | 'all'
  context?: string
}

export interface CodeReviewResult {
  score: number
  issues: CodeIssue[]
  suggestions: CodeSuggestion[]
  summary: string
  rawResponse: string
}

export interface CodeIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'security' | 'quality' | 'performance' | 'documentation' | 'style'
  message: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  codeSnippet?: string
  suggestion?: string
}

export interface CodeSuggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'security' | 'quality' | 'performance' | 'documentation'
  before?: string
  after?: string
}

export class QwenCodeClient {
  private cliPath: string
  private timeout: number
  private maxTokens: number
  private temperature: number

  constructor(config: QwenCodeConfig = {}) {
    this.cliPath = config.cliPath ?? 'qwen'
    this.timeout = config.timeout ?? 300000 // 5 minutes default
    this.maxTokens = config.maxTokens ?? 4096
    this.temperature = config.temperature ?? 0.3
  }

  /**
   * Check if Qwen Code CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.cliPath} --version`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get Qwen Code version
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync(`${this.cliPath} --version`)
      return stdout.trim()
    } catch (error) {
      throw new Error(`Failed to get Qwen version: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Review code using Qwen Code CLI
   */
  async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResult> {
    const prompt = this.buildReviewPrompt(request)
    
    try {
      const response = await this.sendPrompt(prompt)
      return this.parseReviewResponse(response)
    } catch (error) {
      console.error('Qwen Code review failed:', error)
      throw new Error(`Code review failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze code for security issues
   */
  async analyzeSecurity(code: string, filePath?: string): Promise<CodeReviewResult> {
    return this.reviewCode({
      code,
      filePath,
      reviewType: 'security',
      context: 'Focus on security vulnerabilities, sensitive data exposure, and potential attack vectors',
    })
  }

  /**
   * Analyze code quality
   */
  async analyzeQuality(code: string, filePath?: string): Promise<CodeReviewResult> {
    return this.reviewCode({
      code,
      filePath,
      reviewType: 'quality',
      context: 'Focus on code quality, best practices, maintainability, and readability',
    })
  }

  /**
   * Analyze performance issues
   */
  async analyzePerformance(code: string, filePath?: string): Promise<CodeReviewResult> {
    return this.reviewCode({
      code,
      filePath,
      reviewType: 'performance',
      context: 'Focus on performance bottlenecks, memory leaks, and optimization opportunities',
    })
  }

  /**
   * Check documentation quality
   */
  async checkDocumentation(code: string, filePath?: string): Promise<CodeReviewResult> {
    return this.reviewCode({
      code,
      filePath,
      reviewType: 'documentation',
      context: 'Focus on documentation completeness, comments, JSDoc, and code clarity',
    })
  }

  /**
   * Send prompt to Qwen Code CLI
   */
  private async sendPrompt(prompt: string): Promise<QwenCodeResponse> {
    const tempDir = await mkdtemp(join(tmpdir(), 'qwen-code-'))
    const promptFile = join(tempDir, `prompt-${randomUUID()}.txt`)
    
    try {
      // Write prompt to temp file
      await writeFile(promptFile, prompt, 'utf-8')

      // Execute Qwen Code CLI
      const command = `${this.cliPath} --file "${promptFile}" --max-tokens ${this.maxTokens} --temperature ${this.temperature}`
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })

      if (stderr && !stderr.includes('warning')) {
        console.warn('Qwen Code stderr:', stderr)
      }

      return {
        id: randomUUID(),
        content: stdout,
        model: 'qwen-code',
        createdAt: new Date(),
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`Qwen Code request timed out after ${this.timeout / 1000} seconds`)
      }
      throw error
    }
  }

  /**
   * Build review prompt for Qwen Code
   */
  private buildReviewPrompt(request: CodeReviewRequest): string {
    const reviewTypes = {
      security: '🔒 Security Review',
      quality: '✨ Code Quality Review',
      performance: '⚡ Performance Review',
      documentation: '📚 Documentation Review',
      all: '🔍 Comprehensive Code Review',
    }

    let prompt = `# ${reviewTypes[request.reviewType]}

## Context
${request.context || 'Please review this code thoroughly.'}

## Code to Review
\`\`\`${request.language || 'typescript'}
${request.code}
\`\`\`

## Requirements
Please provide your review in the following JSON format:

\`\`\`json
{
  "score": 0.0-1.0,
  "summary": "Brief summary of findings",
  "issues": [
    {
      "severity": "critical|high|medium|low|info",
      "category": "security|quality|performance|documentation|style",
      "message": "Issue description",
      "line": 0,
      "suggestion": "How to fix"
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion title",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "before": "original code",
      "after": "improved code"
    }
  ]
}
\`\`\`

## Focus Areas
${this.getFocusAreas(request.reviewType)}

Please be thorough but concise. Prioritize critical issues.`

    if (request.filePath) {
      prompt += `\n\n## File Path\n${request.filePath}`
    }

    return prompt
  }

  /**
   * Get focus areas based on review type
   */
  private getFocusAreas(reviewType: CodeReviewRequest['reviewType']): string {
    const focusAreas: Record<typeof reviewType, string> = {
      security: `- Security vulnerabilities (XSS, SQL injection, etc.)
- Sensitive data exposure (API keys, secrets, passwords)
- Authentication and authorization issues
- Input validation and sanitization
- Dependency vulnerabilities`,
      
      quality: `- Code structure and organization
- Naming conventions
- Function complexity
- Error handling
- Test coverage
- Code duplication
- Type safety`,
      
      performance: `- Algorithm efficiency
- Memory usage and leaks
- Unnecessary computations
- Database query optimization
- Caching opportunities
- Async/await usage`,
      
      documentation: `- JSDoc comments
- Function documentation
- Type annotations
- README completeness
- Code clarity
- Example usage`,
      
      all: `- All security concerns
- Code quality and best practices
- Performance optimizations
- Documentation completeness
- Overall maintainability`,
    }

    return focusAreas[reviewType]
  }

  /**
   * Parse Qwen Code response into structured review
   */
  private parseReviewResponse(response: QwenCodeResponse): CodeReviewResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/)
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1])
        
        const issues: CodeIssue[] = (parsed.issues || []).map((issue: Partial<CodeIssue>) => ({
          id: randomUUID(),
          severity: issue.severity || 'info',
          category: issue.category || 'quality',
          message: issue.message || 'Unknown issue',
          line: issue.line,
          endLine: issue.endLine,
          column: issue.column,
          endColumn: issue.endColumn,
          codeSnippet: issue.codeSnippet,
          suggestion: issue.suggestion,
        }))

        const suggestions: CodeSuggestion[] = (parsed.suggestions || []).map((suggestion: Partial<CodeSuggestion>) => ({
          id: randomUUID(),
          title: suggestion.title || 'Suggestion',
          description: suggestion.description || '',
          priority: suggestion.priority || 'medium',
          category: suggestion.category || 'quality',
          before: suggestion.before,
          after: suggestion.after,
        }))

        return {
          score: Math.max(0, Math.min(1, parsed.score || 0.5)),
          issues,
          suggestions,
          summary: parsed.summary || 'Code review completed',
          rawResponse: response.content,
        }
      }

      // Fallback: Parse as plain text
      return this.parsePlainTextResponse(response.content)
    } catch (error) {
      console.error('Failed to parse Qwen response:', error)
      return this.parsePlainTextResponse(response.content)
    }
  }

  /**
   * Parse plain text response as fallback
   */
  private parsePlainTextResponse(content: string): CodeReviewResult {
    const lines = content.split('\n')
    const issues: CodeIssue[] = []
    const suggestions: CodeSuggestion[] = []
    
    let currentSection: 'issues' | 'suggestions' | null = null
    let currentItem: Partial<CodeIssue | CodeSuggestion> | null = null

    for (const line of lines) {
      if (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem')) {
        currentSection = 'issues'
      } else if (line.toLowerCase().includes('suggestion') || line.toLowerCase().includes('recommendation')) {
        currentSection = 'suggestions'
      }

      if (currentSection === 'issues' && line.trim().startsWith('-')) {
        if (currentItem) {
          issues.push(currentItem as CodeIssue)
        }
        currentItem = {
          id: randomUUID(),
          severity: 'medium',
          category: 'quality',
          message: line.replace(/^-/, '').trim(),
        }
      } else if (currentSection === 'suggestions' && line.trim().startsWith('-')) {
        if (currentItem) {
          suggestions.push(currentItem as CodeSuggestion)
        }
        currentItem = {
          id: randomUUID(),
          title: line.replace(/^-/, '').trim(),
          priority: 'medium',
          category: 'quality',
        }
      }
    }

    if (currentItem) {
      if (currentSection === 'issues') {
        issues.push(currentItem as CodeIssue)
      } else if (currentSection === 'suggestions') {
        suggestions.push(currentItem as CodeSuggestion)
      }
    }

    // Estimate score based on issue severity
    let score = 1.0
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 0.3
          break
        case 'high':
          score -= 0.2
          break
        case 'medium':
          score -= 0.1
          break
        case 'low':
          score -= 0.05
          break
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      issues,
      suggestions,
      summary: content.split('\n')[0]?.substring(0, 200) || 'Code review completed',
      rawResponse: content,
    }
  }
}

// Singleton instance
let qwenClient: QwenCodeClient | null = null

export function getQwenCodeClient(config?: QwenCodeConfig): QwenCodeClient {
  if (!qwenClient) {
    qwenClient = new QwenCodeClient(config)
  }
  return qwenClient
}

export function initializeQwenCodeClient(config?: QwenCodeConfig): QwenCodeClient {
  qwenClient = new QwenCodeClient(config)
  return qwenClient
}
