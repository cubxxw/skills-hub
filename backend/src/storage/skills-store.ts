/**
 * Skills Store
 * Manages skill storage and retrieval
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { SkillMetadata } from '../validators/skill-validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface StoredSkill {
  id: string
  name: string
  description: string
  version: string
  author?: string
  tags?: string[]
  enabled: boolean
  status: 'active' | 'inactive' | 'error' | 'validating'
  createdAt: string
  updatedAt: string
  path: string
  metadata: SkillMetadata
  validationScore: number
  source: 'upload' | 'github' | 'editor'
  githubUrl?: string
}

export interface SkillsStoreOptions {
  storagePath?: string
  autoLoad?: boolean
}

/**
 * Generate unique skill ID
 */
function generateSkillId(name: string): string {
  const timestamp = Date.now().toString(36)
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
  return `skill-${sanitizedName}-${timestamp}`
}

/**
 * Skills Store Class
 * Handles persistence and retrieval of skills
 */
export class SkillsStore {
  private storagePath: string
  private skills: Map<string, StoredSkill>
  private skillsDir: string

  constructor(options: SkillsStoreOptions = {}) {
    const { storagePath = './data/skills', autoLoad = true } = options
    
    // Resolve storage path relative to project root
    this.storagePath = path.resolve(__dirname, '../../', storagePath)
    this.skillsDir = path.join(this.storagePath, 'packages')
    this.skills = new Map()

    if (autoLoad) {
      this.initializeStorage()
      this.loadSkills()
    }
  }

  /**
   * Initialize storage directories
   */
  private initializeStorage(): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true })
      }
      if (!fs.existsSync(this.skillsDir)) {
        fs.mkdirSync(this.skillsDir, { recursive: true })
      }
      console.log(`📦 Skills storage initialized at ${this.storagePath}`)
    } catch (error) {
      console.error('❌ Failed to initialize skills storage:', error)
      throw error
    }
  }

  /**
   * Load existing skills from storage
   */
  private loadSkills(): void {
    try {
      const manifestPath = path.join(this.storagePath, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        for (const skill of manifest.skills || []) {
          this.skills.set(skill.id, skill)
        }
        console.log(`📚 Loaded ${this.skills.size} skills from storage`)
      }
    } catch (error) {
      console.warn('⚠️ No existing skills manifest found, starting fresh')
    }
  }

  /**
   * Save skills manifest
   */
  private saveManifest(): void {
    try {
      const manifestPath = path.join(this.storagePath, 'manifest.json')
      const manifest = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        skills: Array.from(this.skills.values()),
      }
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    } catch (error) {
      console.error('❌ Failed to save skills manifest:', error)
    }
  }

  /**
   * Store a new skill
   */
  async storeSkill(
    name: string,
    description: string,
    version: string,
    files: Map<string, Buffer>,
    metadata: SkillMetadata,
    validationScore: number,
    source: 'upload' | 'github' | 'editor',
    githubUrl?: string
  ): Promise<StoredSkill> {
    const id = generateSkillId(name)
    const skillDir = path.join(this.skillsDir, id)

    try {
      // Create skill directory
      fs.mkdirSync(skillDir, { recursive: true })

      // Write all files
      for (const [filePath, content] of files.entries()) {
        const fullPath = path.join(skillDir, filePath)
        const dirPath = path.dirname(fullPath)
        
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true })
        }
        
        fs.writeFileSync(fullPath, content)
      }

      // Create stored skill record
      const now = new Date().toISOString()
      const storedSkill: StoredSkill = {
        id,
        name,
        description,
        version,
        author: metadata.author,
        tags: metadata.keywords || [],
        enabled: validationScore >= 0.8,
        status: validationScore >= 0.8 ? 'active' : 'inactive',
        createdAt: now,
        updatedAt: now,
        path: skillDir,
        metadata,
        validationScore,
        source,
        githubUrl,
      }

      // Store in memory
      this.skills.set(id, storedSkill)

      // Save manifest
      this.saveManifest()

      console.log(`✅ Stored skill: ${name} (${id})`)
      return storedSkill
    } catch (error) {
      console.error(`❌ Failed to store skill ${name}:`, error)
      
      // Cleanup on failure
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true })
      }
      
      throw error
    }
  }

  /**
   * Get all skills
   */
  getAllSkills(): StoredSkill[] {
    return Array.from(this.skills.values())
  }

  /**
   * Get skill by ID
   */
  getSkillById(id: string): StoredSkill | undefined {
    return this.skills.get(id)
  }

  /**
   * Get skill by name
   */
  getSkillByName(name: string): StoredSkill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.name === name) {
        return skill
      }
    }
    return undefined
  }

  /**
   * Update skill status
   */
  updateSkillStatus(id: string, status: StoredSkill['status']): boolean {
    const skill = this.skills.get(id)
    if (!skill) return false

    skill.status = status
    skill.updatedAt = new Date().toISOString()
    this.skills.set(id, skill)
    this.saveManifest()
    
    return true
  }

  /**
   * Delete skill
   */
  deleteSkill(id: string): boolean {
    const skill = this.skills.get(id)
    if (!skill) return false

    try {
      // Remove files
      if (fs.existsSync(skill.path)) {
        fs.rmSync(skill.path, { recursive: true, force: true })
      }

      // Remove from memory
      this.skills.delete(id)
      this.saveManifest()

      console.log(`🗑️ Deleted skill: ${skill.name} (${id})`)
      return true
    } catch (error) {
      console.error(`❌ Failed to delete skill ${id}:`, error)
      return false
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { totalSkills: number; activeSkills: number; totalSize: number } {
    const skills = Array.from(this.skills.values())
    let totalSize = 0

    for (const skill of skills) {
      try {
        if (fs.existsSync(skill.path)) {
          const files = fs.readdirSync(skill.path, { recursive: true })
          for (const file of files) {
            const filePath = path.join(skill.path, file as string)
            const stat = fs.statSync(filePath)
            if (stat.isFile()) {
              totalSize += stat.size
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to calculate size for skill ${skill.id}`)
      }
    }

    return {
      totalSkills: skills.length,
      activeSkills: skills.filter(s => s.status === 'active').length,
      totalSize,
    }
  }
}

// Export singleton instance
export const skillsStore = new SkillsStore()
