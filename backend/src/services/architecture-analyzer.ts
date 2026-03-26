/**
 * Architecture Analyzer Service
 * Performs deep analysis of codebase architecture
 * - Dependency graph analysis
 * - Code complexity calculation
 * - Module coupling assessment
 * - Technical debt identification
 */

import { readdir, readFile, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'

export interface ArchitectureAnalysis {
  id: string
  projectRoot: string
  timestamp: Date
  modules: ModuleInfo[]
  dependencyGraph: DependencyGraph
  complexityMetrics: ComplexityMetrics
  couplingAnalysis: CouplingAnalysis
  technicalDebt: TechnicalDebtAnalysis
  recommendations: ArchitectureRecommendation[]
}

export interface ModuleInfo {
  id: string
  path: string
  name: string
  type: ModuleType
  size: number
  lines: number
  imports: string[]
  exports: string[]
  dependencies: ModuleDependency[]
  dependents: string[]
  complexity: number
  maintainabilityIndex: number
}

export type ModuleType = 'component' | 'service' | 'route' | 'validator' | 'type' | 'util' | 'config' | 'other'

export interface ModuleDependency {
  moduleId: string
  path: string
  type: 'import' | 'require' | 'dynamic'
  isExternal: boolean
  isCircular: boolean
}

export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cycles: string[][]
  depth: number
  density: number
}

export interface GraphNode {
  id: string
  label: string
  type: ModuleType
  size: number
  complexity: number
  x?: number
  y?: number
}

export interface GraphEdge {
  source: string
  target: string
  type: 'import' | 'require' | 'dynamic'
  weight: number
}

export interface ComplexityMetrics {
  totalLines: number
  totalFiles: number
  totalModules: number
  averageModuleSize: number
  averageComplexity: number
  cyclomaticComplexity: number
  cognitiveComplexity: number
  halsteadMetrics: HalsteadMetrics
  maintainabilityIndex: number
  technicalDebtRatio: number
}

export interface HalsteadMetrics {
  vocabulary: number
  length: number
  volume: number
  difficulty: number
  effort: number
  time: number
  bugs: number
}

export interface CouplingAnalysis {
  afferentCoupling: number
  efferentCoupling: number
  instability: number
  abstractness: number
  distanceFromMainSequence: number
  moduleCoupling: ModuleCoupling[]
  hotspots: CouplingHotspot[]
}

export interface ModuleCoupling {
  moduleId: string
  incoming: number
  outgoing: number
  couplingScore: number
  stability: number
}

export interface CouplingHotspot {
  modules: string[]
  couplingType: 'cyclic' | 'high-fan-in' | 'high-fan-out' | 'god-module'
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

export interface TechnicalDebtAnalysis {
  totalDebt: number
  debtRatio: number
  debtByCategory: DebtCategory[]
  debtItems: TechnicalDebtItem[]
  estimatedFixTime: number
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface DebtCategory {
  category: string
  debt: number
  percentage: number
  count: number
}

export interface TechnicalDebtItem {
  id: string
  type: DebtType
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  description: string
  estimatedFixTime: number
  impact: number
  priority: number
}

export type DebtType =
  | 'code-duplication'
  | 'complex-code'
  | 'missing-tests'
  | 'outdated-dependencies'
  | 'security-vulnerability'
  | 'performance-issue'
  | 'documentation-gap'
  | 'architecture-smell'
  | 'code-smell'

export interface ArchitectureRecommendation {
  id: string
  title: string
  description: string
  category: RecommendationCategory
  priority: 'critical' | 'high' | 'medium' | 'low'
  impact: number
  effort: number
  affectedModules: string[]
  steps: string[]
}

export type RecommendationCategory = 'refactoring' | 'performance' | 'security' | 'organization' | 'documentation'

const FILE_TYPE_MAP: Record<string, ModuleType> = {
  '.component.tsx': 'component',
  '.component.ts': 'component',
  '.service.ts': 'service',
  '.handler.ts': 'service',
  '.route.ts': 'route',
  '.routes.ts': 'route',
  '.validator.ts': 'validator',
  '.types.ts': 'type',
  '.type.ts': 'type',
  '.util.ts': 'util',
  '.utils.ts': 'util',
  '.config.ts': 'config',
  '.conf.ts': 'config',
}

const EXCLUDED_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage', 'tmp', 'temp', '__tests__', '.next']

export class ArchitectureAnalyzer {
  private analyzedPaths: Set<string> = new Set()
  private moduleCache: Map<string, ModuleInfo> = new Map()

  /**
   * Analyze project architecture
   */
  async analyze(projectRoot: string): Promise<ArchitectureAnalysis> {
    this.analyzedPaths.clear()
    this.moduleCache.clear()

    const modules = await this.discoverModules(projectRoot)
    const dependencyGraph = await this.buildDependencyGraph(modules)
    const complexityMetrics = this.calculateComplexity(modules)
    const couplingAnalysis = this.analyzeCoupling(modules, dependencyGraph)
    const technicalDebt = this.identifyTechnicalDebt(modules, couplingAnalysis)
    const recommendations = this.generateRecommendations(modules, dependencyGraph, couplingAnalysis)

    return {
      id: randomUUID(),
      projectRoot,
      timestamp: new Date(),
      modules,
      dependencyGraph,
      complexityMetrics,
      couplingAnalysis,
      technicalDebt,
      recommendations,
    }
  }

  /**
   * Discover all modules in project
   */
  private async discoverModules(projectRoot: string, currentPath?: string): Promise<ModuleInfo[]> {
    const searchPath = currentPath || projectRoot
    const modules: ModuleInfo[] = []

    try {
      const entries = await readdir(searchPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(searchPath, entry.name)

        // Skip excluded directories
        if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
          continue
        }

        if (entry.isDirectory()) {
          const subModules = await this.discoverModules(projectRoot, fullPath)
          modules.push(...subModules)
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const moduleInfo = await this.analyzeModule(fullPath)
          if (moduleInfo) {
            modules.push(moduleInfo)
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${searchPath}:`, error)
    }

    return modules
  }

  /**
   * Analyze a single module file
   */
  private async analyzeModule(filePath: string): Promise<ModuleInfo | null> {
    const cached = this.moduleCache.get(filePath)
    if (cached) return cached

    try {
      const content = await readFile(filePath, 'utf-8')
      const stats = await stat(filePath)
      const lines = content.split('\n').length

      const imports = this.extractImports(content)
      const exports = this.extractExports(content)
      const moduleType = this.detectModuleType(filePath)
      const complexity = this.calculateModuleComplexity(content)
      const maintainabilityIndex = this.calculateMaintainabilityIndex(content, complexity)

      const name = this.extractModuleName(filePath)

      const moduleInfo: ModuleInfo = {
        id: randomUUID(),
        path: filePath,
        name,
        type: moduleType,
        size: stats.size,
        lines,
        imports,
        exports,
        dependencies: [],
        dependents: [],
        complexity,
        maintainabilityIndex,
      }

      this.moduleCache.set(filePath, moduleInfo)
      return moduleInfo
    } catch (error) {
      console.error(`Error analyzing module ${filePath}:`, error)
      return null
    }
  }

  /**
   * Extract imports from file content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = []

    // ES6 imports
    const es6ImportRegex = /import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null

    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    return [...new Set(imports)]
  }

  /**
   * Extract exports from file content
   */
  private extractExports(content: string): string[] {
    const exports: string[] = []

    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g
    let match: RegExpExecArray | null

    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1])
    }

    // Default export
    if (/export\s+default\s+/.test(content)) {
      exports.push('default')
    }

    // CommonJS exports
    const cjsExportRegex = /module\.exports\s*=\s*(\w+)/g
    while ((match = cjsExportRegex.exec(content)) !== null) {
      exports.push(match[1])
    }

    return [...new Set(exports)]
  }

  /**
   * Detect module type from file path
   */
  private detectModuleType(filePath: string): ModuleType {
    const lowerPath = filePath.toLowerCase()

    for (const [suffix, type] of Object.entries(FILE_TYPE_MAP)) {
      if (lowerPath.endsWith(suffix)) {
        return type
      }
    }

    // Folder-based detection
    if (lowerPath.includes('/components/')) return 'component'
    if (lowerPath.includes('/services/')) return 'service'
    if (lowerPath.includes('/routes/')) return 'route'
    if (lowerPath.includes('/validators/')) return 'validator'
    if (lowerPath.includes('/types/')) return 'type'
    if (lowerPath.includes('/utils/')) return 'util'
    if (lowerPath.includes('/config/')) return 'config'

    return 'other'
  }

  /**
   * Extract module name from file path
   */
  private extractModuleName(filePath: string): string {
    const baseName = filePath.split('/').pop() || filePath
    return baseName.replace(/\.(tsx?|jsx?)$/, '')
  }

  /**
   * Calculate module complexity
   */
  private calculateModuleComplexity(content: string): number {
    const lines = content.split('\n')
    let complexity = 0

    // Base complexity from lines
    complexity += lines.length * 0.1

    // Control flow complexity
    const controlFlowKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', 'finally']
    for (const keyword of controlFlowKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = content.match(regex)
      if (matches) {
        complexity += matches.length * 0.5
      }
    }

    // Function complexity
    const functionRegex = /\b(function|=>|async)\b/g
    const functions = content.match(functionRegex)
    if (functions) {
      complexity += functions.length * 0.3
    }

    // Nesting depth penalty
    const maxNesting = this.calculateMaxNesting(content)
    complexity += maxNesting * 2

    return Math.round(complexity * 10) / 10
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxNesting(content: string): number {
    let maxDepth = 0
    let currentDepth = 0

    for (const char of content) {
      if (char === '{') {
        currentDepth++
        maxDepth = Math.max(maxDepth, currentDepth)
      } else if (char === '}') {
        currentDepth--
      }
    }

    return maxDepth
  }

  /**
   * Calculate maintainability index (0-100)
   */
  private calculateMaintainabilityIndex(content: string, complexity: number): number {
    const lines = content.split('\n').length
    const commentLines = content.split('\n').filter(line =>
      line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')
    ).length

    const commentRatio = commentLines / Math.max(1, lines)

    const mi = 171 - 5.2 * Math.log(complexity + 1) - 0.23 * lines - 16.2 * Math.log(lines + 1) + 50 * Math.sin(Math.sqrt(commentRatio * Math.PI / 2))

    return Math.max(0, Math.min(100, Math.round(mi)))
  }

  /**
   * Build dependency graph from modules
   */
  private async buildDependencyGraph(modules: ModuleInfo[]): Promise<DependencyGraph> {
    const nodes: GraphNode[] = modules.map(m => ({
      id: m.path,
      label: m.name,
      type: m.type,
      size: m.size,
      complexity: m.complexity,
    }))

    const edges: GraphEdge[] = []
    const pathToModule = new Map(modules.map(m => [m.path, m]))

    // Build edges
    for (const module of modules) {
      for (const importPath of module.imports) {
        const resolvedPath = this.resolveImportPath(importPath, module.path)
        const isExternal = importPath.startsWith('.') === false && importPath.startsWith('/') === false

        if (!isExternal && resolvedPath) {
          const targetModule = pathToModule.get(resolvedPath)
          if (targetModule) {
            edges.push({
              source: module.path,
              target: resolvedPath,
              type: 'import',
              weight: 1,
            })

            module.dependencies.push({
              moduleId: targetModule.id,
              path: resolvedPath,
              type: 'import',
              isExternal: false,
              isCircular: false,
            })

            targetModule.dependents.push(module.id)
          }
        }
      }
    }

    // Detect cycles
    const cycles = this.detectCycles(modules)

    // Mark circular dependencies
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.length; i++) {
        const source = cycle[i]
        const target = cycle[(i + 1) % cycle.length]
        const module = pathToModule.get(source)
        if (module) {
          const dep = module.dependencies.find(d => d.path === target)
          if (dep) {
            dep.isCircular = true
          }
        }
      }
    }

    const depth = this.calculateGraphDepth(nodes, edges)
    const density = this.calculateGraphDensity(nodes, edges)

    return { nodes, edges, cycles, depth, density }
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(importPath: string, currentFile: string): string | null {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      const dir = dirname(currentFile)
      let resolved = join(dir, importPath)

      // Try with extensions
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const fullPath = resolved + ext
        if (this.moduleCache.has(fullPath)) {
          return fullPath
        }
      }
    }

    return null
  }

  /**
   * Detect cycles in dependency graph using DFS
   */
  private detectCycles(modules: ModuleInfo[]): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    const dfs = (moduleId: string): void => {
      if (recursionStack.has(moduleId)) {
        const cycleStart = path.indexOf(moduleId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), moduleId])
        }
        return
      }

      if (visited.has(moduleId)) {
        return
      }

      visited.add(moduleId)
      recursionStack.add(moduleId)
      path.push(moduleId)

      const module = modules.find(m => m.id === moduleId)
      if (module) {
        for (const dep of module.dependencies) {
          dfs(dep.moduleId)
        }
      }

      path.pop()
      recursionStack.delete(moduleId)
    }

    for (const module of modules) {
      if (!visited.has(module.id)) {
        dfs(module.id)
      }
    }

    return cycles
  }

  /**
   * Calculate graph depth (longest path)
   */
  private calculateGraphDepth(nodes: GraphNode[], edges: GraphEdge[]): number {
    const adjacencyList = new Map<string, string[]>()

    for (const node of nodes) {
      adjacencyList.set(node.id, [])
    }

    for (const edge of edges) {
      const neighbors = adjacencyList.get(edge.source) || []
      neighbors.push(edge.target)
      adjacencyList.set(edge.source, neighbors)
    }

    const memo = new Map<string, number>()

    const dfs = (nodeId: string): number => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId)!
      }

      const neighbors = adjacencyList.get(nodeId) || []
      let maxDepth = 0

      for (const neighbor of neighbors) {
        maxDepth = Math.max(maxDepth, 1 + dfs(neighbor))
      }

      memo.set(nodeId, maxDepth)
      return maxDepth
    }

    let maxGraphDepth = 0
    for (const node of nodes) {
      maxGraphDepth = Math.max(maxGraphDepth, dfs(node.id))
    }

    return maxGraphDepth
  }

  /**
   * Calculate graph density
   */
  private calculateGraphDensity(nodes: GraphNode[], edges: GraphEdge[]): number {
    const n = nodes.length
    if (n <= 1) return 0

    const maxEdges = n * (n - 1)
    return edges.length / maxEdges
  }

  /**
   * Analyze module coupling
   */
  private analyzeCoupling(modules: ModuleInfo[], graph: DependencyGraph): CouplingAnalysis {
    const moduleCoupling: ModuleCoupling[] = []
    const hotspots: CouplingHotspot[] = []

    for (const module of modules) {
      const incoming = module.dependents.length
      const outgoing = module.dependencies.filter(d => !d.isExternal).length

      const total = incoming + outgoing
      const instability = total > 0 ? outgoing / total : 0
      const couplingScore = (incoming + outgoing) / 2

      moduleCoupling.push({
        moduleId: module.id,
        incoming,
        outgoing,
        couplingScore: Math.round(couplingScore * 10) / 10,
        stability: Math.round((1 - instability) * 10) / 10,
      })

      // Detect high fan-in
      if (incoming > 10) {
        hotspots.push({
          modules: [module.path],
          couplingType: 'high-fan-in',
          severity: incoming > 20 ? 'critical' : 'high',
          description: `Module ${module.name} has ${incoming} dependents (high fan-in)`,
        })
      }

      // Detect high fan-out
      if (outgoing > 10) {
        hotspots.push({
          modules: [module.path],
          couplingType: 'high-fan-out',
          severity: outgoing > 20 ? 'critical' : 'high',
          description: `Module ${module.name} imports ${outgoing} other modules (high fan-out)`,
        })
      }

      // Detect god modules
      if (incoming > 15 && outgoing > 15) {
        hotspots.push({
          modules: [module.path],
          couplingType: 'god-module',
          severity: 'critical',
          description: `Module ${module.name} is a god module with ${incoming} dependents and ${outgoing} dependencies`,
        })
      }
    }

    // Add cyclic coupling hotspots
    for (const cycle of graph.cycles) {
      if (cycle.length >= 3) {
        hotspots.push({
          modules: cycle,
          couplingType: 'cyclic',
          severity: cycle.length > 4 ? 'high' : 'medium',
          description: `Circular dependency detected: ${cycle.map(m => m.split('/').pop()).join(' → ')}`,
        })
      }
    }

    const totalIncoming = moduleCoupling.reduce((sum, c) => sum + c.incoming, 0)
    const totalOutgoing = moduleCoupling.reduce((sum, c) => sum + c.outgoing, 0)
    const instability = totalIncoming + totalOutgoing > 0 ? totalOutgoing / (totalIncoming + totalOutgoing) : 0

    return {
      afferentCoupling: totalIncoming,
      efferentCoupling: totalOutgoing,
      instability: Math.round(instability * 10) / 10,
      abstractness: 0.5, // Simplified
      distanceFromMainSequence: 0,
      moduleCoupling,
      hotspots,
    }
  }

  /**
   * Calculate overall complexity metrics
   */
  private calculateComplexity(modules: ModuleInfo[]): ComplexityMetrics {
    const totalLines = modules.reduce((sum, m) => sum + m.lines, 0)
    const totalComplexity = modules.reduce((sum, m) => sum + m.complexity, 0)

    const averageModuleSize = modules.length > 0 ? totalLines / modules.length : 0
    const averageComplexity = modules.length > 0 ? totalComplexity / modules.length : 0

    const cyclomaticComplexity = Math.round(totalComplexity * 0.8)
    const cognitiveComplexity = Math.round(totalComplexity * 1.2)

    const halsteadMetrics = this.calculateHalsteadMetrics(modules)

    const maintainabilityIndex =
      modules.length > 0 ? Math.round(modules.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / modules.length) : 0

    const technicalDebtRatio = this.calculateTechnicalDebtRatio(modules)

    return {
      totalLines,
      totalFiles: modules.length,
      totalModules: modules.length,
      averageModuleSize: Math.round(averageModuleSize * 10) / 10,
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      cyclomaticComplexity,
      cognitiveComplexity,
      halsteadMetrics,
      maintainabilityIndex,
      technicalDebtRatio,
    }
  }

  /**
   * Calculate Halstead metrics (simplified)
   */
  private calculateHalsteadMetrics(modules: ModuleInfo[]): HalsteadMetrics {
    const operators = new Set<string>()
    const operands = new Set<string>()
    let totalOperators = 0
    let totalOperands = 0

    for (const module of modules) {
      // Simplified operator/operand counting
      const content = module.name // In real implementation, would parse full content

      // Common operators
      const operatorMatches = content.match(/[+\-*/=<>!&|?:]/g)
      if (operatorMatches) {
        operatorMatches.forEach(op => operators.add(op))
        totalOperators += operatorMatches.length
      }

      // Common operands (identifiers)
      const operandMatches = content.match(/\b\w+\b/g)
      if (operandMatches) {
        operandMatches.forEach(op => operands.add(op))
        totalOperands += operandMatches.length
      }
    }

    const vocabulary = operators.size + operands.size
    const length = totalOperators + totalOperands
    const volume = length > 0 ? Math.round(length * Math.log2(vocabulary) * 10) / 10 : 0
    const difficulty = vocabulary > 0 ? Math.round((totalOperators / vocabulary) * 10) / 10 : 0
    const effort = Math.round(volume * difficulty * 10) / 10
    const time = Math.round(effort / 18 / 10) / 10 // seconds
    const bugs = Math.round((effort / 3000) * 1000) / 1000

    return { vocabulary, length, volume, difficulty, effort, time, bugs }
  }

  /**
   * Calculate technical debt ratio
   */
  private calculateTechnicalDebtRatio(modules: ModuleInfo[]): number {
    const lowMIModules = modules.filter(m => m.maintainabilityIndex < 50).length
    const highComplexityModules = modules.filter(m => m.complexity > 50).length

    const ratio = (lowMIModules + highComplexityModules) / Math.max(1, modules.length)
    return Math.round(ratio * 10) / 10
  }

  /**
   * Identify technical debt items
   */
  private identifyTechnicalDebt(
    modules: ModuleInfo[],
    coupling: CouplingAnalysis
  ): TechnicalDebtAnalysis {
    const debtItems: TechnicalDebtItem[] = []

    // Complex code debt
    for (const module of modules) {
      if (module.complexity > 50) {
        debtItems.push({
          id: randomUUID(),
          type: 'complex-code',
          severity: module.complexity > 80 ? 'high' : 'medium',
          location: module.path,
          description: `Module ${module.name} has high complexity (${module.complexity})`,
          estimatedFixTime: Math.round((module.complexity - 50) * 0.5),
          impact: module.complexity / 100,
          priority: Math.round((module.complexity / 100) * 10),
        })
      }

      if (module.maintainabilityIndex < 50) {
        debtItems.push({
          id: randomUUID(),
          type: 'code-smell',
          severity: module.maintainabilityIndex < 30 ? 'high' : 'medium',
          location: module.path,
          description: `Module ${module.name} has low maintainability index (${module.maintainabilityIndex})`,
          estimatedFixTime: Math.round((100 - module.maintainabilityIndex) * 0.3),
          impact: (100 - module.maintainabilityIndex) / 100,
          priority: Math.round(((100 - module.maintainabilityIndex) / 100) * 10),
        })
      }
    }

    // Coupling debt
    for (const hotspot of coupling.hotspots) {
      debtItems.push({
        id: randomUUID(),
        type: 'architecture-smell',
        severity: hotspot.severity,
        location: hotspot.modules.join(', '),
        description: hotspot.description,
        estimatedFixTime: hotspot.severity === 'critical' ? 40 : hotspot.severity === 'high' ? 20 : 10,
        impact: hotspot.severity === 'critical' ? 0.9 : hotspot.severity === 'high' ? 0.7 : 0.5,
        priority: hotspot.severity === 'critical' ? 10 : hotspot.severity === 'high' ? 7 : 5,
      })
    }

    // Calculate totals
    const totalDebt = debtItems.reduce((sum, item) => sum + item.impact, 0)
    const debtRatio = Math.min(1, totalDebt / Math.max(1, modules.length))
    const estimatedFixTime = debtItems.reduce((sum, item) => sum + item.estimatedFixTime, 0)

    const debtByCategory = this.categorizeDebt(debtItems)
    const priority =
      debtRatio > 0.5 ? 'critical' : debtRatio > 0.3 ? 'high' : debtRatio > 0.1 ? 'medium' : 'low'

    return {
      totalDebt: Math.round(totalDebt * 100) / 100,
      debtRatio: Math.round(debtRatio * 10) / 10,
      debtByCategory,
      debtItems,
      estimatedFixTime,
      priority,
    }
  }

  /**
   * Categorize technical debt
   */
  private categorizeDebt(debtItems: TechnicalDebtItem[]): DebtCategory[] {
    const categories = new Map<string, { debt: number; count: number }>()

    for (const item of debtItems) {
      const existing = categories.get(item.type) || { debt: 0, count: 0 }
      existing.debt += item.impact
      existing.count++
      categories.set(item.type, existing)
    }

    const totalDebt = Array.from(categories.values()).reduce((sum, c) => sum + c.debt, 0)

    return Array.from(categories.entries()).map(([type, data]) => ({
      category: type,
      debt: Math.round(data.debt * 100) / 100,
      percentage: Math.round((data.debt / totalDebt) * 100),
      count: data.count,
    }))
  }

  /**
   * Generate architecture recommendations
   */
  private generateRecommendations(
    modules: ModuleInfo[],
    graph: DependencyGraph,
    coupling: CouplingAnalysis
  ): ArchitectureRecommendation[] {
    const recommendations: ArchitectureRecommendation[] = []

    // Circular dependency recommendations
    if (graph.cycles.length > 0) {
      const affectedModules = Array.from(new Set(graph.cycles.flat()))
      recommendations.push({
        id: randomUUID(),
        title: 'Eliminate Circular Dependencies',
        description: `Found ${graph.cycles.length} circular dependencies. These create tight coupling and make testing difficult.`,
        category: 'refactoring',
        priority: graph.cycles.length > 3 ? 'critical' : 'high',
        impact: 0.8,
        effort: graph.cycles.length * 8,
        affectedModules,
        steps: [
          'Identify the dependency cycles using the dependency graph',
          'Extract shared interfaces to break the cycle',
          'Use dependency injection to invert dependencies',
          'Consider event-based communication for decoupling',
        ],
      })
    }

    // God module recommendations
    const godModules = coupling.hotspots.filter(h => h.couplingType === 'god-module')
    for (const godModule of godModules) {
      recommendations.push({
        id: randomUUID(),
        title: `Refactor God Module: ${godModule.modules[0].split('/').pop()}`,
        description: 'This module has too many responsibilities and dependencies. Split it into smaller, focused modules.',
        category: 'refactoring',
        priority: 'critical',
        impact: 0.9,
        effort: 40,
        affectedModules: godModule.modules,
        steps: [
          'Identify cohesive groups of functionality',
          'Extract each group into a separate module',
          'Define clear interfaces between new modules',
          'Update all importers to use the new modules',
        ],
      })
    }

    // High complexity recommendations
    const complexModules = modules.filter(m => m.complexity > 50)
    if (complexModules.length > 0) {
      recommendations.push({
        id: randomUUID(),
        title: 'Reduce Code Complexity',
        description: `${complexModules.length} modules have high complexity. Consider breaking them into smaller functions.`,
        category: 'refactoring',
        priority: complexModules.some(m => m.complexity > 80) ? 'high' : 'medium',
        impact: 0.6,
        effort: complexModules.length * 10,
        affectedModules: complexModules.map(m => m.path),
        steps: [
          'Identify functions with high cyclomatic complexity',
          'Extract helper functions for complex logic',
          'Use early returns to reduce nesting',
          'Apply strategy pattern for complex conditionals',
        ],
      })
    }

    // Low maintainability recommendations
    const lowMIModules = modules.filter(m => m.maintainabilityIndex < 50)
    if (lowMIModules.length > 0) {
      recommendations.push({
        id: randomUUID(),
        title: 'Improve Code Maintainability',
        description: `${lowMIModules.length} modules have low maintainability. Add documentation and simplify code.`,
        category: 'documentation',
        priority: 'medium',
        impact: 0.5,
        effort: lowMIModules.length * 5,
        affectedModules: lowMIModules.map(m => m.path),
        steps: [
          'Add JSDoc comments to all exported functions',
          'Improve variable and function naming',
          'Add inline comments for complex logic',
          'Create README or module-level documentation',
        ],
      })
    }

    // High fan-in recommendations
    const highFanIn = coupling.hotspots.filter(h => h.couplingType === 'high-fan-in')
    for (const hotspot of highFanIn) {
      recommendations.push({
        id: randomUUID(),
        title: `Review High Fan-In Module: ${hotspot.modules[0].split('/').pop()}`,
        description: 'This module is heavily depended upon. Ensure it has a stable, well-designed API.',
        category: 'organization',
        priority: 'medium',
        impact: 0.4,
        effort: 15,
        affectedModules: hotspot.modules,
        steps: [
          'Review the module\'s public API for clarity',
          'Add comprehensive type definitions',
          'Ensure backward compatibility',
          'Add unit tests for all exported functions',
        ],
      })
    }

    return recommendations
  }
}

// Singleton instance
let architectureAnalyzer: ArchitectureAnalyzer | null = null

export function getArchitectureAnalyzer(): ArchitectureAnalyzer {
  if (!architectureAnalyzer) {
    architectureAnalyzer = new ArchitectureAnalyzer()
  }
  return architectureAnalyzer
}

export function initializeArchitectureAnalyzer(): ArchitectureAnalyzer {
  architectureAnalyzer = new ArchitectureAnalyzer()
  return architectureAnalyzer
}
