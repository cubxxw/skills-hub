#!/bin/bash
# AG-UI Skill Platform - Ralph Loop Script

cd /root/.openclaw/workspace/projects/ag-ui-skill-platform

echo "🚀 Starting AG-UI Skill Platform Development Loop"
echo "================================================"

# Phase 1.1: Project Initialization
qwen -y "
根据 prd.json 和 specs/ 目录，实现 Phase 1.1 项目初始化。

任务清单：
1. 创建 pnpm-workspace.yaml
2. 创建根 package.json (name: ag-ui-skill-platform)
3. 创建 frontend/ 目录 - React + Vite + TypeScript
4. 创建 backend/ 目录 - Node.js + Express + TypeScript
5. 配置 ESLint + Prettier
6. 创建 .gitignore
7. 创建 README.md

要求：
- 使用 pnpm workspace
- TypeScript 严格模式
- 统一的 ESLint 规则
- 包含基础 Hello World 组件

开始执行！
"

echo "✅ Phase 1.1 Complete!"
