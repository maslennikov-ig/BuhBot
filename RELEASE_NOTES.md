# Release Notes

User-facing release notes for all versions.

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
