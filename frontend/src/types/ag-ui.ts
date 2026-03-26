/**
 * AG-UI Protocol Types
 * Based on the AG-UI specification for agent-user interface communication
 */

/** Skill definition */
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  parameters?: SkillParameter[];
  enabled: boolean;
}

/** Skill parameter definition */
export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: unknown;
}

/** Agent state */
export type AgentState = 'idle' | 'thinking' | 'executing' | 'completed' | 'error';

/** Log entry from agent execution */
export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  data?: unknown;
}

/** Agent execution state */
export interface AgentStateMessage {
  type: 'state';
  state: AgentState;
  skillId?: string;
  timestamp: number;
}

/** Log message from agent */
export interface LogMessage {
  type: 'log';
  entry: LogEntry;
}

/** Skill execution result */
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

/** Execution result message */
export interface ExecutionResultMessage {
  type: 'result';
  skillId: string;
  result: ExecutionResult;
  timestamp: number;
}

/** Skills list update */
export interface SkillsListMessage {
  type: 'skills';
  skills: Skill[];
  timestamp: number;
}

/** Error message */
export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
  timestamp: number;
}

/** Connection status message */
export interface ConnectionStatusMessage {
  type: 'connection';
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  timestamp: number;
}

/** Union type for all server messages */
export type ServerMessage =
  | AgentStateMessage
  | LogMessage
  | ExecutionResultMessage
  | SkillsListMessage
  | ErrorMessage
  | ConnectionStatusMessage;

/** Execute skill command */
export interface ExecuteSkillCommand {
  type: 'execute';
  skillId: string;
  parameters?: Record<string, unknown>;
}

/** Cancel execution command */
export interface CancelCommand {
  type: 'cancel';
  executionId: string;
}

/** Subscribe to skill logs */
export interface SubscribeCommand {
  type: 'subscribe';
  skillId: string;
}

/** Unsubscribe from skill logs */
export interface UnsubscribeCommand {
  type: 'unsubscribe';
  skillId: string;
}

/** Union type for all client commands */
export type ClientCommand = ExecuteSkillCommand | CancelCommand | SubscribeCommand | UnsubscribeCommand;

/** WebSocket connection state */
export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastError?: string;
  reconnectAttempts: number;
  lastMessage?: ServerMessage;
}

/** AG-UI Client configuration */
export interface AGUIClientConfig {
  url: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectBackoff?: number;
}

/** Event callbacks */
export interface AGUIClientCallbacks {
  onStateChange?: (state: AgentState) => void;
  onLog?: (entry: LogEntry) => void;
  onResult?: (skillId: string, result: ExecutionResult) => void;
  onSkillsUpdate?: (skills: Skill[]) => void;
  onError?: (error: string, code?: string) => void;
  onConnectionChange?: (status: ConnectionState['status']) => void;
}
