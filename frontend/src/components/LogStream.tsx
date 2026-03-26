/**
 * LogStream Component
 * Real-time log display with filtering and auto-scroll
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LogEntry } from '../types/ag-ui';

interface LogStreamProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  filterLevel?: 'debug' | 'info' | 'warn' | 'error' | 'all';
  className?: string;
  onClear?: () => void;
}

const levelColors: Record<string, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBgColors: Record<string, string> = {
  debug: 'bg-gray-800/50',
  info: 'bg-blue-900/30',
  warn: 'bg-yellow-900/30',
  error: 'bg-red-900/30',
};

const levelIcons: Record<string, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

export function LogStream({
  logs,
  autoScroll = true,
  filterLevel = 'all',
  className = '',
  onClear,
}: LogStreamProps): JSX.Element {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'debug' | 'info' | 'warn' | 'error' | 'all'>(filterLevel);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (autoScroll && isAtBottom) {
      scrollToBottom();
    }
  }, [logs, autoScroll, isAtBottom, scrollToBottom]);

  const handleScroll = useCallback((): void => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(isBottom);
    }
  }, []);

  const filteredLogs = logs.filter((log) => filter === 'all' || log.level === filter);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">📋 Logs</span>
          <span className="text-xs text-gray-500">({filteredLogs.length}/{logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          {onClear && (
            <button
              onClick={onClear}
              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-sm bg-gray-900 p-2"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 p-1.5 rounded mb-1 ${levelBgColors[log.level]}`}
            >
              <span className="text-gray-500 text-xs whitespace-nowrap">
                {formatTimestamp(log.timestamp)}
              </span>
              <span className="text-xs">{levelIcons[log.level]}</span>
              <span className={`text-xs font-medium uppercase ${levelColors[log.level]}`}>
                {log.level}
              </span>
              {log.source && (
                <span className="text-xs text-purple-400">[{log.source}]</span>
              )}
              <span className="text-gray-200 break-all flex-1">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded shadow-lg transition-colors"
        >
          ↓ Latest
        </button>
      )}
    </div>
  );
}

export default LogStream;
