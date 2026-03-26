# Web Remote Control Specification

## AG-UI Protocol Integration

### Event Types
```typescript
interface AgentEvents {
  'skill:list': Skill[]
  'skill:run': { output: string, status: 'running' | 'success' | 'failed' }
  'system:status': { gateway: string, agents: number }
  'logs:stream': LogEntry[]
}

interface UserActions {
  'skill:install': { skillId: string }
  'skill:run': { skillId: string, params: object }
  'skill:configure': { skillId: string, config: object }
  'gateway:restart': void
}
```

## Features
- [ ] 实时连接状态显示
- [ ] Skills 列表和搜索
- [ ] 一键运行/停止
- [ ] 日志实时流
- [ ] 配置可视化编辑

## Security
- WebSocket 认证 (JWT)
- 命令白名单
- 操作审计日志
- 速率限制
