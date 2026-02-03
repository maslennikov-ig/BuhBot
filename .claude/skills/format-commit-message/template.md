# Commit Message Template

See [docs/COMMIT_CONVENTIONS.md](../../../docs/COMMIT_CONVENTIONS.md) for full rules and Release Please–specific requirements.

## Format

```
{type}({scope}): {description}

{body}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Valid Types

- **feat**: New feature (changelog: Added)
- **fix**: Bug fix (changelog: Fixed)
- **chore**: Maintenance, deps, config (do not use scope `release` for normal commits)
- **docs**: Documentation only
- **refactor**: Code change, no behavior change
- **test**: Adding or updating tests
- **style**: Formatting, whitespace
- **perf**: Performance improvement
- **ci**: CI/config

## Guidelines (Release Please–friendly)

1. **Type** (required): Lowercase
2. **Scope** (optional): Lowercase, no spaces. Never use `chore(release):` for non-release commits.
3. **Subject** (required): Imperative mood, lowercase, no period, ≤ 72 chars
4. **Body** (optional): Wrap at 72 characters
5. **Footer** (auto-added): Claude Code attribution

## Breaking Changes

Use "BREAKING CHANGE: " in body/footer, or `type!` / `type(scope)!:` in subject.

## Examples

### Simple

```
feat: add user authentication
```

### With Scope

```
fix(api): resolve CORS configuration error
```

### With Body

```
refactor(database): optimize query performance

Replaced N+1 queries with batch loading strategy.
Reduced average query time by 60%.
```

### Breaking Change

```
feat(api): migrate to REST API v2

BREAKING CHANGE: Authentication tokens from v1 are no longer valid.
All clients must obtain new tokens using the v2 /auth endpoint.
```
