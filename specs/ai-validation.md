# AI Validation Specification

## Validation Pipeline

### Phase 1: Static Analysis
- SKILL.md 格式验证
- 依赖安全性检查 (npm audit)
- 代码风格检查
- 敏感信息扫描 (API keys, secrets)

### Phase 2: AI Review (Qwen)
```bash
qwen -p "审查这个 skill 的安全性、代码质量、潜在问题"
```

### Phase 3: Dynamic Testing
- 自动运行测试用例
- 沙箱环境执行
- 性能基准测试

## Scoring System
```typescript
interface ValidationScore {
  security: number      // 0-1
  quality: number       // 0-1
  performance: number   // 0-1
  documentation: number // 0-1
  overall: number       // weighted average
}
```

## Auto-Fix Suggestions
AI 生成修复建议：
- 安全漏洞修复方案
- 代码优化建议
- 文档改进提示
