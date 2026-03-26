/**
 * Version Manager Service
 * Manages semantic versioning for skills
 * - Semver version control
 * - Version history tracking
 * - Rollback functionality
 * - Changelog generation
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export interface Semver {
  major: number
  minor: number
  patch: number
  prerelease?: string
  build?: string
}

export interface VersionInfo {
  version: string
  semver: Semver
  publishedAt: Date
  changelog?: string
  size: number
  hash: string
  status: 'published' | 'deprecated' | 'rolledback'
  rollbackTarget?: string
}

export interface VersionHistory {
  skillName: string
  versions: VersionInfo[]
  currentVersion: string
  latestVersion: string
}

export interface ChangelogEntry {
  version: string
  date: Date
  changes: ChangelogChange[]
}

export interface ChangelogChange {
  type: ChangeType
  description: string
  author?: string
  references?: string[]
}

export type ChangeType = 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'break'

export interface Changelog {
  skillName: string
  entries: ChangelogEntry[]
  latestVersion: string
  generatedAt: Date
}

export interface RollbackResult {
  success: boolean
  previousVersion: string
  rolledbackVersion: string
  timestamp: Date
  error?: string
}

export interface BumpOptions {
  prerelease?: string
  build?: string
  exactVersion?: string
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  style: 'Styling',
  refactor: 'Refactoring',
  test: 'Tests',
  chore: 'Chores',
  break: 'Breaking Changes',
}

export class VersionManager {
  private versionHistory: Map<string, VersionHistory> = new Map()
  private changelogs: Map<string, Changelog> = new Map()

  /**
   * Parse semver string
   */
  parseSemver(version: string): Semver {
    const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
    const match = version.match(regex)

    if (!match) {
      throw new Error(`Invalid semver format: ${version}`)
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5],
    }
  }

  /**
   * Convert semver to string
   */
  stringifySemver(semver: Semver): string {
    let version = `${semver.major}.${semver.minor}.${semver.patch}`

    if (semver.prerelease) {
      version += `-${semver.prerelease}`
    }

    if (semver.build) {
      version += `+${semver.build}`
    }

    return version
  }

  /**
   * Compare two semver versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1: string, v2: string): number {
    const s1 = this.parseSemver(v1)
    const s2 = this.parseSemver(v2)

    // Compare major
    if (s1.major !== s2.major) return s1.major > s2.major ? 1 : -1

    // Compare minor
    if (s1.minor !== s2.minor) return s1.minor > s2.minor ? 1 : -1

    // Compare patch
    if (s1.patch !== s2.patch) return s1.patch > s2.patch ? 1 : -1

    // Compare prerelease
    if (!s1.prerelease && s2.prerelease) return 1
    if (s1.prerelease && !s2.prerelease) return -1
    if (s1.prerelease && s2.prerelease) {
      if (s1.prerelease !== s2.prerelease) {
        return s1.prerelease > s2.prerelease ? 1 : -1
      }
    }

    return 0
  }

  /**
   * Bump version
   */
  bumpVersion(currentVersion: string, type: 'major' | 'minor' | 'patch', options?: BumpOptions): string {
    const semver = this.parseSemver(currentVersion)

    switch (type) {
      case 'major':
        semver.major += 1
        semver.minor = 0
        semver.patch = 0
        break
      case 'minor':
        semver.minor += 1
        semver.patch = 0
        break
      case 'patch':
        semver.patch += 1
        break
    }

    // Clear prerelease on non-prerelease bump
    if (!options?.prerelease) {
      semver.prerelease = undefined
    } else {
      semver.prerelease = options.prerelease
    }

    if (options?.build) {
      semver.build = options.build
    }

    return this.stringifySemver(semver)
  }

  /**
   * Get suggested next version
   */
  suggestNextVersion(currentVersion: string, changes?: ChangelogChange[]): string {
    if (!changes || changes.length === 0) {
      return this.bumpVersion(currentVersion, 'patch')
    }

    // Check for breaking changes
    const hasBreaking = changes.some(c => c.type === 'break')
    const hasFeatures = changes.some(c => c.type === 'feat')

    if (hasBreaking) {
      return this.bumpVersion(currentVersion, 'major')
    }

    if (hasFeatures) {
      return this.bumpVersion(currentVersion, 'minor')
    }

    return this.bumpVersion(currentVersion, 'patch')
  }

  /**
   * Add version to history
   */
  addVersion(
    skillName: string,
    version: string,
    options?: {
      changelog?: string
      size?: number
      hash?: string
      publishedAt?: Date
    }
  ): VersionInfo {
    const semver = this.parseSemver(version)
    const now = options?.publishedAt || new Date()

    const versionInfo: VersionInfo = {
      version,
      semver,
      publishedAt: now,
      changelog: options?.changelog,
      size: options?.size || 0,
      hash: options?.hash || '',
      status: 'published',
    }

    let history = this.versionHistory.get(skillName)

    if (!history) {
      history = {
        skillName,
        versions: [],
        currentVersion: version,
        latestVersion: version,
      }
    }

    // Add version
    history.versions.push(versionInfo)

    // Sort versions (newest first)
    history.versions.sort((a, b) => this.compareVersions(b.version, a.version))

    // Update current and latest
    history.latestVersion = history.versions[0].version
    history.currentVersion = version

    this.versionHistory.set(skillName, history)

    // Add to changelog
    this.addToChangelog(skillName, version, versionInfo)

    return versionInfo
  }

  /**
   * Get version history for a skill
   */
  getVersionHistory(skillName: string): VersionHistory | undefined {
    return this.versionHistory.get(skillName)
  }

  /**
   * Get all versions for a skill
   */
  getAllVersions(skillName: string): VersionInfo[] {
    const history = this.versionHistory.get(skillName)
    return history?.versions || []
  }

  /**
   * Get specific version info
   */
  getVersion(skillName: string, version: string): VersionInfo | undefined {
    const history = this.versionHistory.get(skillName)
    return history?.versions.find(v => v.version === version)
  }

  /**
   * Get current version
   */
  getCurrentVersion(skillName: string): string | undefined {
    const history = this.versionHistory.get(skillName)
    return history?.currentVersion
  }

  /**
   * Get latest version
   */
  getLatestVersion(skillName: string): string | undefined {
    const history = this.versionHistory.get(skillName)
    return history?.latestVersion
  }

  /**
   * Rollback to previous version
   */
  rollback(skillName: string, targetVersion?: string): RollbackResult {
    const history = this.versionHistory.get(skillName)

    if (!history || history.versions.length === 0) {
      return {
        success: false,
        previousVersion: '',
        rolledbackVersion: '',
        timestamp: new Date(),
        error: 'No version history found',
      }
    }

    const currentVersion = history.currentVersion
    const currentIndex = history.versions.findIndex(v => v.version === currentVersion)

    if (currentIndex === -1) {
      return {
        success: false,
        previousVersion: '',
        rolledbackVersion: '',
        timestamp: new Date(),
        error: 'Current version not found in history',
      }
    }

    // Find target version
    let targetIndex: number

    if (targetVersion) {
      targetIndex = history.versions.findIndex(v => v.version === targetVersion)
      if (targetIndex === -1) {
        return {
          success: false,
          previousVersion: currentVersion,
          rolledbackVersion: '',
          timestamp: new Date(),
          error: `Target version ${targetVersion} not found`,
        }
      }
    } else {
      // Rollback to previous version
      targetIndex = currentIndex + 1
      if (targetIndex >= history.versions.length) {
        return {
          success: false,
          previousVersion: currentVersion,
          rolledbackVersion: '',
          timestamp: new Date(),
          error: 'No previous version to rollback to',
        }
      }
    }

    const targetVersionInfo = history.versions[targetIndex]

    // Mark current version as rolled back
    history.versions[currentIndex].status = 'rolledback'
    history.versions[currentIndex].rollbackTarget = targetVersionInfo.version

    // Update current version
    history.currentVersion = targetVersionInfo.version

    // Add rollback entry to changelog
    this.addRollbackToChangelog(skillName, currentVersion, targetVersionInfo.version)

    this.versionHistory.set(skillName, history)

    return {
      success: true,
      previousVersion: currentVersion,
      rolledbackVersion: targetVersionInfo.version,
      timestamp: new Date(),
    }
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(skillName: string, version: string): boolean {
    const history = this.versionHistory.get(skillName)
    if (!history) return false

    const versionInfo = history.versions.find(v => v.version === version)
    if (!versionInfo) return false

    versionInfo.status = 'deprecated'
    return true
  }

  /**
   * Generate changelog
   */
  generateChangelog(skillName: string, options?: { fromVersion?: string; toVersion?: string }): Changelog {
    const history = this.versionHistory.get(skillName)

    if (!history || history.versions.length === 0) {
      return {
        skillName,
        entries: [],
        latestVersion: '',
        generatedAt: new Date(),
      }
    }

    let versions = history.versions

    // Filter by version range if specified
    if (options?.fromVersion || options?.toVersion) {
      versions = versions.filter(v => {
        if (options.fromVersion && this.compareVersions(v.version, options.fromVersion) < 0) {
          return false
        }
        if (options.toVersion && this.compareVersions(v.version, options.toVersion) > 0) {
          return false
        }
        return true
      })
    }

    const entries: ChangelogEntry[] = versions.map(v => {
      const changes = this.parseChangelogChanges(v.changelog || '')

      return {
        version: v.version,
        date: v.publishedAt,
        changes,
      }
    })

    const changelog: Changelog = {
      skillName,
      entries,
      latestVersion: history.latestVersion,
      generatedAt: new Date(),
    }

    this.changelogs.set(skillName, changelog)

    return changelog
  }

  /**
   * Get changelog
   */
  getChangelog(skillName: string): Changelog | undefined {
    return this.changelogs.get(skillName)
  }

  /**
   * Format changelog as markdown
   */
  formatChangelogMarkdown(skillName: string): string {
    const changelog = this.getChangelog(skillName)

    if (!changelog || changelog.entries.length === 0) {
      return `# Changelog\n\nNo releases yet.\n`
    }

    let markdown = `# Changelog\n\nAll notable changes to **${skillName}** will be documented in this file.\n\n`

    for (const entry of changelog.entries) {
      const dateStr = entry.date.toISOString().split('T')[0]
      markdown += `## [${entry.version}] - ${dateStr}\n\n`

      // Group changes by type
      const changesByType = new Map<ChangeType, ChangelogChange[]>()

      for (const change of entry.changes) {
        const existing = changesByType.get(change.type) || []
        existing.push(change)
        changesByType.set(change.type, existing)
      }

      // Output changes by type
      for (const [type, changes] of changesByType.entries()) {
        if (changes.length === 0) continue

        const label = CHANGE_TYPE_LABELS[type]
        markdown += `### ${label}\n\n`

        for (const change of changes) {
          let line = `- ${change.description}`

          if (change.author) {
            line += ` (@${change.author})`
          }

          if (change.references && change.references.length > 0) {
            line += ` ${change.references.map(r => `[${r}]`).join(' ')}`
          }

          markdown += `${line}\n`
        }

        markdown += '\n'
      }

      markdown += '\n'
    }

    return markdown
  }

  /**
   * Save changelog to file
   */
  saveChangelogToFile(skillName: string, outputPath: string): void {
    const markdown = this.formatChangelogMarkdown(skillName)

    // Ensure directory exists
    const dir = dirname(outputPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(outputPath, markdown, 'utf-8')
  }

  /**
   * Parse changelog changes from text
   */
  private parseChangelogChanges(text: string): ChangelogChange[] {
    if (!text.trim()) return []

    const changes: ChangelogChange[] = []
    const lines = text.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // Parse conventional commit format: - feat: description
      const match = trimmed.match(/^[-*]\s*(\w+)(?:\(([^)]+)\))?:\s*(.+)$/)

      if (match) {
        const [, type, , description] = match
        changes.push({
          type: type as ChangeType,
          description: description.trim(),
        })
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        // Generic change
        changes.push({
          type: 'chore',
          description: trimmed.replace(/^[-*]\s*/, '').trim(),
        })
      }
    }

    return changes
  }

  /**
   * Add to changelog
   */
  private addToChangelog(skillName: string, version: string, versionInfo: VersionInfo): void {
    let changelog = this.changelogs.get(skillName)

    if (!changelog) {
      changelog = {
        skillName,
        entries: [],
        latestVersion: version,
        generatedAt: new Date(),
      }
    }

    const changes = this.parseChangelogChanges(versionInfo.changelog || '')

    const entry: ChangelogEntry = {
      version,
      date: versionInfo.publishedAt,
      changes,
    }

    changelog.entries.unshift(entry)
    changelog.latestVersion = version
    changelog.generatedAt = new Date()

    this.changelogs.set(skillName, changelog)
  }

  /**
   * Add rollback entry to changelog
   */
  private addRollbackToChangelog(skillName: string, fromVersion: string, toVersion: string): void {
    const changelog = this.changelogs.get(skillName)
    if (!changelog) return

    const entry: ChangelogEntry = {
      version: toVersion,
      date: new Date(),
      changes: [
        {
          type: 'chore',
          description: `Rollback from ${fromVersion} to ${toVersion}`,
        },
      ],
    }

    changelog.entries.unshift(entry)
    changelog.generatedAt = new Date()

    this.changelogs.set(skillName, changelog)
  }

  /**
   * Clear history for a skill
   */
  clearHistory(skillName: string): boolean {
    const deleted = this.versionHistory.delete(skillName)
    this.changelogs.delete(skillName)
    return deleted
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.versionHistory.clear()
    this.changelogs.clear()
  }
}

// Singleton instance
let versionManager: VersionManager | null = null

export function getVersionManager(): VersionManager {
  if (!versionManager) {
    versionManager = new VersionManager()
  }
  return versionManager
}

export function initializeVersionManager(): VersionManager {
  versionManager = new VersionManager()
  return versionManager
}
