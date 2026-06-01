```markdown
# skills-hub Development Patterns

> Auto-generated skill from repository analysis

## Overview
The `skills-hub` repository is a TypeScript codebase focused on modular skill development without reliance on a specific framework. This skill teaches you the core development patterns used in the repository, including file organization, code style, commit conventions, and testing approaches. By following these patterns, you will write consistent, maintainable TypeScript code that fits seamlessly into the `skills-hub` project.

## Coding Conventions

### File Naming
- Use **camelCase** for all file and directory names.
  - **Example:** `userProfile.ts`, `dataFetcher.ts`

### Import Style
- Use **relative imports** for referencing modules within the project.
  - **Example:**
    ```typescript
    import { fetchData } from './dataFetcher';
    ```

### Export Style
- Use **named exports** for all modules.
  - **Example:**
    ```typescript
    // dataFetcher.ts
    export function fetchData() { /* ... */ }
    ```

### Commit Messages
- Follow the **Conventional Commits** specification.
- Use prefixes such as `build` to indicate the type of change.
- Keep commit messages concise (average length ~48 characters).
  - **Example:**  
    ```
    build: update dependencies to latest versions
    ```

## Workflows

### Build Workflow
**Trigger:** When you need to compile or bundle the TypeScript code.
**Command:** `/build`

1. Ensure all TypeScript files are saved.
2. Run the build process (typically via a script such as `npm run build`).
3. Check the output directory for compiled files.
4. Commit changes with a `build:` prefix if dependencies or build output are updated.

### Add New Module
**Trigger:** When creating a new feature or utility.
**Command:** `/add-module`

1. Create a new `.ts` file using camelCase naming.
2. Implement the module using named exports.
3. Import the module where needed using a relative path.
4. Write corresponding tests in a `.test.ts` file.
5. Commit with a descriptive conventional commit message.

## Testing Patterns

- Test files are named using the pattern `*.test.*` (e.g., `userProfile.test.ts`).
- The specific testing framework is not enforced, but tests should be colocated with or near the code they test.
- Example test file:
  ```typescript
  // userProfile.test.ts
  import { getUserProfile } from './userProfile';

  describe('getUserProfile', () => {
    it('returns correct user data', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /build       | Compile or bundle the TypeScript code        |
| /add-module  | Scaffold and implement a new module          |
```
