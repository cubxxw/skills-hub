/**
 * AG-UI WebSocket Client
 * Manages WebSocket connection to the backend AG-UI server
 */

import type {
  ServerMessage,
  ClientCommand,
  ConnectionState,
  AGUIClientConfig,
  AGUIClientCallbacks,
  Skill,
  AgentState,
  LogEntry,
  ExecutionResult,
} from '../types/ag-ui';

const DEFAULT_CONFIG: Partial<AGUIClientConfig> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  reconnectBackoff: 1.5,
};

export class AGUIClient {
  private ws: WebSocket | null = null;
  private config: Required<AGUIClientConfig>;
  private state: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0,
  };
  private callbacks: AGUIClientCallbacks = {};
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: ClientCommand[] = [];
  private skills: Skill[] = [];

  constructor(config: AGUIClientConfig, callbacks?: AGUIClientCallbacks) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<AGUIClientConfig>;
    this.callbacks = callbacks || {};
  }

  /**
   * Connect to the AG-UI server
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.updateState({ status: 'connecting' });

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = (): void => {
        this.updateState({ status: 'connected', reconnectAttempts: 0 });
        this.flushMessageQueue();
        this.callbacks.onConnectionChange?.('connected');
      };

      this.ws.onclose = (event): void => {
        this.handleDisconnect(event.code, event.reason);
      };

      this.ws.onerror = (error): void => {
        console.error('WebSocket error:', error);
        this.updateState({ status: 'error', lastError: 'WebSocket connection error' });
        this.callbacks.onError?.('WebSocket connection error');
      };

      this.ws.onmessage = (event): void => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      this.updateState({ status: 'error', lastError: errorMessage });
      this.callbacks.onError?.(errorMessage);
    }
  }

  /**
   * Disconnect from the AG-UI server
   */
  public disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.updateState({ status: 'disconnected' });
    this.callbacks.onConnectionChange?.('disconnected');
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Get current skills list
   */
  public getSkills(): Skill[] {
    return [...this.skills];
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state.status === 'connected';
  }

  /**
   * Execute a skill
   */
  public executeSkill(skillId: string, parameters?: Record<string, unknown>): void {
    this.sendCommand({
      type: 'execute',
      skillId,
      parameters,
    });
  }

  /**
   * Cancel an execution
   */
  public cancelExecution(executionId: string): void {
    this.sendCommand({
      type: 'cancel',
      executionId,
    });
  }

  /**
   * Subscribe to skill logs
   */
  public subscribe(skillId: string): void {
    this.sendCommand({
      type: 'subscribe',
      skillId,
    });
  }

  /**
   * Unsubscribe from skill logs
   */
  public unsubscribe(skillId: string): void {
    this.sendCommand({
      type: 'unsubscribe',
      skillId,
    });
  }

  /**
   * Update callbacks
   */
  public setCallbacks(callbacks: AGUIClientCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Send a command to the server
   */
  private sendCommand(command: ClientCommand): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(command);
      return;
    }

    try {
      this.ws.send(JSON.stringify(command));
    } catch (error) {
      console.error('Failed to send command:', error);
      this.messageQueue.push(command);
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const command = this.messageQueue.shift();
      if (command && this.ws) {
        try {
          this.ws.send(JSON.stringify(command));
        } catch (error) {
          console.error('Failed to send queued command:', error);
          this.messageQueue.unshift(command);
          break;
        }
      }
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case 'state':
          this.handleStateMessage(message);
          break;
        case 'log':
          this.handleLogMessage(message);
          break;
        case 'result':
          this.handleResultMessage(message);
          break;
        case 'skills':
          this.handleSkillsMessage(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        case 'connection':
          this.handleConnectionMessage(message);
          break;
        default:
          console.warn('Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleStateMessage(message: { type: 'state'; state: AgentState }): void {
    this.callbacks.onStateChange?.(message.state);
  }

  private handleLogMessage(message: { type: 'log'; entry: LogEntry }): void {
    this.callbacks.onLog?.(message.entry);
  }

  private handleResultMessage(message: { type: 'result'; skillId: string; result: ExecutionResult }): void {
    this.callbacks.onResult?.(message.skillId, message.result);
  }

  private handleSkillsMessage(message: { type: 'skills'; skills: Skill[] }): void {
    this.skills = message.skills;
    this.callbacks.onSkillsUpdate?.(message.skills);
  }

  private handleErrorMessage(message: { type: 'error'; message: string; code?: string }): void {
    this.callbacks.onError?.(message.message, message.code);
  }

  private handleConnectionMessage(message: { type: 'connection'; status: ConnectionState['status'] }): void {
    this.updateState({ status: message.status });
    this.callbacks.onConnectionChange?.(message.status);
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(code: number, reason: string): void {
    this.ws = null;
    this.updateState({ status: 'disconnected', lastError: reason });

    if (code !== 1000 && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.callbacks.onConnectionChange?.('disconnected');
    }
  }

  /**
   * Schedule reconnection with backoff
   */
  private scheduleReconnect(): void {
    this.updateState({ status: 'reconnecting' });
    this.callbacks.onConnectionChange?.('reconnecting');

    const delay = this.config.reconnectDelay * Math.pow(this.config.reconnectBackoff, this.state.reconnectAttempts);

    this.reconnectTimeoutId = setTimeout(() => {
      this.updateState({ reconnectAttempts: this.state.reconnectAttempts + 1 });
      this.connect();
    }, delay);
  }

  /**
   * Update internal state
   */
  private updateState(partial: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...partial };
  }
}

/**
 * Create a new AG-UI client instance
 */
export function createAGUIClient(config: AGUIClientConfig, callbacks?: AGUIClientCallbacks): AGUIClient {
  return new AGUIClient(config, callbacks);
}
