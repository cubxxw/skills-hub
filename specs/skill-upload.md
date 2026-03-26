# Skill Upload Specification

## User Stories
1. 用户上传 ZIP 文件 → 自动解析 SKILL.md 和目录结构
2. 从 GitHub 导入 skill 仓库
3. 在线编辑器创建新 skill

## Acceptance Criteria
- [ ] 支持 ZIP 上传 (max 50MB)
- [ ] 自动验证 SKILL.md 格式
- [ ] 检测依赖冲突
- [ ] 生成预览界面
- [ ] 一键安装到本地 OpenClaw

## API Endpoints
```
POST /api/skills/upload      # 上传 ZIP
POST /api/skills/import      # GitHub 导入
GET  /api/skills/preview/:id # 预览
POST /api/skills/install/:id # 安装
```

## Validation Rules
1. SKILL.md 必须有 name, description
2. 禁止危险命令 (rm -rf, sudo 等)
3. 依赖版本必须明确指定
4. 环境变量必须声明
