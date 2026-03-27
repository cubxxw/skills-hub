#!/bin/bash
# AG-UI Skill Platform 自动检查脚本
# 用于定时检查服务状态

LOG_FILE="/root/.openclaw/workspace/projects/ag-ui-skill-platform/check.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "=== 检查时间：$TIMESTAMP ===" >> $LOG_FILE

# 检查前端
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://8.220.240.187:3000/)
echo "前端 (3000): $FRONTEND" >> $LOG_FILE

# 检查后端 API
API=$(curl -s -o /dev/null -w "%{http_code}" http://8.220.240.187:4000/api/health)
echo "后端 API (4000): $API" >> $LOG_FILE

# 检查 WebSocket
WS_PORT=$(netstat -tlnp 2>/dev/null | grep ":5000" | wc -l)
echo "WebSocket (5000): $([ $WS_PORT -gt 0 ] && echo 'LISTENING' || echo 'NOT LISTENING')" >> $LOG_FILE

# 检查技能 API
SKILLS=$(curl -s http://8.220.240.187:4000/api/skills 2>/dev/null | grep -o '"total":[0-9]*' | cut -d: -f2)
echo "技能数量：${SKILLS:-0}" >> $LOG_FILE

# 如果任何服务异常，尝试重启
if [ "$FRONTEND" != "200" ] || [ "$API" != "200" ] || [ "$WS_PORT" -eq 0 ]; then
    echo "⚠️ 发现异常，尝试重启服务..." >> $LOG_FILE
    
    # 重启后端
    pkill -f "tsx watch" 2>/dev/null
    sleep 2
    cd /root/.openclaw/workspace/projects/ag-ui-skill-platform/backend && nohup pnpm run dev > /tmp/backend_auto.log 2>&1 &
    
    # 重启前端
    pkill -f vite 2>/dev/null
    sleep 2
    cd /root/.openclaw/workspace/projects/ag-ui-skill-platform/frontend && nohup pnpm run dev > /tmp/frontend_auto.log 2>&1 &
    
    echo "✅ 服务已重启" >> $LOG_FILE
fi

echo "" >> $LOG_FILE
