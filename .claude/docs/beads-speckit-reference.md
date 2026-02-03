# Beads + Spec-kit Integration — Full Reference

> **Purpose**: Complete reference for Claude to quickly understand the BuhBot task management system.
> **Last Updated**: 2026-01-14
> **Version**: Beads v0.47.1, Spec-kit v0.0.22

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Beads System](#beads-system)
3. [Spec-kit System](#spec-kit-system)
4. [Integration Flow](#integration-flow)
5. [Formulas (Molecule Templates)](#formulas-molecule-templates)
6. [File Structure](#file-structure)
7. [Sources & References](#sources--references)

---

## Critical: Session Close Protocol

**"Land the Plane" Rule**: NEVER say "done" without completing ALL steps:

```bash
[ ] 1. git status              # Check what changed
[ ] 2. git add <files>         # Stage code changes
[ ] 3. bd sync                 # Commit beads changes
[ ] 4. git commit -m "... (buh-xxx)"  # Commit with issue ID
[ ] 5. bd sync                 # Commit any new beads changes
[ ] 6. git push                # Push to remote
```

**Work is NOT done until pushed.** Unpushed work breaks multi-agent coordination.

**Commit message format**: Include issue ID in parentheses: `"Fix auth bug (buh-abc)"`

---

## Architecture Overview

### Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                    TASK MANAGEMENT                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Big Features (>1 day)        All Other Work               │
│   ┌─────────────────┐          ┌─────────────────┐          │
│   │    Spec-kit     │          │     Beads       │          │
│   │  (Planning)     │────────▶ │  (Execution)    │          │
│   └─────────────────┘          └─────────────────┘          │
│         10%                          90%                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│   TodoWrite = In-session UI display (ephemeral)             │
│   Beads = Persistent cross-session tracking (git-backed)    │
└─────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Scenario                          | Tool             | Rationale                           |
| --------------------------------- | ---------------- | ----------------------------------- |
| Feature requiring design/planning | Spec-kit → Beads | Need structured planning artifacts  |
| Feature with clear requirements   | Beads only       | Direct execution                    |
| Bug fix                           | Beads            | Track origin with `discovered-from` |
| Tech debt                         | Beads            | Type `chore`                        |
| Research/spike                    | Beads wisp       | Can be burned or squashed           |
| Hotfix (emergency)                | Beads wisp       | Fast track, document later          |
| Release                           | Beads wisp       | `/push` handles most of it          |

---

## Beads System

### What is Beads?

Beads is a git-backed graph issue tracker designed for AI agents, created by Steve Yegge.

**Key characteristics**:

- Issues stored in `.beads/issues.jsonl` (git-tracked)
- SQLite cache in `.beads/beads.db` (gitignored)
- Daemon process for performance
- Graph-based dependencies
- Molecule system for workflows

### Installation

```bash
# Check version
bd version  # Expected: v0.47.1+

# Check status
bd info
bd doctor
```

### Context & Priming

```bash
bd prime                    # Output workflow context (~1-2k tokens)
bd prime --full             # Force full CLI output
bd prime --mcp              # Minimal output for MCP mode
bd prime --export           # Export default content for customization
```

**Auto-invoked** by SessionStart and PreCompact hooks in Claude Code.

### Core Commands

#### Task Lifecycle

```bash
# View
bd ready                              # Tasks with no blockers
bd blocked                            # Tasks blocked by dependencies
bd list                               # All open tasks
bd list --all                         # Include closed
bd list -t bug -p 2                   # Filter by type/priority
bd show <id>                          # Task details
bd show <id> --tree                   # With hierarchy

# Create
bd create "Title" -t type -p priority -d "description"
bd create "Title" -t bug --deps discovered-from:<id>
bd create "Title" -t feature --deps parent:<epic-id>

# Update
bd update <id> --status in_progress
bd update <id> --status blocked
bd update <id> --priority 1
bd update <id> --add-label security
bd update <id> --add-dep blocks:<other-id>

# Close (single or batch)
bd close <id> --reason "Description of completion"
bd close <id1> <id2> <id3> --reason "Batch complete"  # Multiple at once
bd close <id> --reason "Not needed" --wontfix
```

#### Types (`-t`)

| Type      | Use Case                        |
| --------- | ------------------------------- |
| `feature` | New functionality               |
| `bug`     | Bug fixes                       |
| `chore`   | Tech debt, refactoring, configs |
| `docs`    | Documentation                   |
| `test`    | Test improvements               |
| `epic`    | Group of related tasks          |

#### Priorities (`-p`)

| Priority | Meaning                      |
| -------- | ---------------------------- |
| P0       | Critical - blocks everything |
| P1       | Critical - blocks release    |
| P2       | High - fix soon              |
| P3       | Medium - normal (default)    |
| P4       | Low - backlog                |

#### Dependencies

```bash
# At creation
bd create "Task" --deps blocked-by:<id>

# Add to existing
bd dep add <issue> <depends-on>    # issue depends on depends-on

# View blocked
bd blocked                          # All blocked issues
```

| Type                   | Meaning                             |
| ---------------------- | ----------------------------------- |
| `blocks:<id>`          | This task blocks another            |
| `blocked-by:<id>`      | This task is blocked by another     |
| `discovered-from:<id>` | Found while working on another task |
| `parent:<id>`          | Child of an epic                    |
| `related:<id>`         | Informational relationship          |

### Molecules (Workflows)

#### Concepts

- **Formula**: Template definition (TOML file in `.beads/formulas/`)
- **Proto**: Compiled template (internal)
- **Wisp**: Ephemeral instance (vapor phase) - can be burned or squashed
- **Mol**: Persistent instance (liquid phase)

#### Commands

```bash
# List templates
bd formula list
bd formula show <name>

# Start workflow
bd mol wisp <formula> --vars "key=value"    # Ephemeral
bd mol pour <formula> --vars "key=value"    # Persistent

# Navigate
bd mol current                               # Current position
bd mol progress <id>                         # Progress summary

# Complete wisp
bd mol squash <id>                           # Compress to summary (keep)
bd mol burn <id>                             # Discard completely
```

### Synchronization

```bash
bd sync                    # Bidirectional sync: DB ↔ JSONL ↔ Git
bd sync --force            # Force reload from JSONL
```

**Auto-sync triggers**:

- `/push` command runs `bd sync` automatically
- Git hooks sync on commit

### Daemon Management

```bash
bd daemon status
bd daemon start
bd daemon restart
bd daemon stop

# Logs
cat .beads/daemon.log

# Fix stuck daemon
rm .beads/daemon.lock
bd daemon start
```

### BuhBot Conventions

- **Issue prefix**: `buh` (e.g., `buh-a3f2dd`)
- **Nested IDs**: Subtasks use dot notation: `buh-a3f8.1`, `buh-a3f8.1.1`
- **Formulas location**: `.beads/formulas/`

---

## Spec-kit System

### What is Spec-kit?

Spec-kit is a specification-driven development toolkit that generates structured planning artifacts.

**Key characteristics**:

- Constitution-based principles
- Template-driven artifact generation
- Phases: specify → clarify → plan → tasks → implement
- Integration with issue trackers (GitHub, Beads)

### Commands

| Command                  | Purpose                  | Output            |
| ------------------------ | ------------------------ | ----------------- |
| `/speckit.specify`       | Create requirements      | `spec.md`         |
| `/speckit.clarify`       | Q&A for requirements     | Updates `spec.md` |
| `/speckit.plan`          | Create technical design  | `plan.md`         |
| `/speckit.tasks`         | Generate task breakdown  | `tasks.md`        |
| `/speckit.implement`     | Execute tasks            | Code changes      |
| `/speckit.analyze`       | Check consistency        | Report            |
| `/speckit.checklist`     | Quality gates            | Checklist         |
| `/speckit.tobeads`       | Convert to Beads issues  | Beads issues      |
| `/speckit.taskstoissues` | Convert to GitHub issues | GitHub issues     |

### Artifact Locations

```
docs/speckit/
├── spec.md              # Requirements (default location)
├── plan.md              # Technical design
├── tasks.md             # Task breakdown
└── features/
    └── <feature-name>/
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

### Big Feature Workflow

```bash
# 1. Create feature directory (optional)
mkdir -p docs/speckit/features/<feature-name>

# 2. Generate artifacts
/speckit.specify    # Creates spec.md
/speckit.clarify    # Q&A, updates spec.md
/speckit.plan       # Creates plan.md
/speckit.tasks      # Creates tasks.md

# 3. Import to Beads
/speckit.tobeads    # Creates epic + child issues

# 4. Execute via Beads
bd ready
bd update <id> --status in_progress
# ... implement ...
bd close <id> --reason "Done"
```

---

## Integration Flow

### Spec-kit → Beads Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  spec.md    │───▶│  plan.md    │───▶│  tasks.md   │
│ (require.)  │    │ (design)    │    │ (breakdown) │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                                   /speckit.tobeads
                                            │
                                            ▼
                         ┌─────────────────────────────┐
                         │         Beads               │
                         │  ┌─────────────────────┐    │
                         │  │ Epic: Feature Name  │    │
                         │  └─────────────────────┘    │
                         │           │                 │
                         │     ┌─────┴─────┐           │
                         │     ▼           ▼           │
                         │  [Task 1]   [Task 2] ...    │
                         └─────────────────────────────┘
```

### /speckit.tobeads Behavior

1. Reads `tasks.md` from current spec directory
2. Creates Epic issue for the feature
3. Creates child issues for each task
4. Sets up dependencies:
   - Sequential tasks: `blocked-by` previous
   - Parallel tasks (marked `[P]`): no blocking deps
5. Returns Epic ID and task count

### Emergent Work Pattern

When discovering new tasks during implementation:

```bash
# DON'T add to tasks.md after import
# DO create directly in Beads with origin tracking

bd create "Found: Missing validation" -t bug --deps discovered-from:buh-current-task
```

---

## Formulas (Molecule Templates)

### Available Formulas

Location: `.beads/formulas/`

| Formula       | File                       | Purpose                    | Phase  |
| ------------- | -------------------------- | -------------------------- | ------ |
| `bigfeature`  | `bigfeature.formula.toml`  | Spec-kit → Beads pipeline  | liquid |
| `bugfix`      | `bugfix.formula.toml`      | Standard bug fix process   | liquid |
| `hotfix`      | `hotfix.formula.toml`      | Emergency production fix   | vapor  |
| `techdebt`    | `techdebt.formula.toml`    | Technical debt remediation | liquid |
| `healthcheck` | `healthcheck.formula.toml` | Bug-hunter → fix cycle     | vapor  |
| `codereview`  | `codereview.formula.toml`  | Code review workflow       | liquid |
| `release`     | `release.formula.toml`     | Version release process    | vapor  |
| `exploration` | `exploration.formula.toml` | Research/spike             | vapor  |

### Phase Meanings

| Phase    | Meaning          | Use Case                              |
| -------- | ---------------- | ------------------------------------- |
| `vapor`  | Ephemeral (wisp) | Exploration, hotfix, can be discarded |
| `liquid` | Persistent (mol) | Features, bugs, must complete         |

### Using Formulas

```bash
# View formula details
bd formula show bigfeature

# Start ephemeral workflow
bd mol wisp exploration --vars "question=How to implement caching?"

# Start persistent workflow
bd mol pour bigfeature --vars "feature_name=user-auth"

# Check progress
bd mol progress <wisp-or-mol-id>

# Complete
bd mol squash <id>   # Keep summary
bd mol burn <id>     # Discard
```

---

## File Structure

### Beads Files

```
.beads/
├── config.yaml              # Beads configuration
├── issues.jsonl             # Issue storage (git-tracked)
├── beads.db                 # SQLite cache (gitignored)
├── beads.db-shm             # SQLite shared memory
├── beads.db-wal             # SQLite write-ahead log
├── daemon.log               # Daemon logs
├── daemon.pid               # Daemon process ID
├── daemon.lock              # Daemon lock file
├── .gitignore               # Ignores db files
├── README.md                # Beads readme
├── formulas/                # Molecule templates
│   ├── bigfeature.formula.toml
│   ├── bugfix.formula.toml
│   ├── hotfix.formula.toml
│   ├── techdebt.formula.toml
│   ├── healthcheck.formula.toml
│   ├── codereview.formula.toml
│   ├── release.formula.toml
│   └── exploration.formula.toml
└── metadata.json            # Beads metadata
```

### Claude Code Files

```
.claude/
├── docs/
│   ├── beads-quickstart.md          # User quick reference (Russian)
│   └── beads-speckit-reference.md   # Full reference (this file)
├── commands/
│   ├── speckit.specify.md
│   ├── speckit.clarify.md
│   ├── speckit.plan.md
│   ├── speckit.tasks.md
│   ├── speckit.implement.md
│   ├── speckit.analyze.md
│   ├── speckit.checklist.md
│   ├── speckit.tobeads.md           # Spec-kit → Beads bridge
│   └── speckit.taskstoissues.md
├── scripts/
│   └── release.sh                   # Includes bd sync
└── local.md                         # Server access (gitignored)
```

### Spec-kit Files

```
docs/speckit/
├── spec.md                          # Default spec location
├── plan.md                          # Default plan location
├── tasks.md                         # Default tasks location
└── features/
    └── <feature-name>/
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

---

## Sources & References

### Official Documentation

**Beads**:

- Repository: https://github.com/steveyegge/beads
- CLI Reference: https://github.com/steveyegge/beads/blob/main/docs/CLI_REFERENCE.md
- Architecture: https://github.com/steveyegge/beads/blob/main/docs/ARCHITECTURE.md
- Molecules: https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md
- Claude Integration: https://github.com/steveyegge/beads/blob/main/docs/CLAUDE_INTEGRATION.md
- Agent Instructions: https://github.com/steveyegge/beads/blob/main/AGENT_INSTRUCTIONS.md

### BuhBot Project Files

| File                                      | Purpose                        |
| ----------------------------------------- | ------------------------------ |
| `CLAUDE.md`                               | Agent orchestration rules      |
| `.claude/docs/beads-quickstart.md`        | User quick reference (Russian) |
| `.claude/docs/beads-speckit-reference.md` | Full reference (this file)     |

### Quick Commands Reference

```bash
# Beads essentials
bd ready                    # What to work on
bd create "X" -t type -p N  # New task
bd update <id> --status in_progress
bd close <id> --reason "X"
bd sync                     # MANDATORY at session end

# Formulas
bd formula list
bd mol wisp <name> --vars "k=v"
bd mol squash/burn <id>

# Spec-kit
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.tobeads

# Diagnostics
bd info
bd doctor
bd daemon restart
```

---

## Troubleshooting

### Common Issues

| Problem                           | Solution                                   |
| --------------------------------- | ------------------------------------------ |
| `bd ready` empty but issues exist | `bd sync` or `bd daemon restart`           |
| Daemon won't start                | `rm .beads/daemon.lock && bd daemon start` |
| Sync conflicts                    | `git status .beads/` → resolve → `bd sync` |
| Issue not found                   | `bd sync --force`                          |
| Formula not loading               | Check TOML syntax in `.beads/formulas/`    |
| Spec-kit command fails            | Check `docs/speckit/` directory exists     |

### Diagnostic Commands

```bash
# Beads health
bd doctor
bd info --json
cat .beads/daemon.log

# Git status of beads
git status .beads/
git diff .beads/issues.jsonl

# Check formulas
bd formula list
bd formula show <name>
```

---

_This document serves as the authoritative reference for the BuhBot Beads + Spec-kit integration._
