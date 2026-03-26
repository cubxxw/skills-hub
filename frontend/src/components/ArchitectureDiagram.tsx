/**
 * ArchitectureDiagram Component
 * Interactive dependency graph visualization using D3.js-like force layout
 * Displays module relationships, circular dependencies, and coupling hotspots
 */

import React, { useRef, useState, useCallback } from 'react'

export interface DiagramNode {
  id: string
  label: string
  type: string
  size: number
  complexity: number
  x: number
  y: number
  color: string
  group: string
}

export interface DiagramEdge {
  source: string
  target: string
  type: string
  weight: number
  color: string
  isCircular: boolean
}

export interface VisualizationData {
  dependencyGraph: {
    nodes: DiagramNode[]
    edges: DiagramEdge[]
  }
  moduleMetrics: ModuleMetric[]
  debtChart: DebtChartData
  roadmapTimeline: RoadmapTimelineData
  radarChart: RadarChartData
}

export interface ModuleMetric {
  name: string
  path: string
  lines: number
  complexity: number
  maintainability: number
  dependencies: number
  dependents: number
}

export interface DebtChartData {
  categories: string[]
  values: number[]
  percentages: number[]
}

export interface RoadmapTimelineData {
  phases: {
    id: string
    name: string
    startWeek: number
    duration: number
    tasks: number
  }[]
}

export interface RadarChartData {
  categories: string[]
  scores: number[]
  maxScore: number
}

export interface ArchitectureDiagramProps {
  data: VisualizationData
  width?: number
  height?: number
  onNodeClick?: (node: DiagramNode) => void
  showLabels?: boolean
  showCircularDependencies?: boolean
  nodeSizeMultiplier?: number
}

const NODE_COLORS: Record<string, string> = {
  component: '#3b82f6',
  service: '#10b981',
  route: '#f59e0b',
  validator: '#ef4444',
  type: '#8b5cf6',
  util: '#6b7280',
  config: '#ec4899',
  other: '#9ca3af',
}

const TYPE_ICONS: Record<string, string> = {
  component: '🧩',
  service: '⚙️',
  route: '🛣️',
  validator: '✅',
  type: '📝',
  util: '🔧',
  config: '⚙️',
  other: '📄',
}

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  showLabels = true,
  showCircularDependencies = true,
  nodeSizeMultiplier = 1,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const { nodes, edges } = data.dependencyGraph

  // Handle node click
  const handleNodeClick = useCallback((node: DiagramNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
  }, [onNodeClick])

  // Handle pan start
  const handlePanStart = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).tagName === 'svg') {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  // Handle pan move
  const handlePanMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart])

  // Handle pan end
  const handlePanEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
  }, [])

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Calculate edge path
  const getEdgePath = useCallback((source: DiagramNode, target: DiagramNode) => {
    const dx = target.x - source.x
    const dy = target.y - source.y
    const dr = Math.sqrt(dx * dx + dy * dy) * 0.5

    return `M ${source.x} ${source.y} A ${dr} ${dr} 0 0 1 ${target.x} ${target.y}`
  }, [])

  // Filter circular edges if needed
  const displayEdges = showCircularDependencies
    ? edges
    : edges.filter(e => !e.isCircular)

  return (
    <div className="relative w-full h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev * 0.8))}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={resetView}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-3">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Module Types</h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TYPE_ICONS).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS[type] || NODE_COLORS.other }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {icon} {type}
              </span>
            </div>
          ))}
        </div>
        {showCircularDependencies && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Circular Dependency</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats overlay */}
      {selectedNode && (
        <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {TYPE_ICONS[selectedNode.type] || '📄'} {selectedNode.label}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className="text-gray-900 dark:text-white capitalize">{selectedNode.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Size:</span>
              <span className="text-gray-900 dark:text-white">{selectedNode.size.toFixed(1)}KB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Complexity:</span>
              <span className={`font-medium ${
                selectedNode.complexity > 50 ? 'text-red-500' :
                selectedNode.complexity > 30 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {selectedNode.complexity}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Diagram */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {displayEdges.map((edge, index) => {
            const sourceNode = nodes.find(n => n.id === edge.source)
            const targetNode = nodes.find(n => n.id === edge.target)

            if (!sourceNode || !targetNode) return null

            return (
              <path
                key={`edge-${index}`}
                d={getEdgePath(sourceNode, targetNode)}
                fill="none"
                stroke={edge.isCircular ? '#ef4444' : edge.color}
                strokeWidth={edge.isCircular ? 2 : edge.weight}
                opacity={hoveredNode && hoveredNode !== edge.source && hoveredNode !== edge.target ? 0.2 : 0.6}
                markerEnd={edge.isCircular ? '' : 'url(#arrowhead)'}
                className="transition-opacity duration-200"
              />
            )
          })}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#94a3b8"
              />
            </marker>
          </defs>

          {/* Nodes */}
          {nodes.map((node) => {
            const isHighlighted = !hoveredNode || hoveredNode === node.id
            const isSelected = selectedNode?.id === node.id
            const hasCircularDep = edges.some(e => e.isCircular && (e.source === node.id || e.target === node.id))

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-opacity duration-200"
                opacity={isHighlighted ? 1 : 0.3}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Outer glow for circular dependencies */}
                {hasCircularDep && showCircularDependencies && (
                  <circle
                    r={node.size * 2 + 4}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    className="animate-pulse"
                  />
                )}

                {/* Node circle */}
                <circle
                  r={node.size * nodeSizeMultiplier}
                  fill={node.color}
                  stroke={isSelected ? '#3b82f6' : 'white'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-200 shadow-lg"
                  style={{
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : undefined,
                  }}
                />

                {/* Node icon */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={node.size * 0.8}
                  fill="white"
                  fontWeight="bold"
                >
                  {TYPE_ICONS[node.type] || '📄'}
                </text>

                {/* Label */}
                {showLabels && isHighlighted && (
                  <text
                    x={node.size * 2 + 4}
                    y={node.size * 2 + 4}
                    fontSize="10"
                    fill="currentColor"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

export default ArchitectureDiagram
