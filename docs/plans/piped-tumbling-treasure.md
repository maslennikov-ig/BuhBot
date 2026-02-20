# Plan: Fix response.handler.test.ts (gh-29)

## Summary

Тесты в `backend/src/bot/handlers/__tests__/response.handler.test.ts` падают из-за несовпадения путей в `vi.mock()` с реальными import-путями в `response.handler.ts`. Моки используют alias-пути (`@/lib/prisma.js`), а handler — относительные (`../../lib/prisma.js`). Vitest не резолвит alias внутри `vi.mock()`, поэтому моки не применяются и `isAccountantForChat` работает с реальными (неинициализированными) модулями.

## Root Cause

**Module path mismatch в vi.mock():**

Тест (строки 35, 39):
```typescript
vi.mock('@/lib/prisma.js', ...)     // alias path
vi.mock('@/utils/logger.js', ...)   // alias path
```

Handler (строки 23, 30):
```typescript
import { prisma } from '../../lib/prisma.js';   // relative path
import logger from '../../utils/logger.js';      // relative path
```

Vitest матчит `vi.mock()` по **точной строке импорта**. `@/lib/prisma.js` !== `../../lib/prisma.js` — мок не перехватывает модуль.

Все проходящие тесты используют относительные пути:
- `sla-timer.worker.test.ts`: `vi.mock('../../lib/prisma.js', ...)`
- `chats.test.ts`: `vi.mock('../../../../lib/prisma.js', ...)`
- `timer.service.test.ts`: `vi.mock('../../../lib/prisma.js', ...)`

## Plan

### Step 1: Fix mock paths (2 строки)

**File:** `backend/src/bot/handlers/__tests__/response.handler.test.ts`

- Строка 35: `vi.mock('@/lib/prisma.js', ...)` → `vi.mock('../../lib/prisma.js', ...)`
- Строка 39: `vi.mock('@/utils/logger.js', ...)` → `vi.mock('../../utils/logger.js', ...)`

Путь `../../` корректен: `__tests__/` → `handlers/` → `bot/` → `src/` — а оттуда `lib/prisma.js`. Но нужно проверить: тест в `__tests__/` вложен на один уровень глубже, значит от `__tests__/response.handler.test.ts` до `src/lib/prisma.js` — это `../../../lib/prisma.js` (3 уровня: `__tests__` → `handlers` → `bot` → `src`). Нужно сверить с import path в handler (`../../lib/prisma.js` от `handlers/response.handler.ts` — `handlers` → `bot` → `src`). Из `__tests__/` нужен один лишний `../`, итого `../../../lib/prisma.js`.

**Уточнение:** Vitest резолвит `vi.mock()` пути относительно **тестируемого модуля** (SUT), а не тест-файла. Но на практике Vitest сопоставляет mock-путь с import-путём в SUT. Поэтому в `vi.mock()` нужно указать **тот же путь, что написан в import** в тестируемом файле: `../../lib/prisma.js`.

### Step 2: Run tests

```bash
cd backend && NODE_ENV=test pnpm test src/bot/handlers/__tests__/response.handler.test.ts --run
```

### Step 3: Run full test suite

```bash
cd backend && NODE_ENV=test pnpm test --run
```

### Step 4: Beads + commit + close issue

```bash
bd create --type=bug --priority=2 --title="Fix mock paths in response.handler.test.ts" --external-ref="gh-29"
bd update <id> --status=in_progress
# fix + verify
git add backend/src/bot/handlers/__tests__/response.handler.test.ts
git commit -m "fix(test): use relative paths in vi.mock() for response handler tests (gh-29)"
bd close <id> --reason="Fixed: aligned vi.mock() paths with handler import paths"
gh issue close 29 --comment "Fixed: ..."
git push
```

## Files to Modify

- `backend/src/bot/handlers/__tests__/response.handler.test.ts` — 2 строки (mock paths)

## Verification

1. `NODE_ENV=test pnpm test src/bot/handlers/__tests__/response.handler.test.ts --run` — all pass
2. `NODE_ENV=test pnpm test --run` — no regressions
3. `pnpm type-check` — passes
