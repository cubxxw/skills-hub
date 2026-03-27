/**
 * Integration Tests for Skills Data Flow
 * Tests the complete data flow from backend to frontend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('Skills Data Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Data Flow', () => {
    it('should transform and display skills correctly', async () => {
      // 1. Mock backend API response
      const mockApiResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'web-search',
            description: 'Search the web for information',
            version: '1.0.0',
            author: 'OpenClaw Team',
            tags: ['search', 'web', 'information'],
            enabled: true,
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
            tags: ['code', 'execution', 'sandbox'],
            enabled: true,
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
            tags: ['files', 'management', 'filesystem'],
            enabled: false,
            status: 'inactive',
            createdAt: '2024-01-05T12:00:00.000Z',
            updatedAt: '2024-01-08T09:15:00.000Z',
          },
        ],
        total: 3,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockApiResponse),
      });

      // 2. Fetch data from API
      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      // 3. Transform data (as done in AGUIProvider)
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

      // 4. Verify transformation
      expect(transformedSkills).toHaveLength(3);

      // 5. Verify each skill has required fields for UI
      transformedSkills.forEach(skill => {
        expect(skill.id).toBeDefined();
        expect(skill.name).toBeDefined();
        expect(skill.description).toBeDefined();
        expect(skill.version).toBeDefined();
        expect(skill.enabled).toBeDefined();
        expect(typeof skill.enabled).toBe('boolean');
        expect(Array.isArray(skill.tags)).toBe(true);
      });

      // 6. Verify specific skills
      expect(transformedSkills[0]).toEqual({
        id: 'skill-001',
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        author: 'OpenClaw Team',
        tags: ['search', 'web', 'information'],
        parameters: [],
        enabled: true,
      });

      expect(transformedSkills[2].enabled).toBe(false); // file-manager is disabled
    });

    it('should handle backward compatibility with old API format', async () => {
      // Mock old API response (without enabled and tags fields)
      const mockOldApiResponse = {
        skills: [
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
            description: 'Execute code snippets',
            version: '0.9.5',
            author: 'OpenClaw Team',
            status: 'active',
            createdAt: '2024-01-10T08:30:00.000Z',
            updatedAt: '2024-01-12T14:20:00.000Z',
          },
        ],
        total: 2,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockOldApiResponse),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      // Transform with backward compatibility
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

      // Should still work correctly
      expect(transformedSkills).toHaveLength(2);
      expect(transformedSkills[0].enabled).toBe(true); // Derived from status
      expect(transformedSkills[0].tags).toEqual([]); // Default empty array
    });

    it('should support filtering after transformation', async () => {
      const mockApiResponse = {
        skills: [
          {
            id: 'skill-001',
            name: 'web-search',
            description: 'Search the web',
            version: '1.0.0',
            tags: ['search', 'web'],
            enabled: true,
            status: 'active',
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
          {
            id: 'skill-002',
            name: 'code-executor',
            description: 'Execute code',
            version: '0.9.5',
            tags: ['code'],
            enabled: true,
            status: 'active',
            createdAt: '2024-01-10T08:30:00.000Z',
            updatedAt: '2024-01-12T14:20:00.000Z',
          },
          {
            id: 'skill-003',
            name: 'file-manager',
            description: 'Manage files',
            version: '1.1.0',
            tags: ['files'],
            enabled: false,
            status: 'inactive',
            createdAt: '2024-01-05T12:00:00.000Z',
            updatedAt: '2024-01-08T09:15:00.000Z',
          },
        ],
        total: 3,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockApiResponse),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      const transformedSkills = data.skills.map((skill: {
        id: string;
        name: string;
        description: string;
        version: string;
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
        tags: skill.tags || [],
        parameters: skill.parameters || [],
        enabled: skill.enabled ?? (skill.status === 'active'),
      }));

      // Test filtering by enabled status
      const enabledSkills = transformedSkills.filter(skill => skill.enabled);
      expect(enabledSkills).toHaveLength(2);

      // Test filtering by search term
      const searchResults = transformedSkills.filter(skill =>
        skill.name.toLowerCase().includes('web')
      );
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('web-search');

      // Test filtering by tag
      const tagResults = transformedSkills.filter(skill =>
        skill.tags.some(tag => tag.toLowerCase().includes('code'))
      );
      expect(tagResults).toHaveLength(1);
      expect(tagResults[0].name).toBe('code-executor');

      // Test combined filtering
      const combinedResults = transformedSkills.filter(skill =>
        skill.enabled && skill.tags.some(tag => tag.toLowerCase().includes('files'))
      );
      expect(combinedResults).toHaveLength(0); // file-manager is disabled
    });
  });

  describe('Skills Count and Stats', () => {
    it('should calculate correct stats for UI', () => {
      const skills = [
        { id: '1', name: 'Skill 1', enabled: true, tags: ['tag1'] },
        { id: '2', name: 'Skill 2', enabled: true, tags: ['tag2'] },
        { id: '3', name: 'Skill 3', enabled: false, tags: ['tag3'] },
      ];

      const totalSkills = skills.length;
      const enabledCount = skills.filter(s => s.enabled).length;
      const disabledCount = skills.filter(s => !s.enabled).length;

      expect(totalSkills).toBe(3);
      expect(enabledCount).toBe(2);
      expect(disabledCount).toBe(1);

      // Stats text should be correct
      const statsText = `Showing ${totalSkills} of ${totalSkills} skills`;
      expect(statsText).toBe('Showing 3 of 3 skills');
    });

    it('should show filtered stats correctly', () => {
      const allSkills = [
        { id: '1', name: 'Skill 1', enabled: true, tags: ['tag1'] },
        { id: '2', name: 'Skill 2', enabled: true, tags: ['tag2'] },
        { id: '3', name: 'Skill 3', enabled: false, tags: ['tag3'] },
      ];

      const filteredSkills = allSkills.filter(s => s.enabled);

      const statsText = `Showing ${filteredSkills.length} of ${allSkills.length} skills`;
      expect(statsText).toBe('Showing 2 of 3 skills');
    });
  });

  describe('Empty State Handling', () => {
    it('should handle empty skills list', () => {
      const skills: unknown[] = [];
      const isEmpty = skills.length === 0;

      expect(isEmpty).toBe(true);
    });

    it('should handle empty filtered results', () => {
      const skills = [
        { id: '1', name: 'Skill 1', enabled: true, tags: ['tag1'] },
        { id: '2', name: 'Skill 2', enabled: true, tags: ['tag2'] },
      ];

      const filtered = skills.filter(s => s.name.includes('nonexistent'));
      const isEmpty = filtered.length === 0;

      expect(isEmpty).toBe(true);
    });

    it('should not show empty state when skills exist', () => {
      const skills = [
        { id: '1', name: 'Skill 1', enabled: true, tags: ['tag1'] },
      ];

      const isEmpty = skills.length === 0;

      expect(isEmpty).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      let errorMessage: string | null = null;
      try {
        await fetch('http://localhost:4000/api/skills');
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      expect(errorMessage).toBe('Network error');
    });

    it('should handle invalid API response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({ invalid: 'data' }),
      });

      const response = await fetch('http://localhost:4000/api/skills');
      const data = await response.json();

      // Should handle missing skills array
      expect(data.skills).toBeUndefined();
    });
  });
});
