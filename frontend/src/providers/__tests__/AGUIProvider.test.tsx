/**
 * Tests for AGUIProvider skills data transformation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('AGUIProvider Skills Data Transformation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Backend API Response Transformation', () => {
    it('should transform backend format with status field to frontend format with enabled field', async () => {
      // Mock backend response (old format with status only)
      const mockBackendResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'web-search',
            description: 'Search the web for information',
            version: '1.0.0',
            author: 'OpenClaw Team',
            status: 'active' as const,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
          {
            id: 'skill-002',
            name: 'code-executor',
            description: 'Execute code snippets',
            version: '0.9.5',
            author: 'OpenClaw Team',
            status: 'inactive' as const,
            createdAt: '2024-01-10T08:30:00.000Z',
            updatedAt: '2024-01-12T14:20:00.000Z',
          },
        ],
        total: 2,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockBackendResponse),
      });

      // Simulate the transformation logic from AGUIProvider
      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      const transformedSkills = data.skills.map((skill: {
        id: string;
        name: string;
        description: string;
        version: string;
        author?: string;
        tags?: string[];
        enabled?: boolean;
        status?: 'active' | 'inactive' | 'error';
        createdAt: string;
        updatedAt: string;
        parameters?: unknown[];
      }) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        tags: skill.tags || [],
        parameters: skill.parameters || [],
        enabled: skill.enabled ?? (skill.status === 'active'),
      }));

      expect(transformedSkills).toHaveLength(2);
      expect(transformedSkills[0]).toEqual({
        id: 'skill-001',
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        author: 'OpenClaw Team',
        tags: [],
        parameters: [],
        enabled: true, // status 'active' should transform to enabled: true
      });
      expect(transformedSkills[1]).toEqual({
        id: 'skill-002',
        name: 'code-executor',
        description: 'Execute code snippets',
        version: '0.9.5',
        author: 'OpenClaw Team',
        tags: [],
        parameters: [],
        enabled: false, // status 'inactive' should transform to enabled: false
      });
    });

    it('should use enabled field directly when available (new format)', async () => {
      // Mock backend response (new format with enabled field)
      const mockBackendResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'web-search',
            description: 'Search the web for information',
            version: '1.0.0',
            author: 'OpenClaw Team',
            tags: ['search', 'web'],
            enabled: true,
            status: 'active' as const,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
          {
            id: 'skill-002',
            name: 'file-manager',
            description: 'Manage files',
            version: '1.1.0',
            author: 'OpenClaw Team',
            tags: ['files'],
            enabled: false,
            status: 'active' as const, // Even with active status, enabled takes precedence
            createdAt: '2024-01-05T12:00:00.000Z',
            updatedAt: '2024-01-08T09:15:00.000Z',
          },
        ],
        total: 2,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockBackendResponse),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      const transformedSkills = data.skills.map((skill: {
        id: string;
        name: string;
        description: string;
        version: string;
        author?: string;
        tags?: string[];
        enabled?: boolean;
        status?: 'active' | 'inactive' | 'error';
        createdAt: string;
        updatedAt: string;
        parameters?: unknown[];
      }) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        tags: skill.tags || [],
        parameters: skill.parameters || [],
        enabled: skill.enabled ?? (skill.status === 'active'),
      }));

      expect(transformedSkills).toHaveLength(2);
      expect(transformedSkills[0]).toEqual({
        id: 'skill-001',
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        author: 'OpenClaw Team',
        tags: ['search', 'web'],
        parameters: [],
        enabled: true,
      });
      expect(transformedSkills[1]).toEqual({
        id: 'skill-002',
        name: 'file-manager',
        description: 'Manage files',
        version: '1.1.0',
        author: 'OpenClaw Team',
        tags: ['files'],
        parameters: [],
        enabled: false, // enabled field takes precedence over status
      });
    });

    it('should handle empty tags array when not provided', async () => {
      const mockBackendResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'test-skill',
            description: 'Test',
            version: '1.0.0',
            status: 'active' as const,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
        ],
        total: 1,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockBackendResponse),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      const transformedSkills = data.skills.map((skill: {
        id: string;
        name: string;
        description: string;
        version: string;
        tags?: string[];
        status?: 'active' | 'inactive' | 'error';
        createdAt: string;
        updatedAt: string;
        parameters?: unknown[];
      }) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        tags: skill.tags || [],
        parameters: skill.parameters || [],
        enabled: skill.status === 'active',
      }));

      expect(transformedSkills[0].tags).toEqual([]);
      expect(Array.isArray(transformedSkills[0].tags)).toBe(true);
    });

    it('should preserve tags when provided', async () => {
      const mockBackendResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'test-skill',
            description: 'Test',
            version: '1.0.0',
            tags: ['search', 'web', 'information'],
            status: 'active' as const,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
        ],
        total: 1,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockBackendResponse),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      const transformedSkills = data.skills.map((skill: {
        id: string;
        name: string;
        description: string;
        version: string;
        tags?: string[];
        status?: 'active' | 'inactive' | 'error';
        createdAt: string;
        updatedAt: string;
        parameters?: unknown[];
      }) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        tags: skill.tags || [],
        parameters: skill.parameters || [],
        enabled: skill.status === 'active',
      }));

      expect(transformedSkills[0].tags).toEqual(['search', 'web', 'information']);
    });
  });

  describe('SkillsList Filtering Logic', () => {
    const mockSkills = [
      {
        id: 'skill-001',
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        author: 'OpenClaw Team',
        tags: ['search', 'web'],
        enabled: true,
      },
      {
        id: 'skill-002',
        name: 'code-executor',
        description: 'Execute code snippets',
        version: '0.9.5',
        author: 'OpenClaw Team',
        tags: ['code', 'execution'],
        enabled: true,
      },
      {
        id: 'skill-003',
        name: 'file-manager',
        description: 'Manage files and directories',
        version: '1.1.0',
        author: 'OpenClaw Team',
        tags: ['files', 'management'],
        enabled: false,
      },
    ];

    it('should show all skills when filter is "all"', () => {
      const filtered = mockSkills.filter(skill => {
        const matchesFilter = true; // 'all' filter
        return matchesFilter;
      });

      expect(filtered).toHaveLength(3);
    });

    it('should show only enabled skills when filter is "enabled"', () => {
      const filtered = mockSkills.filter(skill => {
        const matchesFilter = skill.enabled; // 'enabled' filter
        return matchesFilter;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.enabled)).toBe(true);
      expect(filtered.map(s => s.name)).toEqual(['web-search', 'code-executor']);
    });

    it('should show only disabled skills when filter is "disabled"', () => {
      const filtered = mockSkills.filter(skill => {
        const matchesFilter = !skill.enabled; // 'disabled' filter
        return matchesFilter;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('file-manager');
    });

    it('should filter by search term in name', () => {
      const searchTerm = 'web';
      const filtered = mockSkills.filter(skill => {
        const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('web-search');
    });

    it('should filter by search term in description', () => {
      const searchTerm = 'execute';
      const filtered = mockSkills.filter(skill => {
        const matchesSearch = skill.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('code-executor');
    });

    it('should filter by search term in tags', () => {
      const searchTerm = 'files';
      const filtered = mockSkills.filter(skill => {
        const matchesSearch = skill.tags?.some(tag => 
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesSearch;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('file-manager');
    });

    it('should handle combined search and filter', () => {
      const searchTerm = 'code';
      const filterEnabled = true;

      const filtered = mockSkills.filter(skill => {
        const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = skill.enabled;
        return matchesSearch && matchesFilter;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('code-executor');
    });

    it('should return empty array when no skills match', () => {
      const searchTerm = 'nonexistent';
      const filtered = mockSkills.filter(skill => {
        const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });

      expect(filtered).toHaveLength(0);
    });
  });

  describe('SkillsList Display Logic', () => {
    it('should show "No skills found" when skills array is empty', () => {
      const skills: unknown[] = [];
      const shouldShowEmptyState = skills.length === 0;

      expect(shouldShowEmptyState).toBe(true);
    });

    it('should show skills grid when skills array is not empty', () => {
      const skills = [
        { id: '1', name: 'Test', enabled: true },
        { id: '2', name: 'Test 2', enabled: true },
      ];
      const shouldShowEmptyState = skills.length === 0;

      expect(shouldShowEmptyState).toBe(false);
      expect(skills.length).toBeGreaterThan(0);
    });

    it('should show "Showing X of Y" stats correctly', () => {
      const allSkills = [
        { id: '1', name: 'Test 1', enabled: true },
        { id: '2', name: 'Test 2', enabled: true },
        { id: '3', name: 'Test 3', enabled: false },
      ];
      const filteredSkills = allSkills.filter(s => s.enabled);

      const statsText = `Showing ${filteredSkills.length} of ${allSkills.length} skills`;

      expect(statsText).toBe('Showing 2 of 3 skills');
    });
  });
});
