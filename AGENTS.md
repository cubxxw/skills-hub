# AG-UI Skill Platform - Agent Configuration

## Build Commands
```bash
npm install
npm run dev
```

## Test Commands
```bash
npm test
npm run test:e2e
```

## Lint
```bash
npm run lint
```

## Typecheck
```bash
npm run typecheck
```

## Project Structure
```
ag-ui-skill-platform/
├── frontend/          # React + AG-UI
├── backend/           # Node.js API
├── skills/            # Skill templates
├── validators/        # AI validation scripts
└── docs/              # Documentation
```

## Backpressure Gates
- Tests must pass before commit
- Lint must pass
- AI validation score > 0.8
- Security audit clean
