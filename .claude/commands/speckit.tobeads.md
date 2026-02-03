---
description: Import tasks from tasks.md into Beads issue tracker, creating an epic with child tasks and proper dependencies.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Prerequisites

Verify Beads is installed:

```bash
bd version
```

If not installed, instruct user to run:

```bash
npm install -g @beads/bd
bd init
```

## Outline

1. Locate the **tasks.md** file. Check these locations in order:
   - `docs/speckit/tasks.md` (default)
   - `docs/speckit/features/<feature-name>/tasks.md` (if feature specified)
   - User-provided path in arguments

2. Read and parse tasks.md file. Expected format:
   - `## Phase N: Title` — Phase headers become parent tasks
   - `- [ ] TXXX Description` — Tasks become child issues
   - `[P]` marker — Task can run in parallel (no blocking deps)
   - `[USn]` marker — User story label

3. Create Epic in Beads:

   ```bash
   bd create "Feature: <feature-name>" -t epic -p 2 -d "<spec-path>"
   ```

   Save the returned epic ID.

4. For each Phase, create a parent task:

   ```bash
   bd create "Phase N: <title>" -t task -p 2 --deps parent:<epic-id>
   ```

5. For each task within a phase:

   ```bash
   bd create "<task-description>" -t task -p 2 --deps parent:<phase-id>
   ```

   If task has `[USn]` marker, add label:

   ```bash
   bd update <task-id> --add-label usN
   ```

6. Set up dependencies:
   - Tasks without `[P]` marker depend on previous task in same phase
   - First task of Phase N+1 depends on last task of Phase N

   ```bash
   bd dep add <child-id> <parent-id>
   ```

7. Sync to git:
   ```bash
   bd sync
   ```

## Output

Report the import results:

```
## Import Complete

**Epic:** buh-<id> - <feature-name>
**Phases:** N
**Tasks:** M total

### Created Issues
- buh-abc123: Phase 1: Setup
  - buh-def456: Task 1.1 description
  - buh-ghi789: Task 1.2 description [P]
- buh-jkl012: Phase 2: Implementation
  ...

### Dependencies
- buh-def456 → buh-ghi789 (sequential)
- buh-ghi789 → buh-jkl012 (phase transition)

### Next Steps
Run `bd ready` to see available tasks.
```

## Error Handling

- If tasks.md not found: Report error and suggest running `/speckit.tasks` first
- If Beads not initialized: Run `bd init` automatically
- If task creation fails: Report which task failed and continue with remaining

## Example

Input tasks.md:

```markdown
## Phase 1: Setup

- [ ] T001 Create database schema
- [ ] T002 [P] Setup API routes

## Phase 2: Implementation

- [ ] T003 [US1] Implement user service
- [ ] T004 [US1] Add validation
```

Creates:

```
buh-epic-001: Feature: user-management
├── buh-ph1-001: Phase 1: Setup
│   ├── buh-t001: Create database schema
│   └── buh-t002: Setup API routes [parallel]
└── buh-ph2-001: Phase 2: Implementation
    ├── buh-t003: Implement user service (label: us1)
    └── buh-t004: Add validation (label: us1)

Dependencies:
- buh-t001 blocks buh-t002 (unless [P])
- buh-t002 blocks buh-ph2-001
```
