# ADR-001: Pre-commit Hooks with Husky and lint-staged

## Status

Accepted

## Date

2026-02-03

## Context

The BuhBot project uses ESLint for linting (both backend and frontend) and has a Prettier configuration for code formatting. However, code quality checks were only running in CI:

- Backend ESLint runs in GitHub Actions CI
- Frontend ESLint was not checked in CI
- Prettier formatting was not enforced anywhere
- Developers could commit code with linting errors or inconsistent formatting

This led to:

1. Delayed feedback - developers only discovered issues after pushing to CI
2. Inconsistent code style across the codebase
3. CI failures that could have been prevented locally
4. Wasted CI minutes on easily preventable issues

## Decision

Implement pre-commit hooks using **Husky** and **lint-staged** to run ESLint and Prettier on staged files before each commit.

### Configuration

- **Husky v9**: Manages Git hooks
- **lint-staged v16**: Runs linters only on staged files (fast)
- **Prettier v3**: Code formatting (config already existed at `.prettierrc.json`)

### Scope

| File Pattern                        | Tools                          |
| ----------------------------------- | ------------------------------ |
| `backend/src/**/*.{ts,tsx}`         | ESLint --fix, Prettier --write |
| `frontend/src/**/*.{ts,tsx,js,jsx}` | ESLint --fix, Prettier --write |
| `*.{json,md,yml,yaml}`              | Prettier --write               |

## Alternatives Considered

### Alternative 1: CI-Only Checks (Status Quo)

Keep all linting and formatting checks in CI pipeline only.

**Pros:**

- No additional local setup required
- Works regardless of developer's local environment
- No impact on commit speed
- Consistent environment (CI runner)

**Cons:**

- Slow feedback loop (push → wait for CI → fix → push again)
- Wastes CI minutes on preventable issues
- Developers may not notice formatting issues until PR review
- Higher cognitive load during code review (style issues mixed with logic)

### Alternative 2: Pre-commit Framework (Python-based)

Use [pre-commit](https://pre-commit.com/) - a Python-based framework for managing multi-language pre-commit hooks.

**Pros:**

- Language-agnostic, supports many hook types out of the box
- Large ecosystem of existing hooks
- Can run hooks in isolated environments
- Supports running hooks on all files, not just staged

**Cons:**

- Requires Python installation (additional dependency)
- Configuration in YAML (`.pre-commit-config.yaml`) separate from `package.json`
- Slower than lint-staged for Node.js projects (spawns separate processes)
- Less integrated with npm/pnpm ecosystem
- Team unfamiliar with Python tooling

### Alternative 3: Simple Git Hooks (No Framework)

Manually create `.git/hooks/pre-commit` script without any framework.

**Pros:**

- Zero dependencies
- Full control over hook behavior
- No framework to learn

**Cons:**

- Hooks not version-controlled by default (`.git/hooks/` is not tracked)
- Manual setup required for each developer
- No built-in support for running only on staged files
- Harder to maintain and update
- Platform compatibility issues (Windows vs Unix)

### Alternative 4: Lefthook

Use [Lefthook](https://github.com/evilmartians/lefthook) - a fast Git hooks manager written in Go.

**Pros:**

- Very fast (Go binary)
- Parallel hook execution
- No Node.js dependency for the hook runner itself
- Good for monorepos

**Cons:**

- Less popular than Husky in Node.js ecosystem
- Requires separate binary installation
- Configuration in YAML, not package.json
- Smaller community, fewer examples
- Team would need to learn new tool

## Rationale

**Husky + lint-staged** was chosen because:

1. **Native to Node.js ecosystem**: Both tools are npm packages, fitting naturally into the existing toolchain
2. **Fast execution**: lint-staged only processes staged files, keeping commits fast
3. **Auto-fix support**: ESLint and Prettier can automatically fix issues, reducing developer friction
4. **Zero-config for team**: After `pnpm install`, hooks are automatically set up via the `prepare` script
5. **Wide adoption**: Industry-standard combination with extensive documentation and community support
6. **Integrated configuration**: lint-staged config lives in `package.json` alongside other project settings

## Consequences

### Positive

- **Immediate feedback**: Developers catch issues before commit, not after CI
- **Consistent code style**: All committed code passes ESLint and Prettier
- **Reduced CI failures**: Fewer preventable failures in pipeline
- **Cleaner PRs**: No style-only commits or review comments about formatting
- **Auto-fixing**: Most issues fixed automatically, minimal developer intervention

### Negative

- **Commit speed**: Small overhead on each commit (typically 1-3 seconds for staged files)
- **Bypass possible**: Developers can skip hooks with `git commit --no-verify`
- **Initial learning curve**: Team needs to understand why commits might fail
- **Setup required**: New clones need `pnpm install` to activate hooks

### Mitigation

- CI still runs lint checks as a safety net for `--no-verify` bypasses
- Documentation updated to explain the workflow
- Hooks use `--fix` to auto-resolve most issues

## References

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/lint-staged/lint-staged)
- [Prettier Documentation](https://prettier.io/)
- [ESLint Documentation](https://eslint.org/)
