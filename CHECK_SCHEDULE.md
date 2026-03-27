# 📋 AG-UI Skill Platform 检查记录

## 计划任务

**检查时间:** 每天凌晨 4:00 自动检查  
**脚本位置:** `/root/.openclaw/workspace/projects/ag-ui-skill-platform/auto-check.sh`  
**日志位置:** `/tmp/ag-ui-check.log`

## 检查项目

1. ✅ 前端服务 (Port 3000)
2. ✅ 后端 API (Port 4000)
3. ✅ WebSocket (Port 5000)
4. ✅ 技能数据加载

## 自动修复

如果检测到服务异常，脚本会自动：
- 重启后端服务
- 重启前端服务
- 记录日志

## 手动检查命令

```bash
# 查看检查日志
tail -20 /tmp/ag-ui-check.log

# 手动执行检查
bash /root/.openclaw/workspace/projects/ag-ui-skill-platform/auto-check.sh

# 查看服务状态
ps aux | grep -E "(vite|tsx)" | grep -v grep
netstat -tlnp | grep -E ":(3000|4000|5000)"
```

## 下次检查时间

**2026-03-27 04:00** (凌晨 4 点)  
**额外检查:** 3 小时后 (约 04:36)

---

**创建时间:** 2026-03-27 01:36  
**状态:** ✅ 已激活
