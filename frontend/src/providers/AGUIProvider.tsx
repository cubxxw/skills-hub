/* eslint-disable react-refresh/only-export-components */
/**
 * AG-UI Provider
 * Provides AG-UI context and client to the application
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createAGUIClient, AGUIClient } from '../lib/ag-ui-client';
import type {
  Skill,
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

const WS_URL = 'ws://localhost:4000/ag-ui';
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

  useEffect((): (() => void) => {
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
