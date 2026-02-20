# Release Notes

User-facing release notes for all versions.

## v0.14.5

_Released on 2026-02-20_

### 🐛 Bug Fixes

- **release**: Eliminate sigpipe in changelog update functions
- **release**: Support release please tag format in release script
- **config**: Address remaining code review findings
- **backend**: Address code review findings
- **backend**: Add telegram validation timeout, centralize urls
- **dev-mode**: Unify dev mode exports and mock user ids
- **CI/CD**: Add missing frontend build args (gh-172, gh-173)

---

_This release was automatically generated from 9 commits._

## v0.9.19

_Released on 2026-01-30_

### 🐛 Bug Fixes

- **sla**: Fix notifyInChatOnBreach and global threshold update (gh-16, gh-17)

---

_This release was automatically generated from 4 commits._

## v0.9.18

_Released on 2026-01-30_

### ✨ New Features

- Add 1 skill(s), update docs
- Implement 4 GitHub issues (gh-8, gh-12, gh-13, gh-15)

### 🔧 Improvements

- **queues**: Centralize BullMQ configuration in queue.config.ts (buh-xch)

### 🐛 Bug Fixes

- Resolve 6 P1-P2 production bugs
- **Interface**: Fix response time chart overflow on analytics page
- **Interface**: Replace empty string values in Select components
- **docker**: Revert COPY paths to match CI build context
- **deps**: Add winston-transport as direct dependency
- **lint**: Resolve TypeScript and ESLint errors for CI

---

_This release was automatically generated from 15 commits._

## v0.9.17

_Released on 2026-01-16_

### ✨ New Features

- **navigation**: Add System Logs item to AdminLayout (buh-xla)
- **Interface**: Add complete logs/errors UI with pages and components (buh-mgs, buh-brr)
- **API**: Add tRPC logs router for error logs management (buh-zdc)
- **logging**: Add ErrorCaptureService with MD5 fingerprinting (buh-65g)

### 🐛 Bug Fixes

- **imports**: Use relative paths instead of aliases for build compatibility
- **docker**: Add backend/ prefix to COPY paths for correct build context

---

_This release was automatically generated from 14 commits._

## v0.9.16

_Released on 2026-01-16_

### ✨ New Features

- **Database**: Add ErrorLog model for centralized error tracking (buh-oyj)

---

_This release was automatically generated from 4 commits._

## v0.9.15

_Released on 2026-01-16_

### ✨ New Features

- **.claude/skills/systematic-debugging/condition-based-waiting-example.ts**: Add 17 source file(s), add 4 agent(s), +7 more
- Add invite_link to Chat model for universal 'Open chat' button support (buh-8tp)
- Notify all accountants from accountantUsernames array (buh-k5a)
- **CI/CD**: Add Telegram notification on CI failure

### 🐛 Bug Fixes

- **alerts**: Send notification to accountant DM instead of group
- **alerts**: Use assignedAccountant relation for notify button
- **sla**: Complete SLA notification system fixes and testing
- Use const for finalUsernames (lint error)
- Auto-add accountant username when assigned via dropdown
- **CI/CD**: Use lowercase repository name for Docker image tags

---

_This release was automatically generated from 18 commits._
