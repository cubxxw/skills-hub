/**
 * Skills API Routes
 * Provides endpoints for managing skills
 */

import type { Request, Response } from 'express'

export interface SkillInfo {
  id: string
  name: string
  description: string
  version: string
  author?: string
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

// Mock skills data (will be replaced with actual file system / database)
const mockSkills: SkillInfo[] = [
  {
    id: 'skill-001',
    name: 'web-search',
    description: 'Search the web for information',
    version: '1.0.0',
    author: 'OpenClaw Team',
    status: 'active',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: 'skill-002',
    name: 'code-executor',
    description: 'Execute code snippets in sandboxed environment',
    version: '0.9.5',
    author: 'OpenClaw Team',
    status: 'active',
    createdAt: '2024-01-10T08:30:00.000Z',
    updatedAt: '2024-01-12T14:20:00.000Z',
  },
  {
    id: 'skill-003',
    name: 'file-manager',
    description: 'Manage files and directories',
    version: '1.1.0',
    author: 'OpenClaw Team',
    status: 'active',
    createdAt: '2024-01-05T12:00:00.000Z',
    updatedAt: '2024-01-08T09:15:00.000Z',
  },
]

/**
 * GET /api/skills
 * Returns list of all available skills
 */
export function getSkills(_req: Request, res: Response<SkillsListResponse>): void {
  res.json({
    skills: mockSkills,
    total: mockSkills.length,
    timestamp: new Date().toISOString(),
  })
}

/**
 * GET /api/skills/:id
 * Returns details of a specific skill
 */
export function getSkillById(req: Request, res: Response<SkillInfo | { error: string }>): void {
  const { id } = req.params
  const skill = mockSkills.find((s) => s.id === id)

  if (!skill) {
    res.status(404).json({ error: `Skill with id '${id}' not found` })
    return
  }

  res.json(skill)
}

/**
 * GET /api/skills/status/:id
 * Returns runtime status of a specific skill
 */
export function getSkillStatus(req: Request, res: Response<{ status: string; skillId: string; timestamp: string } | { error: string }>): void {
  const { id } = req.params
  const skill = mockSkills.find((s) => s.id === id)

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
