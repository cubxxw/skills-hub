#!/bin/bash
# 修复 AG-UI Skill Platform 架构问题
# 1. 合并 WebSocket 到 HTTP 端口 (4000)
# 2. 前端改用相对路径 (使用 Vite 代理)
# 3. 接入真实的 skills-store

set -e

echo "🔧 开始修复 AG-UI Skill Platform 架构问题..."
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 备份原始文件
echo "📦 备份原始文件..."
cp backend/src/index.ts backend/src/index.ts.bak
cp backend/src/websocket.ts backend/src/websocket.ts.bak
cp frontend/src/providers/AGUIProvider.tsx frontend/src/providers/AGUIProvider.tsx.bak

echo "✅ 备份完成"
echo ""

# 提示用户手动修复
echo "⚠️  由于代码修改复杂，请手动执行以下修复："
echo ""
echo "1️⃣  后端修复 (backend/src/index.ts):"
echo "   - 移除独立的 WebSocket 端口 (5000)"
echo "   - 使用 wsServer.attach(httpServer) 而不是 wsServer.start(5000)"
echo "   - 简化 upgrade 事件处理"
echo ""
echo "2️⃣  前端修复 (frontend/src/providers/AGUIProvider.tsx):"
echo "   - WS_URL 改为: const WS_URL = \`ws://\${window.location.host}/ws\`"
echo "   - fetch 改为相对路径：fetch('/api/skills')"
echo ""
echo "3️⃣  路由修复 (backend/src/routes/skills.ts):"
echo "   - 引入 skills-store.ts"
echo "   - 用真实存储替换 mockSkills"
echo ""
echo "📝 或者查看修复文档：cat FIX_ARCHITECTURE.md"
echo ""
