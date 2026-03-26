/**
 * Skill Detail Page
 * Displays detailed information about a specific skill with execution controls and live logs
 */

import { useState, useEffect, useCallback } from 'react';
import { useAGUI } from '../providers/AGUIProvider';
import { LogStream } from '../components/LogStream';
import type { Skill } from '../types/ag-ui';

interface SkillDetailProps {
  skillId: string;
  onBack?: () => void;
}

interface ExecutionHistory {
  id: string;
  timestamp: number;
  duration?: number;
  success: boolean;
  error?: string;
}

export function SkillDetail({ skillId, onBack }: SkillDetailProps): JSX.Element {
  const { skills, executeSkill, subscribe, unsubscribe, logs, clearLogs } = useAGUI();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [parameters, setParameters] = useState<Record<string, string>>({});

  const skill: Skill | undefined = skills.find((s) => s.id === skillId);

  // Subscribe to skill logs on mount
  useEffect((): (() => void) => {
    if (skillId) {
      subscribe(skillId);
    }
    return () => {
      if (skillId) {
        unsubscribe(skillId);
      }
    };
  }, [skillId, subscribe, unsubscribe]);

  const handleExecute = useCallback(async (): Promise<void> => {
    if (!skill) return;

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      // Parse parameters
      const parsedParams: Record<string, unknown> = {};
      skill.parameters?.forEach((param) => {
        const value = parameters[param.name];
        if (value !== undefined && value !== '') {
          switch (param.type) {
            case 'number':
              parsedParams[param.name] = parseFloat(value);
              break;
            case 'boolean':
              parsedParams[param.name] = value === 'true';
              break;
            default:
              parsedParams[param.name] = value;
          }
        }
      });

      executeSkill(skill.id, parsedParams);

      // Simulate execution tracking (in real app, this would come from WebSocket)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const execution: ExecutionHistory = {
        id: `exec-${Date.now()}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        success: true,
      };

      setExecutionHistory((prev) => [execution, ...prev].slice(0, 10));
    } catch (error) {
      const execution: ExecutionHistory = {
        id: `exec-${Date.now()}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      setExecutionHistory((prev) => [execution, ...prev].slice(0, 10));
    } finally {
      setIsExecuting(false);
    }
  }, [skill, executeSkill, parameters]);

  const handleParameterChange = (name: string, value: string): void => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const skillLogs = logs.filter(
    (log) => log.source === skillId || log.source === undefined
  );

  if (!skill) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <span className="text-4xl mb-2 block">🔍</span>
          <p>Skill not found</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              ← Back to Skills
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-4 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{skill.name}</h1>
            <span className="text-sm text-gray-500">v{skill.version}</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              skill.enabled
                ? 'bg-green-900/50 text-green-400'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {skill.enabled ? '● Active' : '○ Disabled'}
          </span>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-4">{skill.description}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {skill.author && <span>by {skill.author}</span>}
          {skill.tags && skill.tags.length > 0 && (
            <div className="flex gap-2">
              {skill.tags.map((tag) => (
                <span key={tag} className="text-blue-400">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Parameters & Execution */}
        <div className="w-full lg:w-96 p-4 border-r border-gray-700 overflow-y-auto">
          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={!skill.enabled || isExecuting}
            className={`w-full py-3 rounded-lg font-medium transition-all ${
              skill.enabled
                ? isExecuting
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isExecuting ? '⏳ Executing...' : '▶️ Execute Skill'}
          </button>

          {/* Parameters */}
          {skill.parameters && skill.parameters.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Parameters</h3>
              <div className="space-y-3">
                {skill.parameters.map((param) => (
                  <div key={param.name}>
                    <label className="block text-xs text-gray-400 mb-1">
                      {param.name}
                      {param.required && <span className="text-red-400 ml-1">*</span>}
                      {param.description && (
                        <span className="block text-gray-500 mt-0.5">{param.description}</span>
                      )}
                    </label>
                    {param.type === 'boolean' ? (
                      <select
                        value={parameters[param.name] || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Default</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={parameters[param.name] || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        placeholder={param.default?.toString() || 'Enter value'}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution History */}
          {executionHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Executions</h3>
              <div className="space-y-2">
                {executionHistory.map((exec) => (
                  <div
                    key={exec.id}
                    className={`p-2 rounded text-sm ${
                      exec.success
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{exec.success ? '✓ Success' : '✗ Failed'}</span>
                      <span className="text-gray-500">
                        {exec.duration ? `${exec.duration}ms` : '--'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </div>
                    {exec.error && (
                      <div className="text-xs text-red-400 mt-1">{exec.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Live Logs */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">📊 Live Logs</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              >
                {showLogs ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={clearLogs}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          {showLogs && (
            <div className="flex-1 min-h-0">
              <LogStream logs={skillLogs} filterLevel="all" className="h-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkillDetail;
