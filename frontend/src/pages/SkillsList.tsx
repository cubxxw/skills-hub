/**
 * Skills List Page
 * Displays all available skills with filtering and search
 */

import { useState, useMemo } from 'react';
import { useAGUI } from '../providers/AGUIProvider';
import type { Skill } from '../types/ag-ui';

interface SkillsListProps {
  onSkillSelect?: (skillId: string) => void;
}

export function SkillsList({ onSkillSelect }: SkillsListProps): JSX.Element {
  const { skills, connectionState, executeSkill } = useAGUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [executingSkill, setExecutingSkill] = useState<string | null>(null);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesFilter =
        filterEnabled === 'all' ||
        (filterEnabled === 'enabled' && skill.enabled) ||
        (filterEnabled === 'disabled' && !skill.enabled);

      return matchesSearch && matchesFilter;
    });
  }, [skills, searchTerm, filterEnabled]);

  const handleExecute = async (skill: Skill): Promise<void> => {
    setExecutingSkill(skill.id);
    try {
      executeSkill(skill.id);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setExecutingSkill(null);
    }
  };

  const ConnectionStatus = (): JSX.Element => {
    const statusColors: Record<string, string> = {
      connected: 'bg-green-500',
      connecting: 'bg-yellow-500',
      disconnected: 'bg-red-500',
      reconnecting: 'bg-orange-500',
      error: 'bg-red-600',
    };

    return (
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[connectionState.status] || 'bg-gray-500'}`} />
        <span className="text-sm text-gray-400 capitalize">{connectionState.status}</span>
        {connectionState.reconnectAttempts > 0 && (
          <span className="text-xs text-gray-500">
            (attempt {connectionState.reconnectAttempts})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">🚀 Skills</h1>
          <ConnectionStatus />
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filterEnabled}
            onChange={(e) => setFilterEnabled(e.target.value as typeof filterEnabled)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mt-2 text-sm text-gray-400">
          Showing {filteredSkills.length} of {skills.length} skills
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="text-4xl mb-2">📭</span>
            <p>No skills found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-blue-400 hover:text-blue-300"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isExecuting={executingSkill === skill.id}
                onExecute={() => handleExecute(skill)}
                onSelect={() => onSkillSelect?.(skill.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  isExecuting: boolean;
  onExecute: () => void;
  onSelect: () => void;
}

function SkillCard({ skill, isExecuting, onExecute, onSelect }: SkillCardProps): JSX.Element {
  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-lg ${
        skill.enabled
          ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
          : 'bg-gray-800/50 border-gray-800 opacity-60'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{skill.name}</h3>
          <span className="text-xs text-gray-500">v{skill.version}</span>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded-full ${
            skill.enabled
              ? 'bg-green-900/50 text-green-400'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {skill.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{skill.description}</p>

      {/* Tags */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-blue-900/30 text-blue-400 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Author */}
      {skill.author && (
        <div className="text-xs text-gray-500 mb-3">by {skill.author}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExecute();
          }}
          disabled={!skill.enabled || isExecuting}
          className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
            skill.enabled
              ? isExecuting
                ? 'bg-yellow-600 text-white cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isExecuting ? '⏳ Running...' : '▶️ Execute'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Details
        </button>
      </div>
    </div>
  );
}

export default SkillsList;
