/**
 * Skills API Routes
 * Provides endpoints for managing skills
 */

import type { Request, Response } from 'express'
import { skillsStore } from '../storage/skills-store.js'

export interface SkillInfo {
  id: string
  name: string
  description: string
  version: string
  author?: string
  tags?: string[]
  enabled: boolean
  status: 'active' | 'inactive' | 'error'
  createdAt: string
  updatedAt: string
  path?: string
}

export interface SkillsListResponse {
  skills: SkillInfo[]
  total: number
  timestamp: string
}

/**
 * Convert StoredSkill to SkillInfo for API response
 */
function toSkillInfo(skill: {
  id: string
  name: string
  description: string
  version: string
  author?: string
  tags?: string[]
  enabled: boolean
  status: string
  createdAt: string
  updatedAt: string
  path?: string
}): SkillInfo {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    author: skill.author,
    tags: skill.tags || [],
    enabled: skill.enabled,
    status: skill.status as 'active' | 'inactive' | 'error',
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    path: skill.path,
  }
}

/**
 * GET /api/skills
 * Returns list of all available skills from storage
 */
export function getSkills(_req: Request, res: Response<SkillsListResponse>): void {
  try {
    const storedSkills = skillsStore.getAllSkills()
    const skills = storedSkills.map(toSkillInfo)
    
    res.json({
      skills,
      total: skills.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Failed to get skills:', error)
    res.json({
      skills: [],
      total: 0,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * GET /api/skills/:id
 * Returns details of a specific skill from storage
 */
export function getSkillById(req: Request, res: Response<SkillInfo | { error: string }>): void {
  const { id } = req.params
  const skill = skillsStore.getSkillById(id)

  if (!skill) {
    res.status(404).json({ error: `Skill with id '${id}' not found` })
    return
  }

  res.json(toSkillInfo(skill))
}

/**
 * GET /api/skills/status/:id
 * Returns runtime status of a specific skill
 */
export function getSkillStatus(req: Request, res: Response<{ status: string; skillId: string; timestamp: string } | { error: string }>): void {
  const { id } = req.params
  const skill = skillsStore.getSkillById(id)

  if (!skill) {
    res.status(404).json({ error: `Skill with id '${id}' not found` })
    return
  }

  res.json({
    status: skill.status,
    skillId: id,
    timestamp: new Date().toISOString(),
  })
}
