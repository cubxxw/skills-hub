/* eslint-disable react-refresh/only-export-components */
/**
 * AG-UI Provider
 * Provides AG-UI context and client to the application
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createAGUIClient, AGUIClient } from '../lib/ag-ui-client';
import type {
  Skill,
  SkillParameter,
  AgentState,
  LogEntry,
  ConnectionState,
} from '../types/ag-ui';

interface AGUIContextValue {
  client: AGUIClient | null;
  connectionState: ConnectionState;
  skills: Skill[];
  currentAgentState: AgentState;
  logs: LogEntry[];
  executeSkill: (skillId: string, parameters?: Record<string, unknown>) => void;
  cancelExecution: (executionId: string) => void;
  subscribe: (skillId: string) => void;
  unsubscribe: (skillId: string) => void;
  connect: () => void;
  disconnect: () => void;
  clearLogs: () => void;
}

const AGUIContext = createContext<AGUIContextValue | null>(null);

// Use relative URLs - Vite proxy will forward to backend
const WS_URL = `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/ws`;
const MAX_LOGS = 500;

interface AGUIProviderProps {
  children: ReactNode;
  wsUrl?: string;
}

export function AGUIProvider({ children, wsUrl = WS_URL }: AGUIProviderProps): JSX.Element {
  const [client, setClient] = useState<AGUIClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [currentAgentState, setCurrentAgentState] = useState<AgentState>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load skills from HTTP API immediately (using relative path - Vite proxy will forward)
    async function loadSkills() {
      try {
        const response = await fetch('/api/skills');
        const data = await response.json();
        if (data.skills) {
          // Transform backend format to frontend format
          // Handles both old format (status only) and new format (enabled + tags)
          const transformedSkills: Skill[] = data.skills.map((skill: {
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
            parameters?: SkillParameter[];
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
          setSkills(transformedSkills);
        }
      } catch (error) {
        console.error('Failed to load skills:', error);
      }
    }
    loadSkills();

    const aguiClient = createAGUIClient(
      {
        url: wsUrl,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        reconnectBackoff: 1.5,
      },
      {
        onConnectionChange: (status) => {
          setConnectionState((prev) => ({ ...prev, status }));
        },
        onStateChange: (state) => {
          setCurrentAgentState(state);
        },
        onLog: (entry) => {
          setLogs((prev) => {
            const newLogs = [...prev, entry];
            if (newLogs.length > MAX_LOGS) {
              return newLogs.slice(newLogs.length - MAX_LOGS);
            }
            return newLogs;
          });
        },
        onResult: (_skillId, _result) => {
          // Log results silently
        },
        onSkillsUpdate: (newSkills) => {
          setSkills(newSkills);
        },
        onError: (error, code) => {
          // Log errors to console for debugging
          console.error(`AG-UI Error:`, error, code);
          setLogs((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              timestamp: Date.now(),
              level: 'error',
              message: error,
              source: code,
            },
          ]);
        },
      }
    );

    setClient(aguiClient);
    aguiClient.connect();

    return () => {
      aguiClient.disconnect();
    };
  }, [wsUrl]);

  const connect = useCallback((): void => {
    client?.connect();
  }, [client]);

  const disconnect = useCallback((): void => {
    client?.disconnect();
  }, [client]);

  const executeSkill = useCallback(
    (skillId: string, parameters?: Record<string, unknown>): void => {
      client?.executeSkill(skillId, parameters);
    },
    [client]
  );

  const cancelExecution = useCallback(
    (executionId: string): void => {
      client?.cancelExecution(executionId);
    },
    [client]
  );

  const subscribe = useCallback(
    (skillId: string): void => {
      client?.subscribe(skillId);
    },
    [client]
  );

  const unsubscribe = useCallback(
    (skillId: string): void => {
      client?.unsubscribe(skillId);
    },
    [client]
  );

  const clearLogs = useCallback((): void => {
    setLogs([]);
  }, []);

  const value: AGUIContextValue = {
    client,
    connectionState,
    skills,
    currentAgentState,
    logs,
    executeSkill,
    cancelExecution,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    clearLogs,
  };

  return <AGUIContext.Provider value={value}>{children}</AGUIContext.Provider>;
}

export function useAGUI(): AGUIContextValue {
  const context = useContext(AGUIContext);
  if (!context) {
    throw new Error('useAGUI must be used within an AGUIProvider');
  }
  return context;
}

export { AGUIContext };
