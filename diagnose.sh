# 🔍 AG-UI Skill Platform 诊断报告

**生成时间:** $(date '+%Y-%m-%d %H:%M:%S')

## ✅ 服务状态检查

### 1. 前端服务 (Port 3000)
```bash
curl -s http://8.220.240.187:3000/ | grep title
```
**预期:** `<title>AG-UI Skill Platform</title>`

### 2. 后端 API (Port 4000)
```bash
curl -s http://8.220.240.187:4000/api/health
```
**预期:** `{"status":"ok",...}`

### 3. WebSocket (Port 4000/ws)
```bash
curl -s http://8.220.240.187:4000/api/skills | jq .total
```
**预期:** `3`

## 🔧 常见问题排查

### 问题 1: 浏览器缓存
**症状:** 页面显示旧配置
**解决:** 
- Chrome/Edge: Ctrl+Shift+R (硬刷新)
- Firefox: Ctrl+F5
- Safari: Cmd+Shift+R

### 问题 2: WebSocket 被防火墙阻止
**症状:** 一直显示 "reconnecting"
**检查:**
```bash
telnet 8.220.240.187 4000
```
**解决:** 确保服务器防火墙允许 4000 端口

### 问题 3: 混合内容错误
**症状:** 浏览器控制台显示 "Mixed Content" 错误
**原因:** HTTPS 页面尝试连接 WS (非加密)
**解决:** 使用 WSS (WebSocket Secure) 或禁用 HTTPS

### 问题 4: CORS 错误
**症状:** 控制台显示 CORS policy 错误
**检查后端日志:**
```bash
tail -f /root/.openclaw/workspace/projects/ag-ui-skill-platform/backend/logs/*.log
```

## 📝 手动测试 WebSocket

打开浏览器控制台 (F12)，粘贴以下代码：

```javascript
const ws = new WebSocket('ws://8.220.240.187:4000/ws');
ws.onopen = () => console.log('✅ WebSocket 连接成功!');
ws.onclose = () => console.log('❌ WebSocket 连接关闭');
ws.onerror = (e) => console.log('❌ WebSocket 错误:', e);
ws.onmessage = (e) => console.log('📨 收到消息:', e.data);
```

**预期输出:** `✅ WebSocket 连接成功!`

## 🎯 快速修复步骤

1. **清除浏览器缓存**
   ```
   Chrome: Ctrl+Shift+Delete → 选择"缓存的图像和文件" → 清除
   ```

2. **硬刷新页面**
   ```
   Ctrl+Shift+R (Windows/Linux)
   Cmd+Shift+R (Mac)
   ```

3. **检查浏览器控制台**
   ```
   F12 → Console 标签 → 查看错误信息
   ```

4. **重启服务**
   ```bash
   # 后端
   pkill -f tsx && cd /root/.openclaw/workspace/projects/ag-ui-skill-platform/backend && pnpm run dev &
   
   # 前端
   pkill -f vite && cd /root/.openclaw/workspace/projects/ag-ui-skill-platform/frontend && pnpm run dev &
   ```

## 📊 当前配置

- **前端地址:** http://8.220.240.187:3000
- **后端 API:** http://8.220.240.187:4000
- **WebSocket:** ws://8.220.240.187:4000/ws
- **技能数量:** 3

## 🐻 联系支持

如果以上步骤都无法解决问题，请提供：
1. 浏览器控制台截图 (F12 → Console)
2. 浏览器控制台网络截图 (F12 → Network)
3. 执行诊断脚本的输出

```bash
bash /root/.openclaw/workspace/projects/ag-ui-skill-platform/diagnose.sh
```
